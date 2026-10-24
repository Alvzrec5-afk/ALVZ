"""Lanceur : Workspace > Scripts > ALVZ Grade.

Démarre le panneau dans son propre processus (Python de l'installation ALVZ Grade),
qui se connecte à Resolve par le scripting externe.
"""

import subprocess
from pathlib import Path

HOME = Path.home() / "Library" / "Application Support" / "ALVZ Grade"
PYTHON = HOME / "venv" / "bin" / "python"
LOG = HOME / "panel.log"

if not PYTHON.exists():
    print("ALVZ Grade n'est pas installé : lance plugin/install.sh.")
else:
    HOME.mkdir(parents=True, exist_ok=True)
    with open(LOG, "ab") as log:
        subprocess.Popen([str(PYTHON), "-m", "alvz_grade"], stdout=log, stderr=log,
                         stdin=subprocess.DEVNULL, start_new_session=True)
