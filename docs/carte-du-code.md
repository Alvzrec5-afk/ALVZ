# Carte détaillée du code ALVZ.REC

**Studio (`/admin`)** — `components/admin/admin-shell.tsx` : menu à gauche sur ordinateur (Galeries,
Vidéos, Coordonnées, Outils → Clients & e-mails, Déconnexion) ; sur mobile logo centré + menu ☰
(logo seul dans une galerie). Installable comme appli (`public/studio.webmanifest`, `app/admin/layout.tsx`).
- Galeries photo : `app/admin/(protected)/page.tsx` + `gallery-grid.tsx` (grille 3/ligne ou liste,
  recherche, tri, jauge de stockage en bas en Go).
- Page galerie façon Pixieset : `gallery-manager.tsx` (barre du haut, colonne gauche avec couverture,
  onglets, `collections-sidebar.tsx` glisser-déposer), `photos-panel.tsx` (envoi, tri, couverture,
  suppression, visionneuse `admin-viewer.tsx`), `design-panel.tsx` (12 couvertures, polices, couleurs,
  grilles), `settings-panel.tsx` (lien, mot de passe, expiration, téléchargements (option « Demander l'e-mail avant le téléchargement » = `galleries.download_email_required` : même fenêtre / liste `favorite_lists` que les favoris, contrôlée par `needsDownloadEmail` dans les routes download et archive), favoris, filigrane,
  carte de visite), activité (favoris + téléchargements : `downloads-panel.tsx` = chiffres, photos les plus
  téléchargées, « Par personne » (photos + ZIP par e-mail), historique). Onglet « Activités » (icône `FeedIcon`, plus de cœur), comme Pixieset : à gauche « Activité de
  téléchargement » / « Activité des favoris », à droite `downloads-panel.tsx` façon Pixieset (onglets Galerie = ZIP /
  Photo unique / Vidéo unique, tableau E-mail · Fichier · Résolution · Date, toujours une ligne par personne avec détail
  au clic, tri récent/ancien, export CSV).
- Vidéos : `app/admin/(protected)/videos/` — projets vidéo = galeries avec `kind = 'video'`
  (onglets Vidéos / Design / Paramètres). `videos-panel.tsx` : envoi, fiche vidéo (lien direct,
  téléchargement autorisé ou non, commentaires, activité ; liste « Téléchargements » = `video_events` kind download
  avec `email` si connu ; l'option « Demander l'e-mail » s'applique aussi aux vidéos, `video-page.tsx` réutilise `EmailDialog`).
- Clients & e-mails : `app/admin/(protected)/clients/` — adresses issues des favoris et
  téléchargements, envoi Gmail un e-mail par personne (`app/api/admin/mail`), désinscription
  (`/desinscription`, `/api/unsubscribe`).
- Coordonnées : carte de visite (`studio_settings.contact`) : WhatsApp +33 6 11 32 94 06,
  Instagram et TikTok `alvz.rec`.

**Tableaux façon Milanote (`/admin/boards`)** — moodboards, listes de plans, préparation de tournage.
`components/board/board-canvas.tsx` : grande surface (déplacer, zoom molette/pincement, double-clic = note),
cartes note (6 couleurs, liens cliquables), image (envoi direct Oracle, 1600 px, `boards/<tableau>/<carte>.jpg`),
liste à cocher, colonne (glisser une carte dedans), flèche (outil Flèche : carte de départ puis d'arrivée).
Enregistrement automatique groupé (`components/board/sync.ts`, une op par carte ; `keepSize` garde la taille d'image
quand une modif suivante remplace l'op — sinon l'image « disparaissait » ; `loadBoardItems` répare les images à 0 octet
dont le fichier existe chez Oracle, `objectSize`), rafraîchissement toutes les 30 s seulement si la
page est visible et utilisée (crédits Netlify). Plus de choix de modèle : tout nouveau tableau (et le « Tableau de
préparation » d'une galerie) est une **copie du « Modèle des nouveaux tableaux »** (`boards.is_template`,
`templateBoardId` dans `lib/boards.ts`, page `/admin/boards/model`, encadré sur la liste des tableaux) : le
propriétaire y remplit une fois sa check-list, son budget… Le modèle est créé la première fois avec
`starterKit()` (`lib/board-types.ts`, `fillStarter`) : 6 planches remplies — 1. BUDGET, 2. BRIEF /
APPELS CLIENT, 3. MOODBOARD (bandeaux, inspi musique / vidéos, 6 cases photo vides, 4 couleurs), 4. SHOT LIST,
5. CHECK-LIST TOURNAGE, 6. TIMELINE TOURNAGE ; pictogrammes au trait (`data.icon` → `BOARD_ICONS`, jamais d'emoji).
Case photo vide = carte image à 0 octet : un clic (studio) y met une image (`fillImage`). Carte lien vide avec
consigne (`data.text`).
Serveur : `lib/boards.ts` (`applyBoardOps` valide tout ; un client ne touche qu'à ses cartes), actions
`app/admin/board-actions.ts`, API `app/api/admin/boards/[id]` et `/image`. Relié à une galerie : menu « Plus » →
« Tableau de préparation » (`openGalleryBoard`, créé au premier clic). Partage client : `/t/<lien>` (lien secret,
option « le client peut ajouter ses idées », prénom demandé une fois, cookie signé `b_<tableau>`), API `app/api/b/[slug]`.
Import Milanote (`lib/client/milanote.ts`, bouton « Importer » / menu « Plus ») :
export Markdown → titres = colonnes, paragraphes = notes, cases à cocher = listes ; ZIP (« Generate ZIP ») lu
dans le navigateur → un dossier d'images = une colonne (fusionnée avec la colonne du même nom). Format Milanote
non documenté : lecture tolérante, à ajuster avec un vrai export du propriétaire si besoin. Positions et flèches
ne sont pas dans les exports Milanote.
Sous-tableaux (« Planche » chez Milanote) : carte `board` (`data.boardId`) → tableau enfant (`boards.parent_id`),
créé par `applyBoardOps` au premier envoi de la carte, supprimé avec elle (`purgeBoard` récursif) ; double-clic
ou « Ouvrir » pour entrer, fil d'Ariane dans `board-header.tsx` ; partage et galerie = ceux du tableau principal ;
client : `/t/<lien>/b/<id>` (`resolveSharedBoard` vérifie que le sous-tableau est bien sous le tableau partagé).
Cartes `color` (teinte + nom) et `link` (lecteur YouTube/Vimeo/Spotify/SoundCloud/Deezer via `linkEmbed`, chargé
seulement au clic sur ▶ ; coller un lien crée une carte lien). Sélection multiple : glisser sur le fond à la souris
(cadre), Maj + clic, Cmd/Ctrl + A ; le tableau se déplace alors à la molette / pavé tactile, espace + glisser ou
bouton du milieu. Au doigt (téléphone / tablette, studio et clients) : glisser fait toujours défiler le tableau,
même sur une carte ; un toucher sélectionne la carte, et seule une carte sélectionnée se déplace (`startDrag`).
Couleurs : toute carte (sauf flèche) a un fond `data.color` (teinte douce, `NOTE_COLORS`) ou `data.hex` (couleur
pleine `SOLID_COLORS` ou libre) ; texte blanc/encre auto (`inkOn`), ou forcé par `data.ink` (« Texte : Auto / Noir /
Blanc » dans la palette) ; `inkStyle` redéfinit aussi --ink / --muted / --line dans la carte (colonne : en-tête seul) ; palette dans la barre de la carte et pour une
sélection multiple. Outils de la barre de gauche : clic = carte au centre, glisser-déposer = carte à l'endroit
lâché (ou rangée dans la colonne visée).
Listes : `TodoEntry.indent` (sous-élément ; Tab / Maj + Tab dans la ligne). Grille : `data.title` (titre au-dessus),
colonne d'en-tête « Fait » = cases à cocher, `data.calc = "budget"` (TOTAL = tarif × jours, ligne TOTAL = somme,
BUDGET DU CLIENT saisi, BÉNÉFICE = budget − total ; `budgetFigures` dans `board-canvas.tsx`).
Carte `table` (bouton « Tableau », = Tableau de Milanote) : `data.cells` (lignes × colonnes, 1re ligne en gras),
Tab / Entrée pour avancer, boutons + / − Ligne / Colonne ; tableaux Markdown « | a | b | » de l'import Milanote.
Le bouton des sous-tableaux s'appelle « Planche » (comme Milanote). Pictogramme d'une planche (`data.icon`, `BOARD_ICONS`) : toujours affiché, même si elle contient des images (sinon aperçu des images) ; choisi seulement par le studio (bouton Pictogramme de la barre de la carte ; `applyBoardOps` garde l'ancien pour un client). Le canevas annule tout défilement natif
(`onScroll`) : sinon le focus d'un champ décale la vue.
Clic droit (aussi deux doigts au trackpad, Ctrl + clic sur Mac, `isContextClick`) : `ContextMenu` — sur une carte :
Ouvrir / Ouvrir le lien / Voir l'image / Modifier / Rogner / Redresser la flèche, Copier, Couper, Coller, Dupliquer
(Cmd + D, `serializeSelection` sans toucher au presse-papiers), premier / arrière-plan (`restack`), Supprimer ; sur le
fond : Coller ici (`pasteCards(raw, at)`), nouvelle note / liste ici, tout sélectionner, tout voir, capture, annuler.
Taille du texte : `data.fontSize` (multiplie 13 px, `FONT_SIZES`, bouton « AA » de la barre). Image rognée :
`data.crop` (fractions, non destructif, `CropEditor` avec formats 1:1, 4:5…). Flèche courbe : `data.bend`
(décalage perpendiculaire, poignée verte au milieu, double-clic = droite ; courbe quadratique dans `geom.arrows`).
Case photo vide (`data-slot`) : clic → `SlotPicker` (photos déjà posées dans tout le projet, tableau principal + planches,
`projectImages` via `GET /api/admin/boards/[id]/library`, la planche ouverte d'abord) ou « Importer depuis l'ordinateur »
(`fillTarget` + `fileRef`). Choisir une photo = copie Oracle côté serveur (`fillSlotFrom`, `POST …/library`). Une photo
(ou vidéo) glissée depuis l'ordinateur sur la case la remplit (`onDrop`, surlignage `slotOver`).
Bouton « Images projet » (studio, à côté d'« Image » qui reste l'import classique) : même fenêtre (`imagePick`), photos
et vidéos du projet (`LibraryImage.video`) ; un choix crée une carte avec
`copyOf` (le serveur copie le fichier, comme un collage) ; « Importer depuis l'ordinateur » garde l'endroit (`imageDrop`).
Menu « … » de la barre (`moreTools`, panneau `more`) : **Croquis** = note avec `data.sketch` (traits, `SketchEditor` /
`SketchView`, `cleanSketch` côté serveur) ; **Nuancier** = une carte couleur (code HEX sur la couleur) + `ColorPicker` (dégradé, teinte, pipette `EyeDropper`, R V B,
HEX ; un clic sur la couleur le rouvre) ; **Document** = note avec `data.doc` { title, html } (carte fermée : titre + nombre de
mots ; `DocEditor` plein écran, `execCommand`, export PDF par impression / Word .doc / .txt ; HTML nettoyé côté serveur par
`cleanDoc` avec `sanitize-html`, styles `.doc-body` dans `globals.css`) ; **Importer doc** = fichier joint ; **Document** / **Audio** = carte
`image` avec `data.media` (« document » | « audio »), `fileName`, `fileType` (50 Mo, studio, `readBoardFile`, extensions
`BOARD_DOCUMENT_EXTENSIONS`) ; document : carte déplaçable, « Ouvrir » = `DocViewer` en grand (PDF / texte dans le
navigateur, Word / Excel / PowerPoint via la visionneuse Office en ligne, sinon téléchargement), `src` = lecture, `download` =
URL qui force le téléchargement ; **Carte** = lien avec `data.place` (plan Google Maps
intégré, « Explorer » pour le manipuler ; `place` gardé même vide) ; **Vidéo** = sélecteur vidéo ; **Titre** = note
`data.heading` (grand texte sans fond). Champ de fichier `mediaRef` + `mediaPick` ; genre deviné par `mediaKindOf`.
Vidéos (studio) : carte `image` avec `data.video = true` (mp4 / mov / webm, 50 Mo au plus, `MAX_BOARD_VIDEO_BYTES`
dans `lib/board-types.ts`), envoyée telle quelle (`readBoardVideo`, `prepareMedia`) au même endroit qu'une image
(`boardImageKey`, Content-Type vidéo à l'envoi). Lue en boucle, muette, `crossOrigin="anonymous"` ; bouton ▶ =
plein écran avec le son (`openVideoWithSound`). Pas de rognage ; exclue des aperçus de planches ; un client ne peut pas
en poser. Capture : vidéos figées, image en cours redessinée (`readableVideo`), jamais clonées par html-to-image.
Capture : bouton appareil photo en bas à droite → `capture()` avec `html-to-image` (cadrage sur toutes les cartes,
jusqu'à 6× la taille écran et 64 Mpx ; sans barres d'outils). Le navigateur est testé (`maxCanvasRows`) : si une seule
toile ne suffit pas (iPhone ~12-16 Mpx), dessin **par bandes** assemblées au fil de l'eau par l'encodeur JPEG maison
`lib/client/jpeg-stream.js` (d'après jpeg-js, licence BSD gardée). Les photos des cartes image (`img[data-cap]`)
sont redessinées par-dessus depuis le fichier (nettes, jamais noires sous Safari) sauf si une carte plus haute les couvre.. Au doigt, glisser sur une case de grille / case à cocher fait défiler.
Liste des tableaux (`boards-list.tsx`) : grille ou liste à petites vignettes (choix mémorisé, `boards-view`) ;
vignette = couverture choisie (`boards.cover_key`, envoi via `/api/admin/boards/[id]/cover`, `setBoardCover`) sinon
le nom du projet en grand. Menu ⋯ (`board-card-menu.tsx`) Renommer / Dupliquer / Choisir ou retirer la couverture / Supprimer ; « Dupliquer le tableau »
aussi dans le menu Plus. `duplicateBoard` (`lib/boards.ts`) copie planches, cartes (ids renouvelés, flèches et
colonnes reliées) et images (CopyObject Oracle) ; copie non partagée ; une planche copiée reste dans son parent.
Carte `comment` : messages dans la table `board_comments` (ajout seul, jamais écrasés par l'enregistrement des
cartes) ; studio = logo ALVZ.REC, client = prénom + initiale ; API `…/comments` (studio et client). Option de
partage « Le client peut tout modifier » (`boards.client_can_edit`, avec « ajouter ses idées ») : le client
déplace / modifie / supprime toutes les cartes et a aussi Colonne, Couleur, Flèche (pas Planche ni Importer).

**Corbeille (`/admin/trash`, menu Outils)** — supprimer une galerie, un projet vidéo ou un tableau (principal) met
`deleted_at` (`trashGallery`, `deleteBoard`) ; restaurer = `deleted_at` à null ; « Supprimer définitivement » =
ancienne purge (`/api/admin/purge` par lots, `purgeTrashedBoard`) ; au-delà de 30 jours, effacement à l'ouverture
de la corbeille (`trash-list.tsx`). Tout ce qui lit galeries/tableaux filtre `deleted_at is null` (y compris les
pages publiques). Les éléments dans la corbeille comptent toujours dans le stockage.
**Annuler / rétablir dans un tableau** (Cmd + Z, Cmd + Maj + Z, boutons ↶ ↷) : historique dans `board-canvas.tsx`
(`push` → étape après 0,6 s de calme, `replay`). Pour que ce soit fiable, supprimer une carte met
`board_items.deleted_at` (et `boards.deleted_at` pour une planche) ; la remettre l'efface ; `purgeDeletedItems`
efface pour de bon (images, planches) ce qui a plus de 24 h, à l'ouverture du tableau dans le studio.
Copier / couper / coller (Cmd + C / X / V) : `copySelection` met les cartes (+ contenu des colonnes + flèches
entre elles) dans le presse-papiers avec la marque `ALVZ-BOARD:` ; `pasteCards` recrée tout avec de nouveaux ids,
même dans un autre tableau ou un autre onglet (événement `copy` natif + `localStorage` `alvz-board-clip` en secours) ; `copyOf` dit au serveur de dupliquer l'image (CopyObject) ou la planche
(`duplicateBoard` avec `parentId` / `id`). Studio seulement pour images et planches ; discussion non copiée.
Navigation : dans un tableau (plein écran), bouton ☰ « Studio » à gauche de la barre (`board-header.tsx`).
Page client `/t/…` vue par le studio connecté (`isStudioSession`, `lib/auth.ts`) : logo → /admin et bouton
« Retour au studio » (ouvre le même tableau dans le studio) ; les clients ne voient rien de plus.

**Suppressions fluides** (`components/admin/background.tsx`) : `deleteInBackground(ids, tâche, fin)` masque tout
de suite (`useHidden`, filtré dans `gallery-grid`, `gallery-manager`, liste des tableaux, corbeille) et fait le
travail en arrière-plan ; pastille « Suppression en cours… » (`BackgroundStatus` dans `admin-shell`) ; en cas
d'échec, l'élément réapparaît. Utilisé pour galeries, photos, collections, vidéos, tableaux, corbeille.

**Galerie client (`/g/<lien>`)** — `components/gallery/client-gallery.tsx` : couverture animée,
en-tête collant (Contacter, ♡ sélection, menu), grilles (`justified-grid.tsx`), visionneuse
(`lightbox.tsx`), ZIP, favoris (e-mail demandé), onglet « Vidéos », carte de visite. Thème qui suit
le mode clair/sombre de l'appareil. Projet vidéo d'un seul clip → ouverture directe du lecteur.
Vidéo : `/g/<lien>/v/<id>` (`video-page.tsx`, `components/video/`).
Anti-aspiration (yt-dlp, sites « téléchargeur ») : la page client n'écrit aucune adresse de fichier vidéo
(`toVideoView(..., { slug })` → `url` vide + `stream`) ; le lecteur les demande en POST à
`/api/g/<lien>/videos/<id>/stream` (en-tête `x-alvz-player`, `fromOwnPage` : Sec-Fetch-Site / Origin du site),
les redemande si elles expirent. Le téléchargement vidéo exige aussi `fromOwnPage`. Impossible d'empêcher à 100 %
un enregistrement d'écran ou un expert avec les outils du navigateur.

**Photos** : variantes faites dans le navigateur (`lib/client/image.ts`) : thumb 640, web 2000,
+ versions filigranées ; original conservé.

**Vidéos** : `lib/client/video.ts` (Mediabunny 1.61.0, WebCodecs) prépare 4K (si original 4K et
< 10 min) / 1080p / 720p / 480p en H.264 + image d'aperçu, filigrane incrusté si la galerie l'a
activé à l'envoi. Lecteur `video-player.tsx` : qualité auto (connexion + taille d'écran, baisse sur
coupures, montée si le réseau suit), commentaires sur la timeline (prénom seulement), plein écran.
Le Chromium du conteneur ne sait pas encoder/décoder le H.264 : tester la chaîne en VP9/WebM
(remplacer temporairement `"avc"`), jamais committer ce changement.

**Tables Supabase** : `admins`, `galleries` (+ `design` jsonb, `kind`), `collections`, `photos`,
`favorite_lists`, `favorites`, `downloads`, `studio_settings`, `mail_unsubscribes`, `mail_campaigns`,
`videos`, `video_comments`, `video_events`, `boards`, `board_items`, fonction `storage_usage()` (compte aussi les
images des tableaux). Schéma de référence :
`supabase/schema.sql` (à tenir à jour après chaque migration).


## Vitesse (19 oct. 2026)

- `adminApiWith(work)` (`lib/auth.ts`) : le contrôle « est l'admin » part en même temps que les lectures (RLS protège).
- Déclencheur SQL `board_items_touch_board` : toute modification de carte met à jour `boards.updated_at` (plus d'écriture
  manuelle dans `applyBoardOps`). `boardVersion` = plus récente date du tableau et de ses planches.
- Rafraîchissement : `GET …?v=<version>` répond `{ unchanged: true }` sans relire les cartes ; rechargement complet au moins
  une fois par heure (adresses d'images valables 3 h). Réparation des cases vides chez Oracle seulement à l'ouverture
  (`loadBoardItems(…, { repair: true })`).
- Envoi photo de galerie : vérifications (galerie, doublon, stockage, collection) en parallèle.
