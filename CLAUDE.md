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
- Avant de dire que c'est fait : `npm run typecheck` et `npm run build` doivent passer.
  Si `npm run build` échoue sur les polices Google (« next/font/google », souci du conteneur, pas du code),
  vérifier avec `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt npx next build --webpack`. Pour l'interface,
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
| Supabase | projet **`eioymzumjfgpsetncicl`** « ALVZ Studio (US) » (us-east-1, à côté des fonctions Netlify) depuis le 21 oct. 2026 — outils MCP Supabase disponibles. Ancien projet `ayootztgiuhpqgeckwfu` (Irlande) gardé comme sauvegarde, à supprimer plus tard |
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
  Depuis le 30 oct. 2026, Supabase ne donne plus d'accès API automatique aux **nouvelles** tables de `public` : toute
  migration qui crée une table doit ajouter `grant select, insert, update, delete on public.<table> to authenticated, service_role;`
  (pas de grant à `anon` : le site n'en a pas besoin). Les tables existantes gardent leurs droits.
- Oracle : AWS SDK v3, `forcePathStyle`, `requestChecksumCalculation/responseChecksumValidation: "WHEN_REQUIRED"`.
  Envoi direct navigateur → Oracle (PUT pré-signé, multipart > 20 Mo, morceaux de 10 Mo, reprise).
- Cookies signés HMAC (`GALLERY_SECRET`, `lib/tokens.ts`) pour l'accès aux galeries et les favoris.
- Auth studio : `lib/auth.ts` — `requireAdminPage()` (session seule, rapide), `requireAdminLayout()`
  (contrôle admin dans la mise en page), `requireAdminApi()` (routes et actions).

## Ce qui existe (plan rapide)

Détail complet (fichiers, tables, choix techniques) : **`docs/carte-du-code.md`** — ne lire que la section utile
(chercher le mot-clé avec Grep), pas tout le fichier.

- **Studio `/admin`** (`components/admin/`) : Finances (`/admin/finances`, devis / paiements / dépenses), galeries photo façon Pixieset (`gallery-manager.tsx` : Photos, Design,
  Paramètres, **Activités** = téléchargements par personne `downloads-panel.tsx` + favoris), projets vidéo
  (`videos-panel.tsx`), Clients & e-mails (envoi Gmail), Coordonnées, Corbeille (30 jours), suppressions en arrière-plan
  (`background.tsx`).
- **Galerie client `/g/<lien>`** (`components/gallery/`) : couverture, grilles, visionneuse, ZIP, favoris, option
  « e-mail demandé avant téléchargement », vidéos `/g/<lien>/v/<id>` protégées contre les aspirateurs (URL demandées
  par le lecteur, `fromOwnPage`).
- **Tableaux façon Milanote `/admin/boards`** (`components/board/board-canvas.tsx`, gros fichier : chercher par mot-clé) :
  cartes note / titre / croquis / document écrit / image (ou vidéo, son, document ≤ 50 Mo, studio) / plan Google Maps / liste / colonne / flèche (courbe) / planche / couleur / lien / grille / commentaire, couleurs,
  taille du texte, rognage, clic droit, copier-coller entre onglets, annuler, capture PNG, partage client `/t/<lien>`,
  modèle des nouveaux tableaux (7 planches, dont 5. STORYBOARD). Serveur : `lib/boards.ts` (`cleanData` filtre chaque champ de carte :
  **tout nouveau champ de `BoardData` doit y être ajouté**).
- **Médias** : photos préparées dans le navigateur (`lib/client/image.ts`), vidéos H.264 (`lib/client/video.ts`).
- **Base** : schéma de référence `supabase/schema.sql` (à tenir à jour après chaque migration).

## En attente / idées discutées

État au 19 oct. 2026 : tout est publié (dernier code : capture nette au zoom jusqu'à 6× / 64 Mpx, aussi sur iPhone grâce au
dessin par bandes + JPEG maison, « Enregistré » et flèches annuler cachés au téléphone, petites vidéos dans les tableaux).
Publié le 19 oct. : menu « … » (croquis, nuancier, document, audio, carte, vidéo, titre) ; cases photo vides :
choix parmi les photos du projet + glisser-déposer.
Publié aussi : bouton « Images projet » (photos et vidéos du projet) ; cases vides proposent aussi les vidéos.
Publié aussi (19 oct.) : documents importés déplaçables, ouverts en grand dans le site (+ Télécharger) ;
menu « … » façon Milanote : Nuancier = une couleur + sélecteur, Document = document écrit (éditeur), Importer doc = fichier.
Publié aussi : entrées du menu « … » glissables sur le tableau / dans une colonne.
Publié (19 oct.) : Banque d'images (tableau `boards.is_library`, colonne déjà ajoutée en base ; `/admin/boards/library`,
encadré sur la liste des tableaux ; onglet « Banque d'images » dans « Images projet » et les cases photo vides ;
chaque photo envoyée par le studio dans un tableau y est copiée d'office ; corbeille sur les photos de la banque dans la fenêtre).
Publié (19 oct.) : page **Accueil** (centre de contrôle : compteurs, stockage détaillé, plus gros projets, récents) ;
jauge de stockage détaillée par catégorie via la fonction SQL `studio_overview()` (déjà en base).
Publié aussi : barre du haut du studio mobile fixe (`sticky`, sous l'heure de l'iPhone dans l'app) ; l'Accueil est `/admin` (demandé par le propriétaire) ; la liste des galeries passe à
`/admin/galleries` (toujours « Galeries » dans le menu) ; `/admin/accueil` redirige vers `/admin`.
Publié (19 oct.) : « Images projet » des tableaux en panneau flottant (déplaçable, redimensionnable, reste ouvert,
glisser une image sur le tableau à la souris).
Publié aussi : onglets des planches sous la barre d'un tableau (`components/admin/board-tabs.tsx`, fonction SQL `board_planches`
déjà en base) : tableau principal + planches, un clic pour passer du moodboard à la shot list (studio seulement, pas la vue client).
Publié (19 oct.) : nouvelle mise en page du site alvzrec (`lib/site-template.ts`, bloc CSS « MISE EN PAGE ») : ordinateur =
clips en grille de 3 (extrait YouTube au survol seulement, plus de bascule 3D), photos sur 5 colonnes, Coulisses + Caméras côte à
côte (section `.duo`), bouton « Réserver » (WhatsApp, traduit) dans la barre ; téléphone = clips sur une colonne plus serrés, moins de vide.
Le propriétaire doit reposer l'index.html sur l'ancien compte pour que alvzrec.com change (design modifié).
Publié (19 oct.) : **site alvzrec.com géré depuis le studio** (option A choisie : le domaine reste sur l'ancien compte
Netlify). Page d'origine (un seul index.html, design inchangé) dans `lib/site-template.ts` ; elle lit son contenu sur
`alvzgalleries.com/api/site` (CORS, cache CDN 5 min) puis lance ses scripts (`data-boot`), contenu d'origine si le studio ne
répond pas. Studio → Site (`/admin/site`) : clips YouTube (coller le lien, titre/artiste repris de YouTube via oEmbed),
photos par catégorie (sport, portrait, evenement, bapteme, mariage ; envoi Oracle 2400 px + vignette 1024 px), 3 coulisses + 1 matériel,
WhatsApp = Coordonnées. Le propriétaire doit **une fois** télécharger l'index.html (lien dans Studio → Site) et le glisser sur
l'ancien compte (Deploys). Tables `site_categories` (slug), `site_items` (external_url = photos imgur d'origine), `site_clips`,
déjà en base et remplies avec le contenu d'origine. `/site` sert aussi la page (contenu dans la page) et `next.config` renvoie
alvzrec.com vers `/site` si un jour le domaine est déplacé (option B). Inutilisés pour l'instant : colonnes hero/textes de
`site_settings` et table `site_messages` (premier essai).
Publié aussi : ouverture des tableaux plus rapide — fonctions SQL `board_path` / `board_tree` (déjà en base) pour le chemin
et les planches en une requête ; ménage des cartes supprimées et réparation des cases vides (`repairEmptyImages`) lancés après l'affichage (`after`). Le modèle en base a déjà reçu « 5. STORYBOARD » (planches suivantes renumérotées 6 et 7).

Publié (20 oct.) : **studio hors connexion** — tableaux consultables et modifiables
sans réseau (avion), modifications gardées sur l'appareil puis envoyées au retour ; si le client a modifié la même carte,
sa version est gardée et la nôtre ajoutée à côté. Détail : `docs/carte-du-code.md`, section « Hors connexion ».

Publié (20 oct.) : correction du faux message « modifiée ailleurs » et
**tableaux en direct** (modifications du client visibles tout de suite au studio et inversement ; déclencheur SQL
`board_items_live_*` déjà appliqué en base). À vérifier en vrai (Mac + iPhone, note client visible en ~1 s ; sinon activer l'accès public Realtime dans Supabase) (Realtime injoignable depuis le conteneur).

Publié (20 oct.) : clés publiques de Supabase Auth (jwks) gardées un jour dans le cache
de Next (`unstable_cache`, `lib/auth.ts`) au lieu d'être redemandées à chaque démarrage de fonction (jusqu'à 16 s le 20 oct.).
Publié aussi : le client n'ajoute plus que notes, images, couleurs, commentaires et le menu « … » (croquis, nuancier, document, carte, titre ; pas d'envoi de fichier), règle aussi côté serveur.
Lenteur du 20 oct. vers 22 h UTC : encore Supabase (auth/token 18 s, REST 8 s, base au repos) ; conseillé : Supabase Pro.

Publié (21 oct.) : alerte de stockage (Accueil, galeries, vidéos) dès 75 % ; limite par défaut **20 Go**
(plafond Oracle « Toujours gratuit », Object + Archive combinés ; au-delà, données supprimées à la fin de l'essai) ; jauge et refus d'envoi sur l'espace **réel** du bucket ;
bouton « Analyser l'espace réel chez Oracle » + « Libérer » (orphelins, envois interrompus). Le 21 oct. Oracle comptait 6,92 Go pour
~2,3 Go connus du studio. Compte Oracle passé en **« Paiement à l'utilisation »** le 21 oct. (plus de risque de suppression ; autorisation
bancaire de 93 € attendue en retour). Publié (21 oct.) : limite des envois choisie **dans le studio**
(Accueil, sous la jauge : 20/50/100/200/500 Go, colonne `studio_settings.storage_limit_gb` déjà en base US), trait des 20 Go
gratuits sur la jauge et coût estimé au-delà. Les 200 Go gratuits d'Oracle sont des disques de serveur, pas le stockage du studio : déconseillé.

Publié (21 oct.) : Studio → Site, coulisses et matériel en nombre libre (photos ajoutées, déplacées, retirées)
et liste du matériel modifiable (colonne `site_settings.kit`, déjà en base US). Le propriétaire doit **reposer l'index.html** sur
l'ancien compte Netlify pour que alvzrec.com montre les photos en plus et la nouvelle liste (l'ancienne page ne lit que 3 + 1 photos).

Publié (21 oct.) : **nouvelle page d'Accueil** dynamique (indicateurs animés + courbes 14 jours, projets
récents en images, jauge en demi-cercle, recherche ⌘K, menu « + » au téléphone).
Publié aussi : **onglets en bas de l'écran au téléphone** (Accueil, Galeries, Vidéos, Tableaux, Plus).
Publié aussi : logo **ALVZ .STUDIO** (même style pochoir) dans le studio, icônes de l'app iPhone et Mac ; ALVZ.REC gardé
pour les galeries, vidéos et pages des clients. Au push, `desktop/icon.png` relance la fabrication du .dmg (GitHub Actions).

Publié le 23 oct. : **Finances** (`/admin/finances`) — devis (page client `/d/<lien>` : PDF + bon pour
accord), paiements reçus, relances Gmail, dépenses, tableau de bord, galerie bloquée tant que le devis lié n'est pas payé
(`galleries.payment_locked`, migration « finances » déjà appliquée en base US). Les vraies factures restent dans un logiciel
agréé (seul leur n° est noté). Bouton « Payer » (lien Revolut / PayPal… dans Réglages ou par devis). E-mail au studio quand le client accepte ou clique « Payer ». Publié aussi : logo du studio au téléphone plus bas (Dynamic Island), Accueil sans titre « Studio » au téléphone.
Publié le 23 oct. : **Articles** (Finances → Articles, table `catalog_items` déjà remplie avec les 20 articles d'Abby) et « Ajouter un article » dans les devis. Publié aussi : **Calendrier** (`/admin/calendrier`, table `calendar_events` déjà en base) — options, date validée = galerie / projet vidéo / tableau (boutons à basculer, au choix) / devis créés, abonnement iPhone ; « Prix convenu » à la création d'une galerie.
Publié le 24 oct. : **calendriers importés** (iPhone iCloud / Google, lien iCal, lecture seule, table `calendar_sources` déjà en base) : leurs événements s'affichent en bleu et se transforment en événements du studio. Publié aussi : **remises** sur les devis (% ou €, migration « quotes_discount » déjà en base) et montants des e-mails mis à jour à l'envoi (`{montant}`, `{acompte}`, `{reste}`, `{echeance}`). Publié aussi : **nouvel Accueil « cockpit »** (idée 2 choisie : encaissé, à encaisser, options, prochaine prestation, 14 prochains jours, objectif du mois, derniers paiements, projets récents en lignes, stockage en bas). Publié aussi : galerie client sans zoom sur la grille (zoom normal du navigateur seulement dans la photo ouverte) ; option « téléchargement de toute la galerie » (ZIP) par galerie (`galleries.zip_enabled`, déjà en base). Publié le 25 oct. : envoi du devis **par message** (WhatsApp, SMS / iMessage, Partager) depuis le téléphone, champ téléphone du client (`quotes.client_phone`, déjà en base). Fait le 25 oct. (pas encore publié) : **PDF du devis** refait sur une page A4 façon Abby (`quote-print.tsx`) ; **glisser-déposer** de photos / vidéos depuis l'ordinateur n'importe où sur la page d'une galerie (onglets Photos et Vidéos, `components/admin/file-drop.tsx`) ; **suppression de vidéos** depuis la liste d'un projet (corbeille sur chaque vidéo + « Sélectionner » pour plusieurs, action `deleteVideos`) ; photos des galeries : plus de « Couv. » sur les vignettes ni dans la visionneuse (couverture seulement dans Design → Couverture), suppression = petite poubelle en haut à droite (vignette et visionneuse). Idée en attente : paiement **Stripe** au montant exact + paiement noté tout seul (Revolut Pro n'a pas d'API ; à décider plus tard). Détail : `docs/carte-du-code.md`, section « Finances ».

- **À faire par le propriétaire** : poser une fois l'index.html (Studio → Site → Relier alvzrec.com) sur l'ancien compte Netlify, puis vérifier alvzrec.com (clips, photos, coulisses).
- **À vérifier en vrai par le propriétaire** : nouvel Accueil (chiffres réels, objectif à régler dans Finances → Réglages) ; import calendrier iPhone / Google ; remise dans un devis ; zoom galerie (grille bloquée, photo ouverte zoomable) sur vrai iPhone ; option ZIP ; Calendrier (événement test confirmé → projets créés ; abonnement iPhone) ; Articles dans un devis ; Finances (remplir Réglages, devis test envoyé à soi-même, bon pour accord, bouton Payer, e-mails reçus, galerie bloquée puis débloquée) ; tableau modifié en mode avion puis réseau remis (iPhone et Mac), panneau « Images projet » (déplacer, agrandir, glisser une image sur le tableau), onglets des planches, Studio → Site (ajout d'un lien YouTube, envoi de photos), Accueil `/admin` (chiffres, stockage détaillé), Banque d'images (copie d'office d'une photo envoyée, onglet, corbeille), ouverture d'une planche ; menu « … » (plan Google Maps, envoi d'un PDF / MP3 vers Oracle), case photo vide (choix parmi les photos du projet) ;
  vidéo dans un tableau (envoi depuis l'iPhone, lecture, plein écran) ; capture d'un tableau **depuis l'iPhone** (nette au zoom ? photos présentes ? non testé sur vrai Safari) et avec de vraies photos Oracle (si elles sortent
  grises → CORS : passer les images par une route du site ou régler le bucket) ; défilement au doigt sur une grille ;
  Ctrl + clic sur Mac ; envoi d'un clip (H.264/4K) ; e-mail de test Gmail ; images « disparues » des tableaux
  revenues (réparation automatique `objectSize`).
- E-mails qui partent en spam : conseils donnés. Proposé, non fait : test vers n'importe quelle adresse
  (mail-tester.com), envois étalés dans le temps ; plus tard, adresse à son domaine (Brevo / Google Workspace +
  SPF/DKIM/DMARC).
- Tableaux, idées : aperçu des liens (Pinterest, Instagram), cocher les listes du studio côté client, temps réel au
  lieu du rafraîchissement, appui long au téléphone = menu du clic droit (iPhone n'a pas de clic droit).
- **Application Mac (.dmg)** : dossier `desktop/` (Electron : `main.js` ouvre alvzgalleries.com/admin, menu « Aller » ⌘1…⌘5,
  téléchargements dans « Téléchargements », liens externes dans le navigateur, page `offline.html`). Fabriquée par GitHub Actions
  (`.github/workflows/mac-app.yml`, Mac de GitHub, gratuit car dépôt public) à chaque changement de `desktop/` ; téléchargement :
  https://github.com/Alvzrec5-afk/ALVZ/releases/download/mac-app/ALVZ-Studio.dmg . Non signée (pas de compte Apple Developer) :
  premier lancement = clic droit → Ouvrir. `netlify.toml` ignore `desktop/` et `.github/` (pas de publication du site).
  Le studio change sans refaire l'application (elle affiche le site en ligne).
- Lenteur du 20 oct. : Supabase lui-même a eu des pics (journaux `edge_logs`, `response.origin_time` : jwks.json 27 s,
  /auth/v1/token 29 s, /rest/v1/admins 21 s ; p95 de 5 à 12 s à 9 h, 11 h et 12 h UTC) alors que les requêtes SQL restent < 10 ms
  et la base presque vide d'activité → instance gratuite partagée ou réseau Supabase, pas le code. Pas d'incident annoncé.
  Publié (20 oct.) : clics plus rapides — `HoverLink` (`components/admin/hover-link.tsx`) prépare la page au survol / toucher
  (Accueil, listes, onglets) au lieu de tout précharger ; `experimental.staleTimes` (dynamic 30 s) : une page vue il y a < 30 s
  se réaffiche sans serveur ; `BoardCanvas` reçoit `renderedAt` et relit les cartes à l'ouverture si la page vient de la mémoire (> 5 s).
  Publié (20 oct.) : `prefetch={false}` sur les liens de l'Accueil, des onglets de planches, des listes de galeries
  et de tableaux (l'Accueil lançait ~16 préchargements = 16 fonctions + appels Supabase à chaque ouverture).
  Pistes proposées : base Supabase aux USA (us-east-1, comme les fonctions Netlify) et/ou Supabase Pro (puissance dédiée).
- Lenteur : surtout la distance Netlify (USA) ↔ Supabase (Irlande) + réveil des fonctions. Mesures du 19 oct. :
  enregistrement d'un tableau ~1,4 s, envoi photo galerie prepare 1,8 s / complete 1,2 s, réveil ~3-4 s.
  Fait et publié (19 oct.) : déclencheur `board_items_touch_board` (la base date le tableau, déjà appliqué en base),
  rafraîchissement par version (`boardVersion`, `?v=`), `adminApiWith` (contrôle admin en parallèle), envois photo en parallèle.
  Changer la région Netlify = offre Pro seulement. Option proposée, non décidée : déplacer la base
  Supabase en us-east-1 (nouveau projet, recopie des données, 3 variables Netlify à changer).
- Déménagement aux USA (21 oct.) : 29 migrations rejouées (structure identique, vérifiée par empreintes), données recopiées
  de base à base (pg_net + fonction d'export à jeton, fermée ensuite), compte `alvzrec.pro@gmail.com` repris (même mot de passe) ;
  le compte de test `e2e-test@alvz.invalid` n'a pas été repris. Inscriptions désactivées et Site URL réglés par le propriétaire.
  L'outil MCP `execute_sql` attend une confirmation du propriétaire pour DELETE/UPDATE/TRUNCATE/REVOKE (sinon délai dépassé) ;
  la mise à jour des variables Netlify par MCP renvoie 422 : le propriétaire les change à la main.
