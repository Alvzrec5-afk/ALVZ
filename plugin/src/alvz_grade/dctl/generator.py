"""Génère les DCTL des nodes pilotés par fichier (AZ_TONE, AZ_LOOK).

L'API de Resolve ne règle pas les paramètres d'un DCTL : on écrit donc les valeurs des
curseurs comme constantes dans le fichier, puis on le recharge avec Graph.SetLUT.
Le texte généré ne dépend que des valeurs (même entrée -> même fichier).
"""

from ..color.transforms import DI_MID_GREY

HEADER = "// Généré par ALVZ Grade. Ne pas modifier : le fichier est réécrit à chaque réglage.\n"

_TONE = """{header}// AZ_TONE : hautes lumières, ombres, tons chair (espace DaVinci Intermediate)

__CONSTANT__ float HIGHLIGHT = {highlight:.6f}f;
__CONSTANT__ float SHADOW = {shadow:.6f}f;
__CONSTANT__ float SKIN = {skin:.6f}f;
__CONSTANT__ float PIVOT = {pivot:.6f}f;

__DEVICE__ float az_smoothstep(float e0, float e1, float x)
{{
    float t = _fminf(_fmaxf((x - e0) / (e1 - e0), 0.0f), 1.0f);
    return t * t * (3.0f - 2.0f * t);
}}

__DEVICE__ float3 transform(int p_Width, int p_Height, int p_X, int p_Y, float p_R, float p_G, float p_B)
{{
    float y = 0.2627f * p_R + 0.6780f * p_G + 0.0593f * p_B;

    // Un même décalage sur les trois canaux : la teinte ne bouge pas.
    float w_hi = az_smoothstep(PIVOT, PIVOT + {hi_width:.4f}f, y);
    float w_lo = 1.0f - az_smoothstep(PIVOT - {lo_width:.4f}f, PIVOT, y);
    float d = HIGHLIGHT * {amount:.4f}f * w_hi + SHADOW * {amount:.4f}f * w_lo;
    float r = p_R + d;
    float g = p_G + d;
    float b = p_B + d;

    // Tons chair : saturation ciblée autour de la teinte peau (orangé).
    float cb = b - y;
    float cr = r - y;
    float chroma = _sqrtf(cb * cb + cr * cr);
    float hue = _atan2f(cr, cb);
    float dh = hue - {skin_hue:.6f}f;
    if (dh > 3.14159265f) dh -= 6.28318531f;
    if (dh < -3.14159265f) dh += 6.28318531f;
    float w_skin = _expf(-(dh * dh) / {skin_spread:.6f}f) * az_smoothstep(0.0f, {skin_chroma:.4f}f, chroma);
    float s = 1.0f + SKIN * {skin_amount:.4f}f * w_skin;
    float y2 = y + d;
    r = y2 + (r - y2) * s;
    g = y2 + (g - y2) * s;
    b = y2 + (b - y2) * s;

    return make_float3(r, g, b);
}}
"""

_LOOK = """{header}// AZ_LOOK : look « {name} », mélangé à {mix_percent:.0f} %

DEFINE_LUT(AZ_LOOK_LUT, {lut_path})

__CONSTANT__ float MIX = {mix:.6f}f;

__DEVICE__ float3 transform(int p_Width, int p_Height, int p_X, int p_Y, float p_R, float p_G, float p_B)
{{
    float3 look = APPLY_LUT(p_R, p_G, p_B, AZ_LOOK_LUT);
    return make_float3(p_R + (look.x - p_R) * MIX,
                       p_G + (look.y - p_G) * MIX,
                       p_B + (look.z - p_B) * MIX);
}}
"""

_IDENTITY = """{header}// {node} : neutre

__DEVICE__ float3 transform(int p_Width, int p_Height, int p_X, int p_Y, float p_R, float p_G, float p_B)
{{
    return make_float3(p_R, p_G, p_B);
}}
"""


def _clamp(v, lo, hi):
    return max(lo, min(hi, float(v)))


# Réglages du node AZ_TONE, partagés par le DCTL et par tone_reference().
TONE = {
    "hi_width": 0.35,
    "lo_width": 0.30,
    # décalage DI à ±100 : 0,08 ≈ 1,1 diaphragme
    "amount": 0.08,
    # teinte peau dans le plan (b-y, r-y) mesurée en DI sur des peaux claire, mate et foncée : 2,37–2,44 rad
    "skin_hue": 2.41,
    "skin_spread": 0.18,
    "skin_chroma": 0.03,
    # saturation des peaux à ±100 : ±40 %
    "skin_amount": 0.4,
}


def tone_dctl(highlight=0.0, shadow=0.0, skin_tone=0.0):
    """Curseurs de -100 à 100."""
    return _TONE.format(
        header=HEADER,
        highlight=_clamp(highlight, -100, 100) / 100.0,
        shadow=_clamp(shadow, -100, 100) / 100.0,
        skin=_clamp(skin_tone, -100, 100) / 100.0,
        pivot=DI_MID_GREY,
        **TONE,
    )


def tone_reference(rgb, highlight=0.0, shadow=0.0, skin_tone=0.0):
    """Le même calcul que le DCTL AZ_TONE, en numpy : pour les tests et l'aperçu de CopyCat."""
    import numpy as np

    def smoothstep(e0, e1, x):
        t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
        return t * t * (3.0 - 2.0 * t)

    rgb = np.asarray(rgb, dtype=np.float64)
    h, s, k = (_clamp(v, -100, 100) / 100.0 for v in (highlight, shadow, skin_tone))
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    y = 0.2627 * r + 0.6780 * g + 0.0593 * b
    w_hi = smoothstep(DI_MID_GREY, DI_MID_GREY + TONE["hi_width"], y)
    w_lo = 1.0 - smoothstep(DI_MID_GREY - TONE["lo_width"], DI_MID_GREY, y)
    d = h * TONE["amount"] * w_hi + s * TONE["amount"] * w_lo
    r, g, b = r + d, g + d, b + d
    cb, cr = b - y, r - y
    chroma = np.sqrt(cb * cb + cr * cr)
    dh = (np.arctan2(cr, cb) - TONE["skin_hue"] + np.pi) % (2 * np.pi) - np.pi
    w_skin = np.exp(-(dh * dh) / TONE["skin_spread"]) * smoothstep(0.0, TONE["skin_chroma"], chroma)
    sat = 1.0 + k * TONE["skin_amount"] * w_skin
    y2 = y + d
    return np.stack([y2 + (c - y2) * sat for c in (r, g, b)], axis=-1)


def look_dctl(name, lut_path, mix=1.0):
    """`lut_path` : chemin du .cube (DI -> DI) tel que DEFINE_LUT l'attend."""
    mix = _clamp(mix, 0, 1)
    return _LOOK.format(header=HEADER, name=name.replace("\n", " "), lut_path=lut_path,
                        mix=mix, mix_percent=mix * 100)


def identity_dctl(node):
    return _IDENTITY.format(header=HEADER, node=node)
