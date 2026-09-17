import type { MetadataRoute } from "next";
import { backendUrl } from "@/lib/server-auth";
import { absoluteSiteUrl } from "@/lib/site-url";

export const revalidate = 60;

const STATIC_PUBLIC_ROUTES = [
  { path: "/clubs", changeFrequency: "hourly", priority: 1 },
  { path: "/register", changeFrequency: "hourly", priority: 0.9 },
  { path: "/my-status", changeFrequency: "weekly", priority: 0.5 },
  { path: "/signup", changeFrequency: "monthly", priority: 0.4 },
] as const;

type ClubSummary = {
  slug?: unknown;
};

function validClubSlug(club: ClubSummary) {
  if (typeof club.slug !== "string") {
    return null;
  }

  const slug = club.slug.trim();
  if (!slug || slug.toLowerCase() === "t") {
    return null;
  }

  return slug;
}

async function getPublicClubSlugs() {
  try {
    const res = await fetch(backendUrl("/clubs"), {
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return [];
    }

    const clubs = (await res.json()) as ClubSummary[];
    if (!Array.isArray(clubs)) {
      return [];
    }

    return clubs
      .map(validClubSlug)
      .filter((slug): slug is string => Boolean(slug));
  } catch (_err) {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const generatedAt = new Date();
  const staticUrls: MetadataRoute.Sitemap = STATIC_PUBLIC_ROUTES.map((route) => ({
    url: absoluteSiteUrl(route.path),
    lastModified: generatedAt,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const clubUrls: MetadataRoute.Sitemap = (await getPublicClubSlugs()).map((slug) => ({
    url: absoluteSiteUrl(`/register/${encodeURIComponent(slug)}`),
    lastModified: generatedAt,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...staticUrls, ...clubUrls];
}
