"""Logique du panneau, sans interface : suit le clip, garde son état, pousse les réglages.

L'interface (ui/panel.py) appelle ces méthodes depuis un seul fil de travail.
"""

import copy
from dataclasses import dataclass
from pathlib import Path

from .bridge.resolve import NODE_BAL, NODE_TONE, Bridge, ResolveError
from .color.cdl import sliders_to_cdl
from .dctl.generator import tone_dctl
from .state.store import DEFAULT_SLIDERS, Store, app_support_dir

CDL_SLIDERS = ("exposure", "contrast", "temperature", "tint", "saturation")
TONE_SLIDERS = ("highlight", "shadow", "skin_tone")


@dataclass
class Status:
    """Ce que le panneau affiche après un sondage."""
    clip_uid: str = None
    clip_name: str = ""
    has_template: bool = False
    changed_in_resolve: bool = False
    message: str = ""
    sliders: dict = None


class Controller:
    def __init__(self, bridge: Bridge, store: Store = None, templates_dir=None):
        self.bridge = bridge
        self.store = store or Store()
        self.templates_dir = Path(templates_dir) if templates_dir else app_support_dir() / "templates"
        self.project_name = None
        self.item = None
        self.state = None
        self.nodes = {}

    # --- suivi du clip --------------------------------------------------------

    def poll(self):
        ctx = self.bridge.current_clip()
        if ctx is None:
            self.item, self.state, self.nodes = None, None, {}
            return Status(message="Aucun clip sous la tête de lecture.")
        _, project_name, item, uid = ctx
        if self.state is None or uid != self.state["clip_uid"] or project_name != self.project_name:
            self.project_name, self.item = project_name, item
            self.state = self.store.load(project_name, uid)
        else:
            self.item = item
        self.nodes = self.bridge.node_map(item)
        status = Status(clip_uid=uid, clip_name=item.GetName() or "",
                        sliders=copy.deepcopy(self.state["sliders"]))
        status.has_template = self.bridge.has_template(self.nodes)
        if not status.has_template:
            status.message = "Ce clip n'a pas le gabarit ALVZ. Applique-le pour régler avec les curseurs."
            return status
        status.changed_in_resolve = self._drifted()
        status.message = ("Le grade de ce clip a été modifié dans Resolve. "
                          "Bouger un curseur réécrit les nodes ALVZ." if status.changed_in_resolve
                          else "Grade du clip chargé.")
        return status

    def _drifted(self):
        written = self.state.get("written", {})
        for label, path in written.items():
            if label not in self.nodes:
                return True
            if Path(self.bridge.current_lut(self.item, self.nodes[label])).name != Path(path).name:
                return True
        return False

    # --- actions --------------------------------------------------------------

    def template_path(self):
        return self.templates_dir / f"{self.state['camera']}.drx"

    def apply_template(self):
        self._need_clip()
        self.nodes = self.bridge.apply_template(self.item, self.template_path())
        self.state["written"] = {}
        self.push_all()

    def set_slider(self, name, value):
        if name not in DEFAULT_SLIDERS:
            raise KeyError(name)
        self._need_template()
        self.state["sliders"][name] = float(value)
        if name in CDL_SLIDERS:
            self._push_cdl()
        else:
            self._push_tone()
        self._save()

    def reset(self):
        self._need_template()
        self.state["sliders"] = copy.deepcopy(DEFAULT_SLIDERS)
        self.push_all()

    def push_all(self):
        self._need_template()
        self._push_cdl()
        self._push_tone()
        self._save()

    # --- interne --------------------------------------------------------------

    def _push_cdl(self):
        s = self.state["sliders"]
        cdl = sliders_to_cdl(**{k: s[k] for k in CDL_SLIDERS})
        self.bridge.set_cdl(self.item, self.nodes[NODE_BAL], cdl)

    def _push_tone(self):
        s = self.state["sliders"]
        text = tone_dctl(**{k: s[k] for k in TONE_SLIDERS})
        path = self.bridge.set_dctl(self.item, self.nodes[NODE_TONE], self.state["clip_uid"],
                                    NODE_TONE, text)
        self.state["written"][NODE_TONE] = str(path)

    def _save(self):
        self.store.save(self.project_name, self.state)

    def _need_clip(self):
        if self.item is None or self.state is None:
            raise ResolveError("Aucun clip sélectionné.")

    def _need_template(self):
        self._need_clip()
        if not self.bridge.has_template(self.nodes):
            raise ResolveError("Ce clip n'a pas le gabarit ALVZ.")

