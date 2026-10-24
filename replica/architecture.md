# Architecture : ALVZ Grade (reconstruction des fonctions de Pocket Grade)

« ALVZ Grade » est un nom de travail. Le vrai nom viendra avec `/replica-brand`.

Ce n'est pas une app web : c'est un **plugin qui pilote DaVinci Resolve Studio** sur macOS.
Pas de site, pas de serveur, pas de base de données : tout tourne sur le Mac de STV.

## Le flux couleur de STV (point de départ)

```
S-Log3 / S-Gamut3.Cine ──CST in──▶ DaVinci Wide Gamut / DaVinci Intermediate ──(étalonnage)──▶ CST out ──▶ Rec.709
```

Tout le travail du plugin se fait **entre le CST in et le CST out**, en DWG/DI, comme STV le fait déjà à la main.
Le plugin ne change pas sa façon de travailler : il remplace les nodes du milieu par des curseurs.

## Stack

| couche | choix | pourquoi |
| --- | --- | --- |
| langage | Python 3.12 (python.org) | c'est le langage de l'API de Resolve, et numpy / OpenCV couvrent CopyCat |
| lien avec Resolve | API de scripting officielle, **en mode externe** (`DaVinciResolveScript`) | Studio l'autorise ; même principe que l'original ; l'UI tourne dans son propre processus et ne bloque pas Resolve |
| interface | PySide6 (Qt) | vrais curseurs, champs numériques, sections repliables ; testable sans Resolve. UIManager (l'UI intégrée de Resolve) est trop limité pour ce panneau |
| lancement | un petit script dans Workspace > Scripts qui démarre l'app | même geste que l'original (Color > Workspace > Scripts > ALVZ Grade) |
| moteur couleur | **DCTL générés** (constantes écrites dans le fichier) + **CDL** via `SetCDL` | l'API ne règle ni les roues ni les paramètres d'OFX, mais elle peut poser un CDL et un LUT/DCTL sur un node |
| gabarit de nodes | un PowerGrade `.drx` par caméra, construit **une fois à la main** par STV à partir de ses propres CST | l'API ne crée pas de nodes ; un gabarit les apporte, avec les vrais CST de Resolve (tone mapping compris) |
| maths couleur | numpy ; formules publiques (S-Log3 et S-Gamut3.Cine de Sony, DWG et DI de Blackmagic, Rec.709) | pour CopyCat et les tests |
| CopyCat | numpy + OpenCV (détecteur de visage YuNet, modèle libre) | transfert de couleur et masque de peau |
| état des clips | un fichier JSON par clip dans `~/Library/Application Support/ALVZ Grade/` | pas besoin de base de données pour un outil local |
| tests | pytest (maths, générateur de DCTL, CopyCat) + un script de test à lancer dans Resolve | la partie pure Python tourne en CI ; la partie Resolve se teste sur le Mac de STV |
| CI | GitHub Actions (macOS) | lint + tests unitaires à chaque push |

## Le gabarit de nodes (cœur du système)

Chaque clip reçoit le même arbre en série. Les nodes ont des **labels fixes** : le plugin les retrouve avec `GetNodeLabel`.

| # | label | contenu | piloté par | espace |
| --- | --- | --- | --- | --- |
| 1 | `AZ_NR` | Noise Reduction native (Studio), désactivé | `SetNodeEnabled` | caméra |
| 2 | `AZ_IN` | **CST in de STV** : S-Log3 / S-Gamut3.Cine → DWG / DI | fixe (dans le gabarit) | → DI |
| 3 | `AZ_BAL` | CDL : exposition, température, teinte, contraste, saturation | `SetCDL` (instantané) | DI |
| 4 | `AZ_TONE` | DCTL généré : hautes lumières, ombres, peau, Shifter, courbe CopyCat | `SetLUT` sur un fichier régénéré | DI |
| 5 | `AZ_LOOK` | DCTL généré : applique le LUT du look (créé en DI) avec un mélange 0–100 % | `SetLUT` | DI |
| 6 | `AZ_MATCH` | DCTL généré : matrice de couleur CopyCat + force | `SetLUT` | DI |
| 7 | `AZ_FILM` | DCTL généré : compresseur, bleach, noirs délavés, pellicule, halation, bloom | `SetLUT` | DI |
| 8 | `AZ_GRAIN_8` … `AZ_GRAIN_65` | Film Grain natif pré-réglé (un node par format), désactivés | `SetNodeEnabled` (un seul actif) | DI |
| 9 | `AZ_OUT` | **CST out de STV** : DWG / DI → Rec.709 | fixe | → 709 |
| 10 | `AZ_FRAME` | DCTL généré : vignette, bandes de ratio, gate weave, poussière | `SetLUT` | 709 |

Comment les curseurs deviennent du CDL en DI (log) : l'exposition et la balance sont des **offsets** par canal (en log, un offset = un gain linéaire), et le contraste est une **pente autour du gris moyen DI** (pivot P ≈ 0,336). Pour un contraste k et une exposition e_c : `slope = k`, `offset_c = k·e_c + P·(1−k)`, `power = 1`.
Exposition, contraste, température, teinte et saturation passent donc tous par **un seul `SetCDL`, sans fichier à écrire** : ce sont les curseurs les plus utilisés, et ils seront les plus réactifs.

Pour les DCTL régénérés : le plugin écrit `AZ/<clip>/<node>_<n>.dctl` sous un **nouveau nom à chaque fois** (Resolve garde les LUT en cache par chemin), puis appelle `RefreshLUTList` et `SetLUT`. Il efface ensuite les anciens fichiers. Pendant que tu glisses un curseur, il envoie au plus un rendu toutes les ~100 ms, et un dernier rendu quand tu relâches.

Changer de caméra = réappliquer le gabarit de cette caméra (`ApplyGradeFromDRX`), puis renvoyer l'état du clip. Pour l'instant il n'y a qu'un gabarit : S-Log3.

## Schéma

### L'état d'un clip (JSON, version 1)

```json
{
  "schema": 1,
  "clip_uid": "<TimelineItem.GetUniqueId()>",
  "project": "<nom>", "timeline": "<nom>",
  "camera": "sony_slog3_sgamut3cine",
  "look": {"id": "alvz_warm_night", "mix": 1.0},
  "sliders": {"exposure": 0, "contrast": 1, "temperature": 0, "tint": 0, "saturation": 1,
              "highlight": 0, "shadow": 0, "skin_tone": 0, "film_look": 0,
              "shifter": {"red": [0,0,0], "green": [0,0,0], "blue": [0,0,0]}},
  "copycat": {"reference": null, "strength": 0.7, "separate_skin": true, "protect_skin": true,
              "curve": null, "matrix": null},
  "film": {"compressor": null, "bleach": null, "black": null, "stock": null,
           "halation": null, "bloom": null, "grain": null},
  "frame": {"vignette": null, "ratio": null, "format": null},
  "nr": false, "glow": null,
  "palette": {"on": false, "n": 8, "colors": []},
  "before_after": {"on": false, "animate": false, "duration": 3.0},
  "written": {"AZ_TONE": "AZ/…/tone_12.dctl"},
  "previous": null
}
```

`written` sert à la resynchro (F09) : si `GetLUT` sur un node AZ ne renvoie pas le fichier attendu, ou si le nombre de nodes a changé, c'est que le grade a été modifié dans Resolve. Le panneau le signale et relit ce qu'il peut.
`previous` garde l'état d'avant CopyCat, pour « Restaurer l'original ».

Les looks sont stockés dans `Looks/<id>/` : `look.cube` (65 points, DI → DI), `look.json` (nom, vignette, notes). Ce sont **les looks de STV**. Ils s'exportent depuis Resolve avec `TimelineItem.ExportLUT` sur un clip qui ne contient que les nodes du look.

## API

### Le pont vers Resolve (module `bridge`)

Ce sont des fonctions Python, pas des routes HTTP. Un seul processus les appelle (l'UI), avec un fil dédié à Resolve.

| fonction | fait | appels Resolve | parcours |
| --- | --- | --- | --- |
| `connect()` | se connecte à Resolve, vérifie Studio et la page Color | `scriptapp("Resolve")`, `GetCurrentPage` | F01, F03 |
| `current_clip()` | clip sous la tête de lecture (sondé toutes les 250 ms) | `GetCurrentTimeline`, `GetCurrentVideoItem`, `GetUniqueId` | F09 |
| `ensure_template(clip, camera)` | pose le gabarit s'il n'y est pas | `GetNodeGraph`, `GetNodeLabel`, `ApplyGradeFromDRX` | F03 |
| `push_cdl(clip, sliders)` | curseurs → CDL sur `AZ_BAL` | `SetCDL` | F03 |
| `push_dctl(clip, node, source)` | écrit le DCTL, rafraîchit, applique | `RefreshLUTList`, `Graph.SetLUT` | F03–F05 |
| `toggle(clip, label, on)` | allume/éteint NR, grain… | `SetNodeEnabled` | F05 |
| `detect_drift(clip, state)` | compare Resolve et l'état JSON | `GetNumNodes`, `GetLUT`, `GetToolsInNode` | F09 |
| `grab_frame(clip, stage)` | exporte l'image courante ; pour CopyCat, avec les nodes après `AZ_BAL` éteints | `SetNodeEnabled`, `ExportCurrentFrameAsStill` | F04, F06, F08 |
| `reset(clip)` | remet l'état neutre | `push_*` | F10 |
| `copy_to(clips)` | copie le grade sur d'autres clips (+ leurs JSON) | `CopyGrades` | F03 |
| `palette_overlay(clip, colors)` | PNG de la palette posée sur la piste au-dessus | `MediaPool.ImportMedia`, `AppendToTimeline` | F06 |
| `before_after(clip, duration)` | copie non étalonnée du clip au-dessus + comp Fusion avec masque animé | `AppendToTimeline`, `AddFusionComp`, API Fusion | F07 |

Services internes (sans Resolve) : `color.transforms` (S-Log3, S-Gamut3.Cine, DWG, DI, Rec.709), `color.cdl`, `dctl.generate`, `copycat.match`, `copycat.skin`, `state.store`.

**CopyCat, étape par étape** (méthodes publiées, rien de leur code) :
1. Récupérer l'image du clip en DI (`grab_frame` avec les nodes du look éteints), et convertir la référence sRGB/Rec.709 en DI.
2. Passer les deux images en Oklab.
3. Luminance : faire correspondre les histogrammes, puis ajuster une courbe lisse sur le résultat (→ `AZ_TONE`).
4. Couleur : transfert linéaire de moyenne et covariance (Monge-Kantorovich, Pitié 2007) sur a/b (→ matrice dans `AZ_MATCH`).
5. Peau : détecter les visages (YuNet) et construire un masque de peau. Avec « Séparer », les statistiques sont calculées sans la peau ; avec « Protéger », la peau est ramenée vers la ligne des tons chair.
6. Appliquer la force (70 % par défaut), écrire les DCTL, mettre à jour les curseurs. Tout reste réglable.

## Les parties qui piquent

- **Latence des curseurs** : le cycle écrire un DCTL → `RefreshLUTList` → `SetLUT` n'est pas mesuré. Les curseurs fréquents passent par le CDL (instantané) ; le reste est limité à ~10 rendus par seconde. C'est le premier test du spike.
- **Cache des LUT** : Resolve garde un LUT en mémoire par chemin, d'où un nouveau nom de fichier à chaque rendu et le nettoyage des anciens. Le dossier LUT est sous `/Library/…` : il faut un sous-dossier `AZ` accessible en écriture à l'utilisateur (le script d'installation s'en occupe).
- **Conflits avec Resolve** : l'utilisateur peut toucher aux nodes pendant que le panneau écrit. Une seule file d'écriture vers Resolve, et la détection de dérive (F09) avant chaque écriture.
- **Le grain doit bouger** : on ne sait pas si un DCTL reçoit le numéro d'image. Si non, on garde les nodes Film Grain natifs pré-réglés (`SetNodeEnabled`).
- **Effets spatiaux (halation, bloom)** : flou dans un DCTL en mode « transform » (lecture de texture). Ça coûte en lecture, à mesurer en 4K.
- **Avant/après et palette rendus à l'export** : la page Color n'est pas animable par l'API. On passe par une piste au-dessus et Fusion. Il faut nettoyer derrière (bouton Retirer).
- **Fidélité des couleurs** : la conversion de CopyCat (Python) doit coller au CST de Resolve. Test : comparer pixel par pixel avec un still exporté de Resolve, écart cible < 0,5 %.
- **Versions de Resolve** : l'API bouge (la 21.1 a retiré le scripting de la version gratuite). Le plugin vérifie la version au démarrage et teste les fonctions dont il a besoin.

## Ordre de construction

0. **Spike (1–2 jours, sur le Mac de STV, sans UI).** Un script qui pose le gabarit, envoie un CDL, régénère 50 DCTL d'affilée et **chronomètre**. Il vérifie aussi : `SetNodeEnabled` sur un OFX, `GetNodeLabel`, le format de `ExportCurrentFrameAsStill`, le support de `DEFINE_LUT`/`APPLY_LUT` dans les DCTL, et si un DCTL connaît le temps. Selon les chiffres, on garde le plan ou on l'ajuste.
1. **Tranche verticale.** S03 en version minimale : lancement depuis Workspace > Scripts, le panneau suit le clip, gabarit S-Log3, curseurs Exposure / Contrast / Temperature / Tint / Saturation (CDL), Reset, état JSON.
   Écrans S03 · état : JSON clip · pont : `connect`, `current_clip`, `ensure_template`, `push_cdl`, `reset`.
2. **Indispensables, par zone.**
   - Curseurs : Highlight, Shadow, Skin Tone (DCTL `AZ_TONE`), champs numériques, resynchro F09 (S03).
   - Looks : menu des looks de STV + mélange, section LUT (S03, S07).
   - CopyCat : référence, caméra, force, Create Grade, Restaurer, Retour (S04).
   - Film : grain, émulation pellicule (S05).
3. **Importants, puis bonus.**
   - Importants : peau séparée/protégée, Shifter, Film Look, NR, Glow, compresseur, bleach, noirs, vignette, ratio, halation, bloom, empilement, Still (S03–S06, S10).
   - Bonus : module Format, palette (S08), avant/après animé (S09).
4. **Corrections issues de `/replica-entrepreneur`** : ce que les utilisateurs reprochent à ce type d'outil, à intégrer quand on l'aura lancé.
