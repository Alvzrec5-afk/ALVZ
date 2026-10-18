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
`videos`, `video_comments`, `video_events`, fonction `storage_usage()`. Schéma de référence :
`supabase/schema.sql` (à tenir à jour après chaque migration).

## En attente / idées discutées

- Lenteur : surtout la distance Netlify (USA) ↔ Supabase (Irlande) + réveil des fonctions.
  Changer la région Netlify = offre Pro seulement. Option proposée, non décidée : déplacer la base
  Supabase en us-east-1 (nouveau projet, recopie des données, 3 variables Netlify à changer).
- À tester en vrai par le propriétaire : envoi d'un clip (H.264/4K), e-mail de test Gmail.
- Côté propriétaire : supprimer le compte de test `e2e-test@alvz.invalid` dans Supabase et vérifier
  que les inscriptions sont désactivées.
