"""Le panneau (PySide6). Toutes les commandes vers Resolve partent d'un seul fil de travail ;
pour un même curseur, seule la dernière valeur est envoyée."""

import threading
import time
import traceback

from PySide6.QtCore import QObject, Qt, Signal
from PySide6.QtWidgets import (QApplication, QDoubleSpinBox, QGridLayout, QHBoxLayout, QLabel,
                               QMessageBox, QPushButton, QSlider, QVBoxLayout, QWidget)

from ..controller import Controller, Status
from ..state.store import DEFAULT_SLIDERS

# nom, libellé, min, max, décimales
SLIDERS = (
    ("exposure", "Exposition", -4.0, 4.0, 2),
    ("contrast", "Contraste", 0.5, 2.0, 2),
    ("highlight", "Hautes lumières", -100.0, 100.0, 0),
    ("shadow", "Ombres", -100.0, 100.0, 0),
    ("temperature", "Température", -100.0, 100.0, 0),
    ("tint", "Teinte", -100.0, 100.0, 0),
    ("saturation", "Saturation", 0.0, 2.0, 2),
    ("skin_tone", "Tons chair", -100.0, 100.0, 0),
)

POLL_SECONDS = 0.25


class Worker(QObject):
    status = Signal(object)
    error = Signal(str)

    def __init__(self, controller: Controller):
        super().__init__()
        self.controller = controller
        self._pending = {}
        self._cond = threading.Condition()
        self._running = True
        self._thread = threading.Thread(target=self._loop, name="alvz-resolve", daemon=True)

    def start(self):
        self._thread.start()

    def stop(self):
        with self._cond:
            self._running = False
            self._cond.notify()

    def submit(self, key, fn, *args):
        """Remplace une commande en attente de même clé (la dernière valeur gagne)."""
        with self._cond:
            self._pending[key] = (fn, args)
            self._cond.notify()

    def _loop(self):
        last_poll = 0.0
        while True:
            with self._cond:
                if not self._running:
                    return
                if not self._pending:
                    self._cond.wait(timeout=POLL_SECONDS)
                jobs, self._pending = self._pending, {}
            for fn, args in jobs.values():
                self._run(fn, *args)
            if time.monotonic() - last_poll >= POLL_SECONDS:
                last_poll = time.monotonic()
                result = self._run(self.controller.poll)
                if result is not None:
                    self.status.emit(result)

    def _run(self, fn, *args):
        try:
            return fn(*args)
        except Exception as e:  # le panneau reste ouvert quoi qu'il arrive
            traceback.print_exc()
            self.error.emit(str(e))
            return None


class SliderRow:
    STEPS = 1000

    def __init__(self, grid, row, name, label, lo, hi, decimals, on_change):
        self.name, self.lo, self.hi = name, lo, hi
        self.default = DEFAULT_SLIDERS[name]
        self.on_change = on_change
        self._mute = False

        self.label = QLabel(label)
        self.label.setToolTip("Double-clic : valeur neutre")
        self.label.mouseDoubleClickEvent = lambda _e: self.set_value(self.default, notify=True)
        self.slider = QSlider(Qt.Horizontal)
        self.slider.setRange(0, self.STEPS)
        self.spin = QDoubleSpinBox()
        self.spin.setRange(lo, hi)
        self.spin.setDecimals(decimals)
        self.spin.setSingleStep(10 ** -decimals if decimals else 1)
        self.spin.setKeyboardTracking(False)
        grid.addWidget(self.label, row, 0)
        grid.addWidget(self.slider, row, 1)
        grid.addWidget(self.spin, row, 2)

        self.slider.valueChanged.connect(self._from_slider)
        self.spin.valueChanged.connect(self._from_spin)
        self.set_value(self.default)

    def _to_pos(self, v):
        return round((v - self.lo) / (self.hi - self.lo) * self.STEPS)

    def _from_pos(self, pos):
        return self.lo + pos / self.STEPS * (self.hi - self.lo)

    def set_value(self, value, notify=False):
        self._mute = True
        self.slider.setValue(self._to_pos(value))
        self.spin.setValue(value)
        self._mute = False
        if notify:
            self.on_change(self.name, value)

    def _from_slider(self, pos):
        if self._mute:
            return
        value = round(self._from_pos(pos), self.spin.decimals())
        self._mute = True
        self.spin.setValue(value)
        self._mute = False
        self.on_change(self.name, value)

    def _from_spin(self, value):
        if self._mute:
            return
        self._mute = True
        self.slider.setValue(self._to_pos(value))
        self._mute = False
        self.on_change(self.name, value)

    def set_enabled(self, on):
        for w in (self.label, self.slider, self.spin):
            w.setEnabled(on)


class Panel(QWidget):
    def __init__(self, controller: Controller):
        super().__init__()
        self.setWindowTitle("ALVZ Grade")
        self.setWindowFlag(Qt.WindowStaysOnTopHint, True)
        self.setMinimumWidth(380)
        self.worker = Worker(controller)
        self.controller = controller
        self.clip_uid = None

        layout = QVBoxLayout(self)
        self.clip_label = QLabel("…")
        self.clip_label.setStyleSheet("font-weight: 600;")
        layout.addWidget(self.clip_label)

        grid = QGridLayout()
        grid.setColumnStretch(1, 1)
        self.rows = {}
        for i, (name, label, lo, hi, dec) in enumerate(SLIDERS):
            self.rows[name] = SliderRow(grid, i, name, label, lo, hi, dec, self._slider_changed)
        layout.addLayout(grid)

        buttons = QHBoxLayout()
        self.template_btn = QPushButton("Appliquer le gabarit")
        self.template_btn.clicked.connect(self._apply_template)
        self.reset_btn = QPushButton("Reset")
        self.reset_btn.clicked.connect(self._reset)
        buttons.addWidget(self.template_btn)
        buttons.addStretch(1)
        buttons.addWidget(self.reset_btn)
        layout.addLayout(buttons)

        self.status_label = QLabel("Connexion à Resolve…")
        self.status_label.setWordWrap(True)
        self.status_label.setStyleSheet("color: gray;")
        layout.addWidget(self.status_label)

        self.worker.status.connect(self._on_status)
        self.worker.error.connect(self._on_error)
        self.worker.start()

    def closeEvent(self, event):
        self.worker.stop()
        super().closeEvent(event)

    def _slider_changed(self, name, value):
        self.worker.submit(("slider", name), self.controller.set_slider, name, value)

    def _reset(self):
        for row in self.rows.values():
            row.set_value(row.default)
        self.worker.submit("reset", self.controller.reset)

    def _apply_template(self):
        answer = QMessageBox.question(
            self, "Appliquer le gabarit",
            "Le grade actuel de ce clip sera remplacé par le gabarit ALVZ "
            "(CST in, nodes ALVZ, CST out). Continuer ?")
        if answer == QMessageBox.Yes:
            self.worker.submit("template", self.controller.apply_template)

    def _on_status(self, status: Status):
        self.clip_label.setText(status.clip_name or "Aucun clip")
        self.status_label.setText(status.message)
        self.template_btn.setVisible(status.clip_uid is not None and not status.has_template)
        for row in self.rows.values():
            row.set_enabled(status.has_template)
        self.reset_btn.setEnabled(status.has_template)
        # Les curseurs ne suivent l'état enregistré qu'au changement de clip :
        # pendant un réglage, c'est la main de l'utilisateur qui décide.
        if status.clip_uid != self.clip_uid:
            self.clip_uid = status.clip_uid
            for name, value in (status.sliders or DEFAULT_SLIDERS).items():
                if name in self.rows:
                    self.rows[name].set_value(value)

    def _on_error(self, message):
        self.status_label.setText("Erreur : " + message)


def run(controller):
    app = QApplication.instance() or QApplication([])
    panel = Panel(controller)
    panel.show()
    return app.exec()
