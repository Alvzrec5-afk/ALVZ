# ALVZ.REC — Galeries clients

Guide de mise en route et d'utilisation (sans ligne de commande).

---

## 1. Mise en route (une seule fois)

### 1.1 Créer votre compte administrateur (Supabase)

1. Ouvrez https://supabase.com/dashboard et cliquez sur votre projet.
2. Menu de gauche : **Authentication** → **Users** → bouton **Add user** → **Create new user**.
3. Saisissez votre e-mail et un mot de passe solide, cochez **Auto Confirm User**, puis **Create user**.
4. Menu de gauche : **Authentication** → **Sign In / Providers** : désactivez **Allow new users to sign up**, puis **Save**.
5. Dites à Claude « compte créé » : il vous donnera les droits d'administrateur.

### 1.2 Récupérer les informations Oracle

Dans la console Oracle Cloud :

| Information | Où la trouver |
|---|---|
| **Namespace** | Menu ☰ → Storage → Buckets → votre bucket → champ « Namespace » |
| **Nom du bucket** | Même page, en haut |
| **Région** (ex. `eu-paris-1`) | En haut à droite de la console (cliquez sur la région pour voir son identifiant) |
| **Access Key** + **Secret Key** | Avatar (en haut à droite) → My profile → **Customer secret keys** |

> La « Secret Key » n'est affichée qu'une fois, au moment de sa création. Si vous ne l'avez plus, générez-en une nouvelle.

### 1.3 Variables d'environnement sur Netlify

Netlify → votre site → **Site configuration** → **Environment variables** → **Add a variable** → **Add a single variable**.
Pour chaque ligne : collez le nom exact, la valeur, laissez « Same value for all deploy contexts », puis **Create variable**.
Cochez **Contains secret values** pour les lignes marquées 🔒.

| Nom | Valeur | |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ayootztgiuhpqgeckwfu.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → *Publishable key* (`sb_publishable_…`) | |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → *Secret keys* → (`sb_secret_…`) | 🔒 |
| `ORACLE_NAMESPACE` | Namespace Oracle | |
| `ORACLE_REGION` | ex. `eu-paris-1` | |
| `ORACLE_BUCKET` | Nom du bucket | |
| `ORACLE_ACCESS_KEY_ID` | Access Key de la Customer Secret Key | 🔒 |
| `ORACLE_SECRET_ACCESS_KEY` | Secret Key de la Customer Secret Key | 🔒 |
| `GALLERY_SECRET` | Une longue phrase aléatoire (40 caractères ou plus) | 🔒 |
| `STORAGE_LIMIT_GB` | *Optionnel.* Limite de stockage en Go (20 par défaut, l'offre gratuite d'Oracle) | |
| `SMTP_USER` | *Optionnel, pour la page Clients.* Votre adresse Gmail d'envoi | |
| `SMTP_PASS` | *Optionnel.* Mot de passe d'application Google (voir « E-mails aux clients ») | 🔒 |

Après tout changement de variable : **Deploys** → **Trigger deploy** → **Deploy site** (les variables ne sont prises en compte qu'au déploiement suivant).

### 1.4 Vérifier le stockage

Connectez-vous à `https://VOTRE-SITE/admin`, puis en bas de la page **Galeries**, cliquez sur **Vérifier le stockage Oracle**.
Le message doit indiquer « Connexion Oracle opérationnelle ». Sinon, le message explique ce qui bloque.

---

## 2. Utilisation au quotidien

### Vidéos (clips)

Dans une galerie : onglet **Vidéos** (icône ▶) → **Ajouter des vidéos**. Faites-le depuis votre Mac (Chrome ou Safari à jour) :
votre ordinateur prépare automatiquement jusqu'à quatre qualités (4K si l'original est en 4K et dure moins de 10 minutes, puis 1080p, 720p, 480p) puis envoie tout, original compris.
Gardez la page ouverte pendant la préparation.

- Chaque client reçoit la qualité adaptée à sa connexion et à son écran (il peut aussi la choisir).
- **Copier le lien de la vidéo** : le client arrive directement sur le lecteur.
- Le client peut laisser des **commentaires sur la timeline** (prénom seulement) ; vous les voyez dans la fiche de la vidéo,
  un clic sur l'heure vous amène au bon moment.
- **Autoriser le téléchargement** se règle vidéo par vidéo.
- **Filigrane** : si le filigrane de la galerie est activé au moment de l'envoi, il est incrusté dans la vidéo.
  Activé plus tard, il s'affiche par-dessus le lecteur et l'original n'est plus téléchargeable.
- Activité : lectures, part regardée en moyenne, téléchargements (sans demander d'e-mail).

### E-mails aux clients

Le studio → **Clients** liste toutes les adresses laissées par vos clients (sélection de favoris, téléchargements).
Écrivez un message : il part depuis votre Gmail, **un e-mail séparé par personne** (chacun ne voit que sa propre adresse),
avec vos coordonnées et un lien de désinscription en bas. Les envois apparaissent dans « Envoyés » de votre Gmail.

Pour l'activer, une seule fois :
1. Compte Google → **Sécurité** → activez la **Validation en deux étapes**.
2. Ouvrez https://myaccount.google.com/apppasswords → nom « ALVZ galeries » → **Créer** → copiez les 16 lettres.
3. Sur Netlify, ajoutez `SMTP_USER` (votre adresse Gmail) et `SMTP_PASS` (les 16 lettres, 🔒), puis redéployez.

Gmail accepte environ 500 destinataires par jour.

### Créer une galerie
1. `https://VOTRE-SITE/admin` → **Nouvelle galerie**.
2. Nom du client, date, et si besoin : mot de passe, date d'expiration, filigrane, ambiance claire ou sombre.
3. **Créer la galerie**.

### Envoyer des photos
- Glissez un **dossier** dans le cadre : chaque sous-dossier devient une collection (ex. `Cérémonie`, `Portraits`, `Soirée`).
- Ou glissez des **photos seules** : elles vont dans la collection sélectionnée sous le cadre.
- Les boutons **Choisir des photos** / **Choisir un dossier** font la même chose sans glisser.
- Gardez la page ouverte pendant l'envoi. Si la connexion coupe, l'envoi reprend tout seul.
- Si la page a été fermée, renvoyez simplement le même dossier : les photos déjà en ligne sont ignorées (doublons), les autres reprennent.
- Formats acceptés : JPEG, PNG, WebP (HEIC uniquement depuis Safari).

### Organiser
- **Trier par date de prise de vue** : remet la collection dans l'ordre chronologique (EXIF).
- Glissez une photo pour la déplacer.
- Survolez une photo : **Couv.** la choisit comme couverture, **✕** la supprime.
- **+ Collection**, **Renommer**, **← Déplacer / Déplacer →** pour gérer les onglets.

### Partager
- Bouton **Copier le lien** en haut de la galerie, puis collez-le dans votre e-mail ou message au client.
- Si le lien a circulé par erreur : **Paramètres** → **Nouveau lien** (l'ancien cesse de fonctionner).

### Voir les favoris
- Onglet **Favoris** : la sélection de chaque client, par e-mail.
- **Copier les noms de fichiers** : liste à coller dans Lightroom pour retrouver les photos choisies.

### Côté client
- Couverture plein écran, onglets par collection, visionneuse plein écran (flèches du clavier, glisser sur mobile).
- Cœur sur une photo → le client saisit son e-mail une fois → sa sélection est enregistrée (onglet **Ma sélection**).
- Icône ↓ : télécharger la collection ou toute la galerie en ZIP. Dans la visionneuse : téléchargement HD de la photo.
- Galerie expirée → page « Galerie expirée ».

---

## 3. Sécurité (résumé)

- Les clés Oracle et la clé secrète Supabase ne sont lues que par le serveur Netlify, jamais envoyées au navigateur.
- Le bucket reste privé : chaque image est servie par une URL signée valable quelques heures.
- Base de données : règles RLS actives sur toutes les tables. Les visiteurs n'y ont aucun accès direct.
- Mot de passe de galerie : vérifié sur le serveur, stocké chiffré (bcrypt).
- Filigrane : incrusté dans les fichiers d'aperçu eux-mêmes (pas un simple calque), les originaux restent intacts.
