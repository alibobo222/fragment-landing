/** @type {import('next').NextConfig} */

// Base path pour GitHub Pages :
// - Page de projet (https://user.github.io/repo/) → PAGES_BASE_PATH="/repo"
// - Page utilisateur/orga ou domaine personnalisé → laisser vide.
// Le workflow GitHub Actions le calcule automatiquement (nom du dépôt).
const basePath = process.env.PAGES_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,

  // Export 100 % statique → dossier `out/` (HTML/CSS/JS), aucun serveur requis.
  output: "export",

  // GitHub Pages sert des dossiers → URLs avec slash final (out/xxx/index.html).
  trailingSlash: true,

  // Préfixe d'URL pour une page de projet GitHub Pages (sinon vide).
  basePath,
  // Exposé au code client si besoin de préfixer un lien manuel.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },

  images: {
    // Pas d'optimiseur serveur en statique : les images sont servies telles quelles
    // (cohérent avec l'exigence de fidélité photographique — aucun ré-encodage).
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
