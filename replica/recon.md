# Carte de reconnaissance : Pocket Grade (plugin DaVinci Resolve, macOS)

Périmètre : tout le panneau Pocket Grade 2.0 : curseurs d'étalonnage, caméra + profil LOG,
looks (PowerGrades / LUTs), CopyCat (étalonnage depuis une image de référence), Film Module,
LAB (halation + bloom), palette de couleurs, avant/après animé, export de still.
Le plugin seulement : pas de site, pas de boutique, pas de licence.
Pour : STV / ALVZ.REC, d'abord en outil interne, puis peut-être en produit.
Cible technique : DaVinci Resolve **Studio** (18+), macOS.
Date : 2026-10-24

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | page de vente (capture PDF de STV) | https://filmmakersotoi.com/pocket-grade | 27 pages, rendues dans `screens/page-NN.png`. Source principale : fonctions, panneau, prix, installation. |
| 2 | site du vendeur | https://filmmakersotoi.com/ | prix 27,53 $, « plugin qui contrôle l'arbre de nodes », Studio 18+ requis car **scripting externe** |
| 3 | abonnement Pocket CC | https://filmmakersotoi.com/pocket-cc | une clé pour tous les plugins Pocket |
| 4 | doc API scripting Resolve v20 (copie publique du README) | https://gist.github.com/Manouchehri/e32461dccd824167bac8358bb21c8040 | ce que l'API permet de faire sur l'étalonnage (voir « Contraintes techniques ») |
| 5 | doc API Resolve (communauté) | https://resolvedevdoc.readthedocs.io/en/latest/readme_resolveapi.html | index des nodes en base 1 depuis 16.2 |
| 6 | scripting retiré de la version gratuite en 21.1 | https://www.pugetsystems.com/blog/2026/09/10/how-davinci-resolve-free-v21-1-scripting-changes-affect-puget-bench/ | confirme : Studio obligatoire |
| 7 | README local de Resolve | Help > Documentation > Developer (sur le Mac de STV) | **source qui fait foi** pour les signatures, à lire avant l'architecture |

Pas encore utilisé : vidéos de démo publiques (YouTube), changelog. Pas de compte utilisateur : STV n'a pas acheté le produit, on travaille donc **uniquement à partir de sources publiques**. On n'ouvre et on ne décompile pas leur plugin.

## Boucle principale

Choisir un look + sa caméra, puis régler l'étalonnage avec des curseurs « humains », sans ouvrir un seul node.

## Écrans

Le produit est **une seule fenêtre** (style UI de Resolve, titre « Pocket Grade 2.0.0 ») lancée depuis Color > Workspace > Scripts. Les « écrans » sont ses vues et ses sous-panneaux.

| ID | écran | comment y aller | rôle | composants clés | états vus |
| --- | --- | --- | --- | --- | --- |
| S01 | Installateur / activation | app d'installation reçue par email | saisir email + clé, « Activate & Install » | champs email/clé, bouton | vide ; succès ; *(déduits : clé invalide, Resolve absent, version App Store)* |
| S02 | Import des produits | « Import products » dans le panneau | glisser des .drx / .cube / .zip achetés, vérification par contenu | zone de dépôt, liste, message d'erreur | vide ; vérifié/débloqué ; refusé (« dit pourquoi et quoi faire ») |
| S03 | Panneau principal « Grade » | Color > Workspace > Scripts > Pocket Grade | régler le clip courant | menu PowerGrade, Input (marque) + Profile (LOG), curseurs Exposure, Highlight, Shadow, Contrast, Temperature, Tint, Shifter (couleur + R/G/B), Saturation, Skin Tone, Film Look ; cases NR, Grain, Glow (+ curseur) ; sections repliables LAB, LUT, Film Module ; cases Colour palette, Before/After ; boutons Still, Reset ; bouton CopyCat en haut ; champ numérique à côté de chaque curseur ; ligne de statut | aucun clip ; « Loaded this clip's grade » ; « This clip's grade changed in DaVinci Resolve. The panel shows it now. » ; looks non possédés grisés |
| S04 | CopyCat | bouton CopyCat en haut de S03 | créer un étalonnage depuis une image de référence | Choose reference (JPEG/PNG), Color Space Transform (2 menus : marque, profil), Match strength % (70 par défaut), Separate facial skin and surroundings, Protect skin tones, Create Grade, Restore original, Back to Grade, texte d'aide | pas de référence ; prêt ; résultat appliqué ; *(déduits : en cours, erreur, looks manquants)* |
| S05 | Film Module | section repliable de S03 | empiler des modules de texture film | menu du module, case On, curseurs du module, compteur « N on » | 0 actif ; 1 actif ; plusieurs actifs |
| S06 | LAB : Halation + Bloom | section repliable de S03 | lueur rouge des hautes lumières + bloom doux | 2 curseurs d'intensité | verrouillé si non possédé ; actif |
| S07 | LUT | section repliable de S03 | appliquer n'importe quel LUT installé + Shifter | liste des LUT, « None » | None ; LUT appliqué |
| S08 | Palette de couleurs | case dans S03, rendue dans le viewer | jusqu'à 8 couleurs dominantes de l'image en surimpression | case, Update, curseur Colours (1–8), taille, position | off ; on (figée) ; à mettre à jour après changement d'image |
| S09 | Avant / Après | case dans S03 | ligne de séparation qui balaie l'image, **rendue à l'export** | case, Animate Split, durée 0,5–10 s | off ; statique ; animé |
| S10 | Still | bouton dans S03 | enregistrer l'image courante en JPEG (sans fichier de grade) | bouton, dialogue de sauvegarde | ok ; erreur |
| S11 | Compte / téléchargement (web) | site | retélécharger, retrouver la clé | — | **reporté (phase vente)** |
| S12 | Page de vente + composeur de bundle + panier | site | acheter le plugin + des looks, remises progressives | cases à cocher, total, panier | **reporté (phase vente)** |

Captures de référence : `screens/page-05.png` (CopyCat), `page-07.png` (panneau complet), `page-07/08` (Film Module), `page-11/12` (palette), `page-13` (avant/après), `page-20` (installation), `page-22/24` (prix). **Jamais livrées dans le clone.**

## Parcours

```
F01 Installer et activer
    S01 -> redémarrer Resolve -> S03
    clics chemin heureux : 4 (ouvrir l'installateur, email, clé, Activate & Install)
    cas limites : version Mac App Store (les plugins y sont bloqués), Resolve gratuit, clé déjà utilisée, Resolve ouvert pendant l'installation

F02 Importer ses looks
    S03 -> S02 -> S03 (les looks importés ne sont plus grisés)
    clics : 2 + glisser-déposer
    cas limites : fichier corrompu, mauvais format, zip avec plusieurs looks, look déjà importé

F03 Étalonner un clip LOG (boucle principale)
    Resolve page Color -> Workspace > Scripts > Pocket Grade -> S03
    -> choisir un PowerGrade -> Input (marque) -> Profile (LOG) -> glisser les curseurs
    -> copier-coller le grade sur la timeline (fonction native de Resolve)
    clics chemin heureux : 6 + glissements de curseurs   <- le chiffre à battre
    cas limites : aucun clip sélectionné, clip pas en LOG (Rec.709), plusieurs couches de nodes,
                  grade déjà modifié à la main dans Resolve, clip changé pendant le réglage

F04 CopyCat : copier le rendu d'un film
    S03 -> S04 -> choisir la référence -> marque + profil -> (force, options peau) -> Create Grade
    -> Back to Grade -> S03 (ajuster)
    clics : 6
    cas limites : référence en N&B, référence très sombre, aucun visage, plusieurs visages,
                  référence déjà étalonnée vs. image plate, Restore original

F05 Ajouter une texture film
    S03 -> S05 -> choisir un module -> On -> curseurs -> (répéter pour en empiler)
    clics : 3 par module
    cas limites : grain sur un timelapse, ratio différent de la timeline, performance de lecture

F06 Palette de couleurs pour les réseaux
    S03 -> cocher Colour palette -> régler nombre / taille / position -> (nouvelle image) Update
    clics : 2

F07 Vidéo avant/après
    S03 -> cocher Before/After -> Animate Split -> durée -> rendu Resolve
    clics : 3

F08 Exporter un still
    S03 -> Still -> enregistrer
    clics : 2

F09 Le panneau suit Resolve (implicite, partout)
    l'utilisateur change de clip dans Resolve -> S03 recharge l'état de ce clip
    l'utilisateur modifie le grade à la main -> S03 se resynchronise et l'affiche

F10 Reset
    S03 -> Reset -> valeurs neutres
```

## Composants

| composant | variantes | états | utilisé dans |
| --- | --- | --- | --- |
| Ligne de curseur | bipolaire (centrée sur 0) ; unipolaire (0 → max) | défaut, glissé, valeur tapée, désactivé | S03, S05, S06, S08 |
| Champ numérique | collé à chaque curseur | normal, édition, valeur hors limites | S03, S04, S05 |
| Menu déroulant | look, marque, profil, module, couleur du Shifter | normal, ouvert, entrée grisée (non possédée) | S03, S04, S05 |
| Case à cocher | simple ; case + curseur (Glow) ; case + bouton (Palette + Update) | cochée, décochée, désactivée | S03, S04, S05, S08, S09 |
| Section repliable | LAB, LUT, Film Module, Palette | repliée, dépliée, avec résumé (« None », « 1 on ») | S03 |
| Bouton | principal (Create Grade), secondaire (Reset, Still, Back to Grade), lien (Purchase) | normal, survol, désactivé | toutes |
| Ligne de statut | info, avertissement | texte court en bas du panneau | S03, S04 |
| Sélecteur de fichier | image (JPEG/PNG) ; produits (.drx/.cube/.zip) ; enregistrer un JPEG | — | S02, S04, S10 |
| Surimpression vidéo | barre de palette, ligne avant/après, bandes de ratio | rendue dans le viewer et à l'export | S08, S09, S05 |

## Modèle de données déduit

```
Licence       clé, email, produits_possédés[], date_activation
              preuve : S01 (« email + key »), page 10 (« licence key stays the same »), page 26
              confiance : moyenne (on ne voit pas s'il y a une limite de machines)

Produit/Look  id, nom, type (powergrade | effet | lut), fichier (.drx/.cube), empreinte_contenu, possédé
              preuve : S02 (« verifies them by content… fakes get rejected »), page 23 (liste et types)
              confiance : haute

ProfilCaméra  marque, profil_log, gamut, transformation_vers_espace_de_travail
              preuve : S03 « Input Panasonic / Profile V-Log / V-Gamut », S04 « Color Space Transform »
              confiance : haute

ÉtatGradeClip id_timeline_item, look_id, marque, profil, curseurs{exposure, highlight, shadow,
              contrast, temperature, tint, shifter{couleur:{r,g,b}}, saturation, skin_tone, film_look},
              nr, grain, glow{on, valeur}, lab{halation, bloom}, lut, modules_film[],
              palette{on, n, taille, position, couleurs[]}, avant_apres{on, animé, durée}
              preuve : S03 (« Loaded this clip's grade », resynchro si modifié dans Resolve)
              confiance : haute pour les champs ; **supposition** pour le stockage (labels de nodes,
              fichier annexe ou version de couleur nommée)

ModuleFilm    type (compressor | bleach | black | vignette | grain | ratio | film_stock | format | lab),
              on, paramètres{}   (ex. grain : format 8/16/35/65 mm, ISO 50–500 ; film_stock : 3 émulations ;
              format : Regular 8 → IMAX, gate weave, flicker, perforations, poussière ; vignette : ovale/rect)
              preuve : pages 7–8, 16
              confiance : haute

TâcheCopyCat  image_référence, marque, profil, force (%), séparer_peau, protéger_peau, nodes_résultat
              preuve : S04 (page 5), pages 6, 15
              confiance : haute

Réglages      dossier des LUT, langue, dernier état du panneau
              confiance : supposition
```

Relations : Licence 1-n Produit ; Clip 1-1 ÉtatGradeClip ; ÉtatGradeClip n-1 Look, n-1 ProfilCaméra, 1-n ModuleFilm ; TâcheCopyCat → produit un ÉtatGradeClip.

## Contraintes techniques (API publique de Resolve, source 4)

Ce que l'API de scripting permet sur la page Color, et donc ce qu'un clone peut piloter :

- **Oui :** `Graph.SetLUT(node, chemin)` (+ `Project.RefreshLUTList()`), `TimelineItem.SetCDL` (slope / offset / power / saturation par node), `Graph.ApplyGradeFromDRX` (appliquer un PowerGrade/still), `Graph.SetNodeEnabled`, `GetNodeLabel`, `GetToolsInNode`, `ResetAllGrades`, `CopyGrades`, versions de couleur, groupes de couleur (pré/post clip), `Project.ExportCurrentFrameAsStill`, `Timeline.GetCurrentVideoItem`, `TimelineItem.ExportLUT`. Fusion est entièrement scriptable (comps, outils, animation).
- **Non :** créer des nodes, régler les roues / courbes / qualifieurs, régler les paramètres d'un OFX ou d'un DCTL dans un node.

Conséquence : la technique la plus probable (déduite de l'API, **pas** de leur code) est un **PowerGrade gabarit** avec des nodes fixes et nommés. Les curseurs écrivent dans ces nodes : en CDL pour exposition / température / teinte / saturation, et en **LUT ou DCTL régénéré à chaque changement** (fichier réécrit puis `SetLUT`) pour le reste. Les modules film / LAB sont des DCTL activés ou désactivés. CopyCat analyse l'image exportée et la référence en Python, puis écrit le résultat dans ces mêmes nodes. Le prototype doit **mesurer la latence** de ce cycle.

## Matrice des fonctions

Voir `features.csv`. Must : 22, should : 14, could : 3, skip : 11.

## Hors périmètre (ne peut pas ou ne doit pas être cloné)

- **Les 10 looks Sotoi** (The Gradefather, Node On The Go, Moonight…) et leurs packs de LUT : c'est leur contenu. Le clone utilise les looks de STV.
- **Les noms de pellicules Kodak** (Vision3, Portra) comme noms de produit : ce sont des marques. On garde l'émulation, avec des noms à nous (à voir en `/replica-brand`).
- **Leurs images de démo** (dont un plan de film Marvel) : jamais réutilisées.
- **Leur nom, leur logo, la marque « Pocket »** et leur système de licence qui vérifie leurs produits.
- **Les autres plugins Pocket** (SFX, Text, Overlay) et l'abonnement Pocket CC : ce sont d'autres produits.
- **Le support de la version Mac App Store de Resolve** : impossible pour tout le monde (sandbox).

## Taille

Écrans 10 (+2 web reportés), parcours 10, entités 7.
Points difficiles :
1. **Curseurs en temps réel avec une API limitée** (pas de roues, pas de paramètres OFX/DCTL) : DCTL/LUT régénérés + CDL. Latence à prouver dès le premier prototype.
2. **CopyCat** : transfert de couleur depuis une référence (statistiques en espace perceptuel, ajustement d'un LUT 3D), avec séparation peau / décor et protection des tons chair (détection de visage). Le plus dur.
3. **Effets film rendus à l'export** : grain qui bouge d'une image à l'autre, halation, bloom, formats (gate weave, poussière), et des surimpressions (palette, avant/après animé) qui doivent passer au rendu alors que la page Color n'est pas animable par l'API. Il faudra probablement passer par Fusion ou par des clips au-dessus.

Taille : **L** (un trimestre) pour tout. La tranche cœur (S03 sans CopyCat ni Film Module) est **M** (quelques semaines).
