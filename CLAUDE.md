# ALVZ.REC — galeries clients (mémoire du projet)

Ce fichier est lu automatiquement au début de chaque conversation. Il résume tout ce qui a été
construit et les règles de travail convenues avec le propriétaire.

## Le propriétaire et la façon de travailler

- Photographe / vidéaste (ALVZ.REC), **pas développeur**. Toujours répondre **en français**, simplement,
  étape par étape, en expliquant où cliquer. Il écrit vite et avec des fautes : interpréter avec bienveillance.
- **Ne jamais pousser sur GitHub sans qu'il dise « publie »** (ou « pousse », « envoie », « déploie »).
  Chaque push sur la branche lance une publication Netlify (~15 crédits sur 300/mois, offre gratuite).
  Regrouper les corrections, committer en local, puis pousser en une fois quand il le demande.
  Si un hook demande de pousser, refuser poliment en rappelant cette règle.
- Un commit qui ne touche que la doc (`CLAUDE.md`, `.claude/`, `docs/`) ne relance pas de publication
  (règle `ignore` dans `netlify.toml`). Pour un tel commit, ajouter aussi `[skip netlify]` au message.
- Avant de dire que c'est fait : `npm run typecheck` et `npm run build` doivent passer. Pour l'interface,
  vérifier visuellement avec Playwright (Chromium : `/opt/node-tools/node_modules/playwright/index.mjs`)
  sur une page temporaire `app/harness/...` avec de fausses données, puis la supprimer avant le commit.
- Le conteneur n'accède ni à Supabase, ni à Oracle, ni au site en ligne (proxy) : le dire honnêtement
  quand quelque chose n'a pas pu être testé en conditions réelles.
- Ne jamais demander ni afficher de secrets dans la conversation (il a déjà collé une clé par erreur une fois).

## Infrastructure

| Élément | Valeur |
|---|---|
| Site | https://alvzgalleries.com (aussi alvzgalleries.netlify.app) |
| Netlify | projet `alvzgalleries`, site id `16e80748-88fd-49c9-a6ae-b72b12bcfb17`, équipe `luis-alves-andrade`, offre gratuite (crédits), fonctions aux USA (iad) |
| Branche de production | `claude/alvz-photo-gallery-platform-tig9or` (dépôt `Alvzrec5-afk/ALVZ`) |
| Supabase | projet `ayootztgiuhpqgeckwfu` (eu-west-1, Irlande) — outils MCP Supabase disponibles |
| Stockage | Oracle Object Storage (API S3), région eu-paris-1, bucket privé, URL pré-signées |
| E-mails | Gmail `alvzrec.pro@gmail.com` via SMTP (mot de passe d'application) |

Variables Netlify (noms seulement) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`, `ORACLE_NAMESPACE`, `ORACLE_REGION`, `ORACLE_BUCKET`, `ORACLE_ACCESS_KEY_ID`,
`ORACLE_SECRET_ACCESS_KEY`, `GALLERY_SECRET`, `STORAGE_LIMIT_GB` (option), `SMTP_USER`, `SMTP_PASS`.

L'outil MCP Netlify `deploy-site` échoue depuis le conteneur (« fetch failed ») : pour relancer une
publication, demander au propriétaire **Deploys → Trigger deploy → Deploy project**. On peut lire l'état
des publications avec `netlify-project-services-reader` / `netlify-deploy-services-reader`.
Parfois Netlify marque un push « Skipped » : même solution (Trigger deploy).

## Pile technique

- Next.js 16 (App Router, `params` et `cookies()` asynchrones, Turbopack), React 19, Tailwind v4.
  Attention : les classes CSS maison non « layered » (`.btn`, `.icon-btn`, `.field`) l'emportent sur les
  utilitaires Tailwind (`hidden`, hauteurs…) → envelopper dans un `<span>` ou utiliser `style`.
- `@netlify/plugin-nextjs` déclaré dans `netlify.toml` (sans lui : 404).
- Supabase : client de session (`lib/supabase/server.ts`, RLS) pour le studio ; client « service »
  (`SUPABASE_SECRET_KEY`) seulement pour les pages publiques, après contrôle d'accès. RLS partout,
  fonction `private.is_admin()`. **Migrations additives uniquement** (les DROP ont fait échouer l'outil).
- Oracle : AWS SDK v3, `forcePathStyle`, `requestChecksumCalculation/responseChecksumValidation: "WHEN_REQUIRED"`.
  Envoi direct navigateur → Oracle (PUT pré-signé, multipart > 20 Mo, morceaux de 10 Mo, reprise).
- Cookies signés HMAC (`GALLERY_SECRET`, `lib/tokens.ts`) pour l'accès aux galeries et les favoris.
- Auth studio : `lib/auth.ts` — `requireAdminPage()` (session seule, rapide), `requireAdminLayout()`
  (contrôle admin dans la mise en page), `requireAdminApi()` (routes et actions).

## Ce qui existe (carte du code)

**Studio (`/admin`)** — `components/admin/admin-shell.tsx` : menu à gauche sur ordinateur (Galeries,
Vidéos, Coordonnées, Outils → Clients & e-mails, Déconnexion) ; sur mobile logo centré + menu ☰
(logo seul dans une galerie). Installable comme appli (`public/studio.webmanifest`, `app/admin/layout.tsx`).
- Galeries photo : `app/admin/(protected)/page.tsx` + `gallery-grid.tsx` (grille 3/ligne ou liste,
  recherche, tri, jauge de stockage en bas en Go).
- Page galerie façon Pixieset : `gallery-manager.tsx` (barre du haut, colonne gauche avec couverture,
  onglets, `collections-sidebar.tsx` glisser-déposer), `photos-panel.tsx` (envoi, tri, couverture,
  suppression, visionneuse `admin-viewer.tsx`), `design-panel.tsx` (12 couvertures, polices, couleurs,
  grilles), `settings-panel.tsx` (lien, mot de passe, expiration, téléchargements, favoris, filigrane,
  carte de visite), activité (favoris + téléchargements).
- Vidéos : `app/admin/(protected)/videos/` — projets vidéo = galeries avec `kind = 'video'`
  (onglets Vidéos / Design / Paramètres). `videos-panel.tsx` : envoi, fiche vidéo (lien direct,
  téléchargement autorisé ou non, commentaires, activité).
- Clients & e-mails : `app/admin/(protected)/clients/` — adresses issues des favoris et
  téléchargements, envoi Gmail un e-mail par personne (`app/api/admin/mail`), désinscription
  (`/desinscription`, `/api/unsubscribe`).
- Coordonnées : carte de visite (`studio_settings.contact`) : WhatsApp +33 6 11 32 94 06,
  Instagram et TikTok `alvz.rec`.

**Tableaux façon Milanote (`/admin/boards`)** — moodboards, listes de plans, préparation de tournage.
`components/board/board-canvas.tsx` : grande surface (déplacer, zoom molette/pincement, double-clic = note),
cartes note (6 couleurs, liens cliquables), image (envoi direct Oracle, 1600 px, `boards/<tableau>/<carte>.jpg`),
liste à cocher, colonne (glisser une carte dedans), flèche (outil Flèche : carte de départ puis d'arrivée).
Enregistrement automatique groupé (`components/board/sync.ts`), rafraîchissement toutes les 30 s seulement si la
page est visible et utilisée (crédits Netlify). Modèles : `lib/board-types.ts` (moodboard, shooting, mariage, clip).
Serveur : `lib/boards.ts` (`applyBoardOps` valide tout ; un client ne touche qu'à ses cartes), actions
`app/admin/board-actions.ts`, API `app/api/admin/boards/[id]` et `/image`. Relié à une galerie : menu « Plus » →
« Tableau de préparation » (`openGalleryBoard`, créé au premier clic). Partage client : `/t/<lien>` (lien secret,
option « le client peut ajouter ses idées », prénom demandé une fois, cookie signé `b_<tableau>`), API `app/api/b/[slug]`.
Import Milanote (`lib/client/milanote.ts`, bouton « Importer » / menu « Plus », modèle « Depuis Milanote ») :
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
bouton du milieu ; au doigt, glisser déplace toujours le tableau.
Couleurs : toute carte (sauf flèche) a un fond `data.color` (teinte douce, `NOTE_COLORS`) ou `data.hex` (couleur
pleine `SOLID_COLORS` ou libre) ; texte blanc/encre auto (`inkOn`) ; palette dans la barre de la carte et pour une
sélection multiple. Outils de la barre de gauche : clic = carte au centre, glisser-déposer = carte à l'endroit
lâché (ou rangée dans la colonne visée).
Carte `table` (bouton « Tableau », = Tableau de Milanote) : `data.cells` (lignes × colonnes, 1re ligne en gras),
Tab / Entrée pour avancer, boutons + / − Ligne / Colonne ; tableaux Markdown « | a | b | » de l'import Milanote.
Le bouton des sous-tableaux s'appelle « Planche » (comme Milanote). Le canevas annule tout défilement natif
(`onScroll`) : sinon le focus d'un champ décale la vue.
Liste des tableaux : menu ⋯ (`board-card-menu.tsx`) Renommer / Dupliquer / Supprimer ; « Dupliquer le tableau »
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

**Galerie client (`/g/<lien>`)** — `components/gallery/client-gallery.tsx` : couverture animée,
en-tête collant (Contacter, ♡ sélection, menu), grilles (`justified-grid.tsx`), visionneuse
(`lightbox.tsx`), ZIP, favoris (e-mail demandé), onglet « Vidéos », carte de visite. Thème qui suit
le mode clair/sombre de l'appareil. Projet vidéo d'un seul clip → ouverture directe du lecteur.
Vidéo : `/g/<lien>/v/<id>` (`video-page.tsx`, `components/video/`).

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

## En attente / idées discutées

- **Migration à appliquer au moment de publier** (pas encore faite sur Supabase) : le dernier bloc de
  `supabase/schema.sql` (« Corbeille » : colonnes `deleted_at` sur `galleries`, `boards`, `board_items` + index).
  Puis retirer cette ligne.

- Tableaux, idées pour la suite : annuler / rétablir, commentaires sur une carte, aperçu des liens
  (Pinterest, Instagram), cocher les listes du studio côté client, temps réel au lieu du rafraîchissement.

- Lenteur : surtout la distance Netlify (USA) ↔ Supabase (Irlande) + réveil des fonctions.
  Changer la région Netlify = offre Pro seulement. Option proposée, non décidée : déplacer la base
  Supabase en us-east-1 (nouveau projet, recopie des données, 3 variables Netlify à changer).
- À tester en vrai par le propriétaire : envoi d'un clip (H.264/4K), e-mail de test Gmail.
- Côté propriétaire : supprimer le compte de test `e2e-test@alvz.invalid` dans Supabase et vérifier
  que les inscriptions sont désactivées.
