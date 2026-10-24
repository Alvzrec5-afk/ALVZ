"""État d'un clip : un fichier JSON par clip, rangé par projet.

~/Library/Application Support/ALVZ Grade/clips/<projet>/<uid du clip>.json
"""

import copy
import json
import os
import re
import tempfile
from pathlib import Path

SCHEMA = 1

DEFAULT_SLIDERS = {
    "exposure": 0.0,     # diaphragmes, -4..4
    "contrast": 1.0,     # facteur, 0.5..2
    "temperature": 0.0,  # -100..100
    "tint": 0.0,         # -100..100
    "saturation": 1.0,   # facteur, 0..2
    "highlight": 0.0,    # -100..100
    "shadow": 0.0,       # -100..100
    "skin_tone": 0.0,    # -100..100
}

DEFAULT_STATE = {
    "schema": SCHEMA,
    "clip_uid": None,
    "camera": "sony_slog3_sgamut3cine",
    "look": {"id": None, "mix": 1.0},
    "sliders": DEFAULT_SLIDERS,
    # fichiers posés par le plugin sur chaque node, pour repérer une modification faite dans Resolve
    "written": {},
}


def app_support_dir():
    base = os.environ.get("ALVZ_GRADE_HOME")
    if base:
        return Path(base)
    return Path.home() / "Library" / "Application Support" / "ALVZ Grade"


def default_state(clip_uid):
    state = copy.deepcopy(DEFAULT_STATE)
    state["clip_uid"] = clip_uid
    return state


def _merge(defaults, saved):
    out = copy.deepcopy(defaults)
    for key, value in saved.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


def _safe(name):
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._") or "sans_nom"


class Store:
    def __init__(self, root=None):
        self.root = Path(root) if root else app_support_dir() / "clips"

    def path(self, project, clip_uid):
        return self.root / _safe(project) / f"{_safe(clip_uid)}.json"

    def load(self, project, clip_uid):
        """L'état enregistré, complété par les valeurs par défaut ; l'état neutre s'il n'y en a pas
        ou si le fichier est illisible."""
        p = self.path(project, clip_uid)
        try:
            saved = json.loads(p.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return default_state(clip_uid)
        if not isinstance(saved, dict) or saved.get("schema", 0) > SCHEMA:
            return default_state(clip_uid)
        state = _merge(DEFAULT_STATE, saved)
        state["schema"] = SCHEMA
        state["clip_uid"] = clip_uid
        return state

    def save(self, project, state):
        """Écriture atomique : un fichier à moitié écrit ne remplace jamais le bon."""
        p = self.path(project, state["clip_uid"])
        p.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=p.parent, prefix=".tmp-", suffix=".json")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(state, f, ensure_ascii=False, indent=2, sort_keys=True)
            os.replace(tmp, p)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
        return p
