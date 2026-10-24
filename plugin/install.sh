#!/bin/bash
# Installe ALVZ Grade sur macOS (DaVinci Resolve Studio).
# Usage : ./install.sh        (depuis le dossier plugin/)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HOME/Library/Application Support/ALVZ Grade"
SCRIPTS="$HOME/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Scripts/Color"
LUT_ALVZ="/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT/ALVZ"

PY="${PYTHON:-python3}"
if ! "$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
  echo "Python 3.10+ requis : installe-le depuis https://www.python.org/downloads/macos/" >&2
  exit 1
fi

echo "1/4 Environnement Python…"
mkdir -p "$APP/templates"
"$PY" -m venv "$APP/venv"
"$APP/venv/bin/python" -m pip install --quiet --upgrade pip
"$APP/venv/bin/python" -m pip install --quiet "$HERE"

echo "2/4 Dossier des DCTL dans le dossier LUT de Resolve (mot de passe administrateur)…"
if [ ! -w "$LUT_ALVZ" ]; then
  sudo mkdir -p "$LUT_ALVZ"
  sudo chown "$USER" "$LUT_ALVZ"
fi

echo "3/4 Scripts dans Workspace > Scripts…"
mkdir -p "$SCRIPTS"
cp "$HERE/resolve_scripts/ALVZ Grade.py" "$SCRIPTS/"
cp "$HERE/resolve_scripts/ALVZ Spike.py" "$SCRIPTS/"

echo "4/4 Gabarit…"
if [ -z "$(ls -A "$APP/templates" 2>/dev/null)" ]; then
  echo "   Aucun gabarit pour l'instant : exporte ton PowerGrade en .drx et copie-le ici :"
  echo "   $APP/templates/sony_slog3_sgamut3cine.drx"
fi

echo
echo "Terminé. Dans Resolve : Préférences > Système > Général > External scripting using = Local,"
echo "puis redémarre Resolve. Ensuite : page Color > Workspace > Scripts > ALVZ Grade."
