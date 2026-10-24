"""Lien avec DaVinci Resolve Studio par l'API de scripting officielle (mode externe).

Resolve doit être ouvert, avec Préférences > Système > Général >
« External scripting using » réglé sur « Local ».
"""

import hashlib
import os
import sys
from pathlib import Path

MAC_SCRIPT_API = "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting"
MAC_SCRIPT_LIB = "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so"
MAC_LUT_DIR = "/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT"

# Sous-dossier du dossier LUT de Resolve où le plugin écrit ses DCTL
LUT_SUBDIR = "ALVZ"

# Labels des nodes du gabarit (à nommer dans Resolve : clic droit sur le node > Node Label)
NODE_IN = "AZ_IN"
NODE_BAL = "AZ_BAL"
NODE_TONE = "AZ_TONE"
NODE_LOOK = "AZ_LOOK"
NODE_OUT = "AZ_OUT"
REQUIRED_NODES = (NODE_IN, NODE_BAL, NODE_TONE, NODE_OUT)


class ResolveError(RuntimeError):
    pass


def connect():
    """Renvoie l'objet `resolve`, ou lève ResolveError avec un message pour l'utilisateur."""
    os.environ.setdefault("RESOLVE_SCRIPT_API", MAC_SCRIPT_API)
    os.environ.setdefault("RESOLVE_SCRIPT_LIB", MAC_SCRIPT_LIB)
    modules = os.path.join(os.environ["RESOLVE_SCRIPT_API"], "Modules")
    if modules not in sys.path:
        sys.path.append(modules)
    try:
        import DaVinciResolveScript as dvr
    except ImportError as e:
        raise ResolveError(
            "Module de scripting de Resolve introuvable. DaVinci Resolve Studio est-il installé ?"
        ) from e
    resolve = dvr.scriptapp("Resolve")
    if resolve is None:
        raise ResolveError(
            "Impossible de joindre Resolve. Ouvre-le, puis règle Préférences > Système > Général > "
            "External scripting using sur « Local »."
        )
    return resolve


def lut_root():
    return Path(os.environ.get("ALVZ_GRADE_LUT_DIR", MAC_LUT_DIR))


class Bridge:
    """Toutes les écritures vers Resolve passent par ici, depuis un seul fil."""

    def __init__(self, resolve, lut_dir=None):
        self.resolve = resolve
        self.lut_dir = Path(lut_dir) if lut_dir else lut_root()

    # --- lecture du contexte -------------------------------------------------

    def project(self):
        pm = self.resolve.GetProjectManager()
        return pm.GetCurrentProject() if pm else None

    def current_clip(self):
        """(projet, nom du projet, timeline item, uid) du clip sous la tête de lecture, ou None."""
        project = self.project()
        if not project:
            return None
        timeline = project.GetCurrentTimeline()
        if not timeline:
            return None
        item = timeline.GetCurrentVideoItem()
        if not item:
            return None
        return project, project.GetName(), item, item.GetUniqueId()

    def graph(self, item):
        """Graph (Resolve 19+). Les versions plus anciennes exposent les mêmes appels sur le clip."""
        get = getattr(item, "GetNodeGraph", None)
        g = get() if get else None
        return g or item

    def node_map(self, item):
        g = self.graph(item)
        n = g.GetNumNodes() or 0
        return {g.GetNodeLabel(i): i for i in range(1, n + 1) if g.GetNodeLabel(i)}

    def has_template(self, nodes):
        return all(label in nodes for label in REQUIRED_NODES)

    def apply_template(self, item, drx_path):
        """Remplace le grade du clip par le gabarit. Ne jamais l'appeler sans l'accord de l'utilisateur."""
        if not Path(drx_path).is_file():
            raise ResolveError(f"Gabarit introuvable : {drx_path}")
        g = self.graph(item)
        ok = g.ApplyGradeFromDRX(str(drx_path), 0) if hasattr(g, "ApplyGradeFromDRX") else False
        if not ok:
            raise ResolveError("Resolve a refusé le gabarit (ApplyGradeFromDRX).")
        nodes = self.node_map(item)
        missing = [label for label in REQUIRED_NODES if label not in nodes]
        if missing:
            raise ResolveError("Le gabarit n'a pas les nodes : " + ", ".join(missing))
        return nodes

    # --- écritures ------------------------------------------------------------

    def set_cdl(self, item, node_index, cdl):
        if not item.SetCDL(cdl.to_resolve(node_index)):
            raise ResolveError("Resolve a refusé le CDL (SetCDL).")

    def dctl_path(self, clip_uid, node_label, text):
        """Le nom dépend du contenu : Resolve garde les LUT en cache par chemin, donc un nouveau
        réglage doit avoir un nouveau nom, et un réglage déjà écrit garde le sien."""
        digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]
        folder = self.lut_dir / LUT_SUBDIR / _safe_uid(clip_uid)
        return folder / f"{node_label}_{digest}.dctl"

    def set_dctl(self, item, node_index, clip_uid, node_label, text, keep=2):
        path = self.dctl_path(clip_uid, node_label, text)
        is_new = not path.exists()
        if is_new:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            tmp.write_text(text, encoding="utf-8")
            os.replace(tmp, path)
            project = self.project()
            if project:
                project.RefreshLUTList()
        if not self.graph(item).SetLUT(node_index, str(path)):
            raise ResolveError(f"Resolve a refusé le DCTL sur {node_label} (SetLUT).")
        self._prune(path, keep)
        return path

    def current_lut(self, item, node_index):
        return self.graph(item).GetLUT(node_index) or ""

    def _prune(self, current, keep):
        """Garde les `keep` fichiers les plus récents de ce node, dont le fichier courant."""
        node_label = current.name.rsplit("_", 1)[0]
        files = sorted(current.parent.glob(f"{node_label}_*.dctl"),
                       key=lambda p: p.stat().st_mtime, reverse=True)
        for old in files[keep:]:
            if old != current:
                old.unlink(missing_ok=True)


def _safe_uid(uid):
    return "".join(c if c.isalnum() or c in "-_" else "_" for c in str(uid)) or "clip"
