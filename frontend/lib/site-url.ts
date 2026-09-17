const LOCAL_SITE_ORIGIN = "http://localhost:3000";

function withProtocol(hostOrUrl: string) {
  if (/^https?:\/\//.test(hostOrUrl)) {
    return hostOrUrl;
  }

  return `https://${hostOrUrl}`;
}

export function getSiteOrigin() {
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || LOCAL_SITE_ORIGIN;

  try {
    return new URL(withProtocol(rawSiteUrl.trim())).origin;
  } catch (_err) {
    return LOCAL_SITE_ORIGIN;
  }
}

export function absoluteSiteUrl(path = "/") {
  return `${getSiteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
