# ALVZ Grade

Un panneau de curseurs pour étalonner dans **DaVinci Resolve Studio** (macOS), sans ouvrir les nodes.
Il travaille entre ton CST in et ton CST out : S-Log3 → DaVinci Wide Gamut / Intermediate → Rec.709.

Version 0.1 (tranche verticale) : Exposition, Contraste, Hautes lumières, Ombres, Température,
Teinte, Saturation, Tons chair et Reset. Le panneau suit le clip sous la tête de lecture et retient ses réglages.

## 1. Test de faisabilité (à faire en premier, 5 minutes)

Ce test mesure si les curseurs peuvent être assez rapides et vérifie ce que l'API de Resolve permet.

1. Dans le Terminal :
   ```bash
   sudo mkdir -p "/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT/ALVZ"
   sudo chown "$USER" "/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT/ALVZ"
   cp "resolve_scripts/ALVZ Spike.py" ~/Library/Application\ Support/Blackmagic\ Design/DaVinci\ Resolve/Fusion/Scripts/Color/
   ```
2. Dans Resolve : ouvre un **projet de test**, page Color, place la tête de lecture sur un clip avec **un seul node vide**.
3. Workspace > Scripts > **ALVZ Spike**.
4. Envoie-moi le fichier `alvz_spike_report.json` qui apparaît sur ton Bureau.

## 2. Installer

```bash
cd plugin
./install.sh
```

Il faut Python 3.10 ou plus récent ([python.org](https://www.python.org/downloads/macos/)).
Puis dans Resolve : **Préférences > Système > Général > External scripting using : Local**, et redémarre Resolve.

## 3. Créer le gabarit (une fois)

Le plugin ne peut pas créer de nodes : il les trouve par leur nom. Sur un clip S-Log3, construis ces nodes en série,
et nomme chacun avec clic droit > **Node Label** :

| ordre | label | contenu |
| --- | --- | --- |
| 1 | `AZ_IN` | ton **CST in** : S-Gamut3.Cine / S-Log3 → DaVinci Wide Gamut / DaVinci Intermediate |
| 2 | `AZ_BAL` | vide (exposition, contraste, balance, saturation) |
| 3 | `AZ_TONE` | vide (hautes lumières, ombres, tons chair) |
| 4 | `AZ_LOOK` | vide (les looks, plus tard) |
| 5 | `AZ_OUT` | ton **CST out** : DaVinci Wide Gamut / Intermediate → Rec.709, avec tes réglages de tone mapping |

Ensuite : clic droit dans le viewer > **Grab Still**. Dans la Gallery, clic droit sur le still > **Export** au format `.drx`.
Copie le fichier ici, sous ce nom exact :

```
~/Library/Application Support/ALVZ Grade/templates/sony_slog3_sgamut3cine.drx
```

## 4. Utiliser

Page Color > Workspace > Scripts > **ALVZ Grade**. Le panneau reste au premier plan.

- Si le clip n'a pas le gabarit, le bouton **Appliquer le gabarit** le pose. Il demande d'abord une confirmation, car il remplace le grade du clip.
- Double-clic sur le nom d'un curseur : valeur neutre.
- Si tu modifies les nodes ALVZ à la main dans Resolve, le panneau te prévient. Bouger un curseur réécrit les nodes.
- Pour copier un réglage sur d'autres clips, utilise le copier-coller de grade de Resolve.

En cas de souci : `~/Library/Application Support/ALVZ Grade/panel.log`.

## Développement

```bash
python3 -m venv .venv && .venv/bin/pip install -e ".[test]"
.venv/bin/pytest
```

- `src/alvz_grade/color` : formules S-Log3, S-Gamut3(.Cine), DWG / DI, Rec.709 ; curseurs → CDL.
- `src/alvz_grade/dctl` : génération des DCTL (`tone_reference` fait le même calcul en numpy pour les tests).
- `src/alvz_grade/bridge` : lien avec Resolve.
- `src/alvz_grade/controller.py` : la logique du panneau, testée avec un faux Resolve (`tests/fake_resolve.py`).
- `src/alvz_grade/ui` : le panneau PySide6.
