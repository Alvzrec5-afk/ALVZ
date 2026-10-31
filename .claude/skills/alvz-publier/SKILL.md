---
name: alvz-publier
description: Publier le site ALVZ.REC (alvzgalleries.com) quand le propriétaire dit « publie », « pousse », « envoie » ou « déploie » ; vérifier la publication Netlify et expliquer quoi faire si elle est « Skipped ». À utiliser aussi avant tout push sur ce dépôt.
---

# Publier ALVZ.REC

Règle : on ne pousse **que** quand le propriétaire le demande (chaque publication coûte ~15 crédits
Netlify sur 300 par mois). Entre-temps, les commits restent en local.

## Étapes

1. Vérifier que tout est propre :
   - `git status --short` (aucun fichier `app/harness/` ni `public/hx/` qui traîne) ;
   - `npm run typecheck` puis `npm run build` : les deux doivent passer.
2. Si `CLAUDE.md` liste une **migration à appliquer** : l'appliquer avec l'outil MCP Supabase `apply_migration`
   (projet `eioymzumjfgpsetncicl`, additive uniquement), vérifier avec `list_tables`, puis retirer la ligne de
   `CLAUDE.md` (dans le même commit que le reste).
3. **Le dernier commit poussé ne doit jamais contenir `[skip netlify]`** quand le push contient du code :
   Netlify regarde le message du dernier commit et saute alors toute la publication.
   Pousser : `git push -u origin claude/alvz-photo-gallery-platform-tig9or`
   (en cas d'erreur réseau, réessayer jusqu'à 4 fois : 2 s, 4 s, 8 s, 16 s).
4. Vérifier la publication avec les outils MCP Netlify (site id `16e80748-88fd-49c9-a6ae-b72b12bcfb17`) :
   - `netlify-project-services-reader` → `get-project` : regarder `currentDeploy.id` ;
   - `netlify-deploy-services-reader` → `get-deploy` : `commit_ref` doit être le dernier commit
     et `state` = `ready`. La construction prend 1 à 2 minutes.
5. Dire au propriétaire, en français simple :
   - si c'est en ligne : quoi tester et où (recharger avec Cmd + Maj + R) ;
   - si ce n'est pas encore le bon commit : regarder https://app.netlify.com/projects/alvzgalleries/deploys,
     ligne du haut ; « Skipped » → **Trigger deploy → Deploy project**.
   L'outil `deploy-site` ne marche pas depuis le conteneur : ne pas compter dessus.

## Commits de documentation seulement

Les changements limités à `CLAUDE.md`, `.claude/` ou `docs/` ne relancent pas de publication
(`ignore` dans `netlify.toml`). Ajouter quand même `[skip netlify]` au message de commit — sauf si ce commit sera le dernier d'un push
qui contient aussi du code (voir l'étape 3).
