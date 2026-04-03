import type { MetadataRoute } from "next";
import { getCanonicalUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/docs", "/skills", "/author", "/skill.md"],
        disallow: ["/api/", "/dashboard", "/settings"],
      },
    ],
    sitemap: getCanonicalUrl("/sitemap.xml"),
    host: getCanonicalUrl("/"),
  };
}
