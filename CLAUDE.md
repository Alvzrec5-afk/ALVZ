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

## Ce qui existe (plan rapide)

Détail complet (fichiers, tables, choix techniques) : **`docs/carte-du-code.md`** — ne lire que la section utile
(chercher le mot-clé avec Grep), pas tout le fichier.

- **Studio `/admin`** (`components/admin/`) : galeries photo façon Pixieset (`gallery-manager.tsx` : Photos, Design,
  Paramètres, **Activités** = téléchargements par personne `downloads-panel.tsx` + favoris), projets vidéo
  (`videos-panel.tsx`), Clients & e-mails (envoi Gmail), Coordonnées, Corbeille (30 jours), suppressions en arrière-plan
  (`background.tsx`).
- **Galerie client `/g/<lien>`** (`components/gallery/`) : couverture, grilles, visionneuse, ZIP, favoris, option
  « e-mail demandé avant téléchargement », vidéos `/g/<lien>/v/<id>` protégées contre les aspirateurs (URL demandées
  par le lecteur, `fromOwnPage`).
- **Tableaux façon Milanote `/admin/boards`** (`components/board/board-canvas.tsx`, gros fichier : chercher par mot-clé) :
  cartes note / image / liste / colonne / flèche (courbe) / planche / couleur / lien / grille / commentaire, couleurs,
  taille du texte, rognage, clic droit, copier-coller entre onglets, annuler, capture PNG, partage client `/t/<lien>`,
  modèle des nouveaux tableaux (6 planches). Serveur : `lib/boards.ts` (`cleanData` filtre chaque champ de carte :
  **tout nouveau champ de `BoardData` doit y être ajouté**).
- **Médias** : photos préparées dans le navigateur (`lib/client/image.ts`), vidéos H.264 (`lib/client/video.ts`).
- **Base** : schéma de référence `supabase/schema.sql` (à tenir à jour après chaque migration).

## En attente / idées discutées

État au 18-19 oct. 2026 : tout est publié (dernier code : rognage, flèches courbes, taille du texte, capture,
clic droit). Capture nette au zoom + correctif photos noires sur iPhone : **committé en local, pas encore publié** (19 oct.).

- **À vérifier en vrai par le propriétaire** : capture d'un tableau avec de vraies photos Oracle (si elles sortent
  grises → CORS : passer les images par une route du site ou régler le bucket) ; défilement au doigt sur une grille ;
  Ctrl + clic sur Mac ; envoi d'un clip (H.264/4K) ; e-mail de test Gmail ; images « disparues » des tableaux
  revenues (réparation automatique `objectSize`).
- E-mails qui partent en spam : conseils donnés. Proposé, non fait : test vers n'importe quelle adresse
  (mail-tester.com), envois étalés dans le temps ; plus tard, adresse à son domaine (Brevo / Google Workspace +
  SPF/DKIM/DMARC).
- Tableaux, idées : aperçu des liens (Pinterest, Instagram), cocher les listes du studio côté client, temps réel au
  lieu du rafraîchissement, appui long au téléphone = menu du clic droit (iPhone n'a pas de clic droit).
- Lenteur : surtout la distance Netlify (USA) ↔ Supabase (Irlande) + réveil des fonctions.
  Changer la région Netlify = offre Pro seulement. Option proposée, non décidée : déplacer la base
  Supabase en us-east-1 (nouveau projet, recopie des données, 3 variables Netlify à changer).
- Côté propriétaire : supprimer le compte de test `e2e-test@alvz.invalid` dans Supabase et vérifier
  que les inscriptions sont désactivées.
