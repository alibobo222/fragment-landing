import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

// Généré une fois au build (compatible export statique).
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteConfig.siteUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
