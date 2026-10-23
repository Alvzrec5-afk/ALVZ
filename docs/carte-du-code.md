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
Le client n'ajoute que des **notes, images, couleurs et commentaires**, plus le menu « … » sans envoi de fichier (croquis,
nuancier, document, carte Google Maps, titre) : `CLIENT_KINDS` / `clientMay` dans `lib/boards.ts` (plan = « lien » avec `place`),
`clientCanAdd` et outils `client: true` dans `board-canvas.tsx`. Pas d'« Images projet », ni liste, lien, tableau, colonne, flèche ;
un lien collé devient une note.
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
Bouton « Images projet » : **panneau flottant** (`SlotPicker floating`) déplaçable par sa barre du haut, redimensionnable
par le coin en bas à droite (place et taille gardées dans `localStorage` `alvz-image-panel`, `clampPanel` le garde dans la zone du tableau — son parent —, jamais sous la barre du haut ni les onglets), qui ne se ferme
qu'avec sa croix (ni clic à côté ni Échap) ; le bouton de la barre l'ouvre / le ferme ; ↻ recharge la liste. Clic sur une image =
carte au milieu de l'écran (`placeLibraryImage`) ; à la souris, glisser une image sur le tableau ou dans une colonne la pose là
(`startToolDrag` avec vignette dans le fantôme ; au doigt, glisser fait défiler la liste). Avant :
Bouton « Images projet » (studio, à côté d'« Image » qui reste l'import classique) : même fenêtre (`imagePick`), photos
et vidéos du projet (`LibraryImage.video`) ; un choix crée une carte avec
`copyOf` (le serveur copie le fichier, comme un collage) ; « Importer depuis l'ordinateur » garde l'endroit (`imageDrop`).
Banque d'images : tableau à part `boards.is_library` (`libraryBoardId`, page `/admin/boards/library`, encadré sous le
modèle, absent de la liste des tableaux). Ses images (et celles de ses planches, `libraryBoards`) arrivent après celles du
projet dans `projectImages` avec `library: true` ; `SlotPicker` les montre dans l'onglet « Banque d'images » ;
`fillSlotFrom` accepte une photo de la banque ; un choix = copie du fichier (`copyOf`), la banque n'est pas modifiée.
Copie d'office : `applyBoardOps` repère les photos tout juste envoyées par le studio (taille qui passe de 0 à > 0, pas une
copie `copyOf`, ni vidéo ni document) et `addToLibrary` les copie (fichier Oracle + carte) dans la banque, en grille de
`LIBRARY_COLUMNS` ; rien si le tableau est la banque. Corbeille dans l'onglet banque de `SlotPicker` (sauf ouvert depuis la
banque, `inLibrary`) → `DELETE …/library` → `deleteLibraryImage` (fichier et carte effacés pour de bon ; les tableaux gardent leur copie).
Menu « … » de la barre (`moreTools`, panneau `more`, chaque entrée glissable sur le tableau ou dans une colonne comme
les outils de la barre : `drop`, `startToolDrag`, `mediaDrop` pour les fichiers) : **Croquis** = note avec `data.sketch` (traits, `SketchEditor` /
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


**Hors connexion (studio, application iPhone / Mac)** — niveau 1 : `public/sw.js` (service worker, `VERSION`) garde
une copie des pages `/admin` (réseau d'abord, copie seulement sans réseau), des fichiers `/_next/static` et des photos
Oracle (max 1500) ; message `warm` = préparer tout un projet (chaque planche + ses photos), `clear` = tout effacer
(déconnexion). `components/admin/offline-support.tsx` : `OfflineSupport` (dans la mise en page du studio : enregistre
le service worker, prépare Accueil + Tableaux toutes les 6 h), `BoardOffline` (page d'un tableau : projet toutes les 6 h,
planche courante toutes les 30 min), `clearOffline()`. Page jamais ouverte → petite page « Hors connexion ».
Niveau 2 (modifier en avion) : la file de `sync.ts` est gardée dans `localStorage` (`alvz-pending:<endpoint>`) et
repart au retour du réseau, même pour une planche fermée (`flushOrphans`, lancé à l'ouverture du studio et à l'événement
`online`). L'état complet du tableau est aussi gardé dans IndexedDB (`components/board/offline-store.ts`, base
`alvz-boards`) et réaffiché si plus récent que la page servie. Chaque op porte `base` = `updated_at` de la carte connue ;
`applyBoardOps` (`lib/boards.ts`) compare : si la carte a changé entre-temps (le client), on garde **sa** version et on
ajoute **la nôtre en copie** à +40 px (fichier image copié aussi) ; pas de copie pour planche / flèche / commentaire ;
suppression ignorée. Réponse `{ at, conflicts }`, message dans le tableau. Hors connexion : outils qui demandent le
réseau cachés (`NEEDS_NETWORK`), envoi de fichiers refusé avec un message, bandeau « Hors connexion ».

**Tableaux en direct** — canal Supabase Realtime public `board:<id>` (prop `liveId` de `BoardCanvas`, studio et
vue client). Deux sources de signal « changed » `{ at }` (aucun contenu) : le déclencheur SQL `private.board_items_broadcast`
(`realtime.send`, à chaque enregistrement de cartes, déjà en base) et la page qui vient d'enregistrer (`sync.onSaved` →
`channel.send`). À réception, relecture du tableau 350 ms plus tard (`refresh(true)`, même au repos ; pendant un
déplacement : à la fin). Nos propres enregistrements (même `at`) sont ignorés. En direct, la relecture régulière passe
de 30 s à 90 s (`LIVE_POLL_MS`). Sans direct (réseau, réglage Realtime) : rien ne casse, relecture toutes les 30 s.
Faux conflits évités dans `sync.ts` : la version connue ne recule jamais (`learn`) et une modification faite pendant
un envoi repart de notre version (`base` = `json.at`).
**Accueil (`/admin`)** — `components/admin/studio-dashboard.tsx` : 8 compteurs (liens), `StorageMeter` avec
`parts` (`storageParts`, couleurs `--series-1…4` de globals.css, vérifiées daltoniens), galeries les plus lourdes
(`storageUsage().perGallery`), récents. Chiffres : `studioOverview()` (`lib/usage.ts`) → fonction SQL `studio_overview()`
(jsonb ; espace calculé comme `storage_usage`, banque d'images = arbre du tableau `is_library`). Liste des galeries photo :
`/admin/galleries` (page `galleries/page.tsx`) ; `/admin/accueil` (ancienne adresse) redirige vers `/admin`.
Alerte de stockage : `StorageAlert` (`storage-meter.tsx`), en haut de l'Accueil, des galeries et des vidéos dès 75 % de la
limite (`STORAGE_LIMIT_GB`, **20 Go** par défaut = plafond d'un compte Oracle « Toujours gratuit », Object + Archive combinés ;
au-delà, à la fin de l'essai, Oracle supprime les données ; au-delà, les envois sont refusés), rouge dès 95 % ;
conseille de supprimer d'anciennes galeries ou de passer Oracle en « Pay As You Go » puis de relever `STORAGE_LIMIT_GB`.
Espace réel : `lib/usage.ts` `storageUsage` prend le plus grand de la base (`storage_usage`) et du total réel du bucket
(`oracleTotal`, liste de tous les objets + envois en morceaux non terminés, `unstable_cache` 1 h, tag `oracle-usage`) ;
`untracked` = « Fichiers oubliés » (6e part de la jauge, gris). Les refus d'envoi utilisent aussi ce total.
Analyse / nettoyage : `lib/storage-audit.ts` (`auditStorage`, `cleanStorage`), route `app/api/admin/storage-audit` (GET analyse,
POST nettoie puis `refreshOracleTotal`), bouton `components/admin/storage-audit.tsx` sous la jauge de l'Accueil. Orphelin = clé
rangée comme photo / vidéo / image de tableau / couverture / photo du site dont la ligne n'existe plus ; supprimé seulement après
24 h ; autres clés jamais touchées ; garde-fou : rien n'est supprimé si plus de la moitié des fichiers semblent orphelins.
Limite choisie dans le studio : colonne `studio_settings.storage_limit_gb` (sinon `STORAGE_LIMIT_GB`, sinon 20 Go), sélecteur
`components/admin/storage-limit.tsx` sous la jauge de l'Accueil (« 20 Go (gratuit) » + lien « Augmenter » qui montre les autres choix de `lib/storage-limits.ts` : 20/50/100/200/500 Go),
action `app/admin/storage-actions.ts` `setStorageLimit`. `storageUsage` rend aussi `free` (20 Go gratuits) : trait sur la jauge
et coût estimé au-delà (`ORACLE_PRICE_PER_GB_MONTH`, indicatif).
Nouvelle mise en page (21 oct.) : `app/admin/(protected)/page.tsx` prépare les projets récents (galeries, projets vidéo et
tableaux mêlés, 6 au plus, avec couverture : photo de couverture ou 1re photo en taille web, affiche de la 1re vidéo, couverture
du tableau ou 1re image de ses planches) et l'activité des 14 derniers jours (photos envoyées, vues vidéo, cartes de tableaux,
images de la banque). `studio-dashboard.tsx` : indicateurs avec chiffres qui montent (`CountUp`) et petites courbes qui se
dessinent (`Spark`, animation `drawLine` de globals.css), cartes images avec badge coloré (téléphone : lignes à vignette),
jauge en demi-cercle (`StorageArc`), « Ce qui prend le plus de place », carte Oracle (limite + analyse en version `compact`).
`components/admin/dashboard-parts.tsx` : `CountUp`, `DashboardActions` (boutons de création, « + » en menu au téléphone,
recherche ⌘K / Ctrl+K parmi galeries, vidéos et tableaux).
Téléphone (21 oct.) : `admin-shell.tsx` affiche des onglets en bas de l'écran (`TABS` = Accueil, Galeries, Vidéos, Tableaux
+ « Plus » qui fait monter le reste du menu, animation `sheetUp`), sauf dans un tableau ou une galerie ouverte ; variable CSS
`--tabbar` pour remonter les bulles d'état (`background.tsx`) au-dessus de la barre.

**Site alvzrec.com (`/admin/site`)** — la page d'origine du site (ancien compte Netlify) est gardée telle quelle dans
`lib/site-template.ts` (`String.raw`, ni accent grave ni `${` dedans). Ses deux scripts d'origine sont en `type="text/plain"
data-boot` ; un petit script final récupère le contenu (`window.SITE_INLINE` si servie par `/site`, sinon `fetch` de
`https://alvzgalleries.com/api/site`, repli sur le contenu d'origine après 6 s ou en cas d'erreur), pose `window.SITE`, remplit
les `img[data-slot]` (bts1-3, kit) puis exécute les scripts. `lib/site.ts` : `loadSiteContent`, `siteData`, `fillSiteHtml`,
`siteFileForOldAccount` (téléchargé par `/api/admin/site/page`), `youtubeId`, `youtubeInfo` (oEmbed, « Artiste - Titre (Clip) »).
Actions `app/admin/site-actions.ts` (clips, photos, échange de place `swapSitePhotos`, emplacements fixes `slot`). Interface
`components/admin/site-manager.tsx`. Photos : `site/items/<id>.jpg` + `-thumb.jpg` (Oracle), comptées dans `storage_usage` et
la catégorie « Site » de la jauge (5e couleur `--series-5`).
Coulisses et matériel (21 oct.) : plus d'emplacements fixes. `GROUP_CATEGORIES` (`lib/site.ts`) : photos en nombre libre,
chacune son ordre (`commitSitePhoto` ajoute à la fin, flèches = `swapSitePhotos`). Page : 3 premières coulisses en grand
(`data-slot` bts1-3), les autres dans `#btsMore` (bande qu'on fait défiler) ; 1re photo du matériel à côté de la liste, les autres
dans `#kitMore`. Liste du matériel : colonne `site_settings.kit` (jsonb `[{type, model}]`, `cleanKit`, 12 lignes au plus,
`saveSiteKit`) ; `type` = clé traduite par la page (`KIT_TYPES` : kit_a7, kit_a67, kit_drone, kit_lens, kit_mic, kit_gimbal,
kit_light) ou texte libre. `siteData` envoie `bts`, `kitPhotos`, `kit` en plus de `slots` (gardé pour l'ancienne page).

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
Onglets des planches (studio) : `BoardTabs` sous `BoardHeader` — tableau principal puis ses planches de premier niveau
(tri par nom, numéros compris), lien direct ; dans une planche d'une planche, l'onglet de sa planche de départ est allumé.
Données : `projectPlanches` → fonction SQL `board_planches(target)` (remonte au tableau principal, puis toutes ses planches).
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
- Fonctions SQL `board_path(target)` (chemin jusqu'au tableau principal, du haut vers le bas, toutes colonnes) et
  `board_tree(root)` (tableau + planches non supprimées) : utilisées par `boardAncestors` et `projectBoards` (ancienne
  boucle niveau par niveau gardée en secours). La page d'un tableau prend le tableau principal dans le chemin (plus de
  requête en plus dans une planche). `purgeDeletedItems` et `repairEmptyImages` (ex-option `repair` de `loadBoardItems`)
  tournent dans `after()` : l'ouverture n'attend plus Oracle.
- Déclencheur SQL `board_items_touch_board` : toute modification de carte met à jour `boards.updated_at` (plus d'écriture
  manuelle dans `applyBoardOps`). `boardVersion` = plus récente date du tableau et de ses planches.
- Rafraîchissement : `GET …?v=<version>` répond `{ unchanged: true }` sans relire les cartes ; rechargement complet au moins
  une fois par heure (adresses d'images valables 3 h). Réparation des cases vides chez Oracle seulement à l'ouverture
  (`loadBoardItems(…, { repair: true })`).
- Envoi photo de galerie : vérifications (galerie, doublon, stockage, collection) en parallèle.


**Logos** — `components/wordmark.tsx` : `variant="rec"` (défaut, ALVZ.REC : galeries, vidéos, tableaux partagés, site) ou
`variant="studio"` (ALVZ .STUDIO : barre et menu du studio, connexion, haut de l'Accueil, en-tête d'un tableau). Fichiers
`public/brand/studio-logo-{white,dark}.png`, icônes `public/studio-icon.png` / `studio-apple-icon.png` (métadonnées de
`app/admin/layout.tsx` + `studio.webmanifest`) et `desktop/icon.png` (app Mac). Fabriqués par `scripts/studio-logo.py`
(« ALVZ » repris du logo d'origine, « .STUDIO » redessiné en pochoir : `python3 scripts/studio-logo.py . <dossier>`).

**Finances (`/admin/finances`, 23 oct.)** — onglets `components/admin/finance/finance-tabs.tsx` : Vue d'ensemble (`page.tsx` :
encaissé de l'année / du mois, résultat, reste à encaisser, graphique `month-chart.tsx` encaissé vs dépenses par mois avec
tableau des chiffres, liste « À relancer » : retard, acompte non reçu, envoyé sans réponse depuis 7 jours), Devis
(`devis/page.tsx` + `quotes-list.tsx`, fiche `devis/[id]` = `quote-editor.tsx` : état, client, lignes, TVA (si réglages
« Je facture la TVA »), acompte %, dates, galerie liée + blocage, conditions, n° de facture externe, paiements reçus,
e-mail Gmail « Envoyer le devis » / « Relance de paiement » avec `{lien}`), Dépenses (`expenses-manager.tsx`),
Réglages (`finance-settings-form.tsx` → `studio_settings.finance` : nom, SIRET, adresse, TVA, IBAN, acompte, validité, conditions).
Calculs partagés : `lib/finance.ts` (centimes, `quoteTotals`, `quoteState`, `quoteBadge`) ; lectures : `lib/finance-data.ts` ;
actions : `app/admin/finance-actions.ts` (numéro suivant `D-AAAA-NNN`, paiement sur devis « envoyé » ⇒ « accepté »).
Page client `/d/<share_slug>` (`components/quote/quote-document.tsx`, client de service, brouillons cachés) : devis avec
mentions (SIRET, « TVA non applicable, art. 293 B du CGI »), « Enregistrer en PDF » = impression (`.no-print`), bon pour accord
en ligne (`app/d/[slug]/actions.ts`, seulement si envoyé et non expiré). Pas de vraie facture : elles restent dans un logiciel
agréé (facture électronique obligatoire pour les micro en 2027) ; seul leur numéro est noté.
Blocage : `galleries.payment_locked` (déclencheurs SQL) ; `findGalleryBySlug` renvoie alors `downloads_enabled = false`
(photos, ZIP, vidéos) et la galerie / la page vidéo affichent « Le téléchargement sera disponible dès le règlement ».
`buildMessage` (`lib/mailer.ts`) : sans `unsubscribeUrl`, pas de pied de désinscription (e-mails de devis).
Lien de paiement (23 oct.) : `studio_settings.finance.payment_link` (Réglages) ou `quotes.payment_link` (un devis, prioritaire ;
migration « quotes_payment_link ») ; https seulement (`cleanLink`). Page client : encadré « Payer l'acompte / le solde » +
bouton « Payer avec Revolut » (`amountDueNow`, `payService`) si devis envoyé ou accepté et reste > 0 ; lien ajouté aux e-mails.
