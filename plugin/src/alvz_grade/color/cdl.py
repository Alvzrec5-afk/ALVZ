"""Curseurs « humains » -> CDL (slope, offset, power, saturation) pour le node AZ_BAL.

Le node travaille en DaVinci Intermediate (log). En log :
- l'exposition et la balance des blancs sont des offsets par canal
  (un offset de DI_C vaut exactement un diaphragme dans la partie log) ;
- le contraste est une pente autour du gris moyen DI.
Pour un contraste k et une exposition e_c : slope = k, offset_c = k*e_c + P*(1-k), power = 1.
"""

from dataclasses import dataclass

from .transforms import DI_C, DI_MID_GREY

# Décalage DI pour un curseur Temperature ou Tint à ±100 (≈ 0,7 diaphragme d'écart entre canaux)
WB_RANGE = 0.05


@dataclass(frozen=True)
class Cdl:
    slope: tuple
    offset: tuple
    power: tuple
    saturation: float

    def to_resolve(self, node_index):
        """Dictionnaire attendu par TimelineItem.SetCDL (valeurs en chaînes)."""
        fmt = lambda v: " ".join(f"{c:.6f}" for c in v)
        return {
            "NodeIndex": str(node_index),
            "Slope": fmt(self.slope),
            "Offset": fmt(self.offset),
            "Power": fmt(self.power),
            "Saturation": f"{self.saturation:.6f}",
        }


def white_balance_offsets(temperature, tint):
    """Temperature et Tint de -100 à 100 -> offsets DI (r, g, b).

    Temperature > 0 réchauffe (plus de rouge, moins de bleu).
    Tint > 0 tire vers le magenta (moins de vert).
    """
    t = temperature / 100.0 * WB_RANGE
    m = tint / 100.0 * WB_RANGE
    return (t + m / 2.0, -m, -t + m / 2.0)


def sliders_to_cdl(exposure=0.0, contrast=1.0, temperature=0.0, tint=0.0, saturation=1.0,
                   pivot=DI_MID_GREY):
    """exposure en diaphragmes, contrast en facteur (1 = neutre), saturation en facteur."""
    wb = white_balance_offsets(temperature, tint)
    e = [exposure * DI_C + c for c in wb]
    k = contrast
    offset = tuple(k * ec + pivot * (1.0 - k) for ec in e)
    return Cdl(slope=(k, k, k), offset=offset, power=(1.0, 1.0, 1.0), saturation=saturation)


def apply_cdl(rgb, cdl):
    """Applique le CDL comme Resolve (ASC CDL, luma Rec.709 pour la saturation). Sert aux tests
    et à l'aperçu de CopyCat."""
    import numpy as np

    rgb = np.asarray(rgb, dtype=np.float64)
    out = rgb * np.asarray(cdl.slope) + np.asarray(cdl.offset)
    out = np.where(out > 0, np.power(np.maximum(out, 0), np.asarray(cdl.power)), out)
    luma = out @ np.array([0.2126, 0.7152, 0.0722])
    return luma[..., None] + cdl.saturation * (out - luma[..., None])
