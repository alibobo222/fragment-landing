import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

// Généré une fois au build (compatible export statique).
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteConfig.siteUrl}/sitemap.xml`,
    host: siteConfig.siteUrl,
  };
}
