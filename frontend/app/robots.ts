import type { MetadataRoute } from "next";
import { absoluteSiteUrl } from "@/lib/site-url";

export const revalidate = 60;

const DISALLOWED_PATHS = [
  "/admin",
  "/admin/",
  "/api/",
  "/dashboard",
  "/dashboard/",
  "/login",
  "/platform",
  "/platform/",
  "/pr/dashboard",
  "/status/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS }],
    sitemap: absoluteSiteUrl("/sitemap.xml"),
  };
}
