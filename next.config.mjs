/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Les images produit sont locales (/public). Aucun host distant autorisé.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
