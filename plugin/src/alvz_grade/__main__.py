"""python -m alvz_grade : ouvre le panneau, connecté au Resolve déjà ouvert."""

import sys

from .bridge.resolve import Bridge, ResolveError, connect
from .controller import Controller


def main():
    try:
        resolve = connect()
    except ResolveError as e:
        from PySide6.QtWidgets import QApplication, QMessageBox

        app = QApplication.instance() or QApplication([])
        QMessageBox.critical(None, "ALVZ Grade", str(e))
        return 1
    from .ui.panel import run

    return run(Controller(Bridge(resolve)))


if __name__ == "__main__":
    sys.exit(main())
