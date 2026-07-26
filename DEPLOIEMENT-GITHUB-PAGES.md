# Déploiement — GitHub Pages (site statique pur)

Le projet est configuré pour un **export 100 % statique** (HTML/CSS/JS), sans
serveur : `npm run build` génère un dossier **`out/`** hébergeable tel quel sur
GitHub Pages (ou n'importe quel hébergeur statique). La lampe 3D, les animations,
le configurateur et le formulaire fonctionnent entièrement côté navigateur.

## 1. Générer le site en local

```bash
npm install
npm run build      # → dossier out/  (HTML/CSS/JS statiques)
npm run preview    # aperçu local du dossier out/ (http://localhost:3000)
```

`npm run dev` reste disponible pour le développement (http://localhost:3000).

## 2. Déploiement automatique (recommandé)

Un workflow est fourni : `.github/workflows/deploy.yml`.

1. Créez un dépôt GitHub et poussez le projet (le contenu de `etnisi-site/` doit
   être à la racine du dépôt).
2. Sur GitHub : **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Poussez sur `main` (ou `master`). Le workflow :
   - calcule automatiquement le *base path* (voir §4),
   - lance `npm ci` puis `npm run build`,
   - publie `out/` sur Pages.

L'URL de publication apparaît dans l'onglet **Actions** puis dans **Settings → Pages**.

## 3. Déploiement manuel (sans Actions)

```bash
npm run build            # produit out/
# publiez le CONTENU de out/ sur la branche gh-pages (ou le dossier configuré)
```
Le fichier `out/.nojekyll` est déjà généré : il est **indispensable** (sinon
GitHub Pages ignore le dossier `_next/` et le site ne charge pas).

## 4. Base path (important)

- **Page de projet** `https://<user>.github.io/<repo>/` → il faut préfixer les
  chemins par `/<repo>`. Le workflow le fait tout seul via la variable
  `PAGES_BASE_PATH`. En build manuel : `PAGES_BASE_PATH="/<repo>" npm run build`.
- **Page utilisateur/orga** `https://<user>.github.io/` (dépôt `<user>.github.io`)
  ou **domaine personnalisé** → laisser `PAGES_BASE_PATH` **vide** (défaut).

## 5. Formulaire de contact (pas de serveur)

Un site statique n'a pas d'API. Le formulaire fonctionne ainsi :

- **Par défaut** : ouverture du logiciel de messagerie de l'utilisateur (`mailto:`)
  pré-rempli vers `contactEmail` (défini dans `config/site.ts`).
- **Optionnel** : pour un envoi silencieux, renseignez `leadEndpoint` dans
  `config/site.ts` avec l'URL d'un service de formulaire statique
  (Formspree, Getform, Basin…). Le formulaire y postera directement.

## 6. À vérifier avant mise en ligne

- `config/site.ts` : `contactEmail` réel, `siteUrl` (URL Pages finale, utilisée
  pour `sitemap.xml` / balises canoniques), éventuellement `leadEndpoint`.
- Domaine personnalisé : ajoutez un fichier `public/CNAME` contenant le domaine.
