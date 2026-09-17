/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";
const seoCacheControl =
  "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    const backendApiUrl =
      process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_API_URL;

    const isExternal = Boolean(
      backendApiUrl && /^(https?:)?\/\//.test(backendApiUrl),
    );

    if (!isExternal) {
      return [];
    }

    const baseUrl = backendApiUrl.replace(/\/api\/?$/, "");

    return [
      {
        source: "/api/clubs",
        destination: `${baseUrl}/api/clubs`,
      },
      {
        source: "/api/clubs/public/:slug*",
        destination: `${baseUrl}/api/clubs/public/:slug*`,
      },
      {
        source: "/api/events",
        destination: `${baseUrl}/api/events`,
      },
      {
        source: "/api/events/:path*",
        destination: `${baseUrl}/api/events/:path*`,
      },
      {
        source: "/api/registrations",
        destination: `${baseUrl}/api/registrations`,
      },
      {
        source: "/api/registrations/:path*",
        destination: `${baseUrl}/api/registrations/:path*`,
      },
      {
        source: "/api/uploads/:path*",
        destination: `${baseUrl}/api/uploads/:path*`,
      },
    ];
  },
  async headers() {
    const backendApiUrl =
      process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_API_URL;
    const backendOrigin =
      backendApiUrl && /^(https?:)?\/\//.test(backendApiUrl)
        ? backendApiUrl.replace(/\/api\/?$/, "")
        : "";
    const connectSrcOrigins = [
      "'self'",
      "https://vercel.live",
      "https://api.cloudinary.com",
      "https://*.onrender.com",
      backendOrigin,
      "wss://ws-us3.pusher.com",
      "wss://*.pusher.com",
      "https://*.pusher.com",
      isDev ? "ws://localhost:* http://localhost:*" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return [
      {
        source: "/robots.txt",
        headers: [
          { key: "Cache-Control", value: seoCacheControl },
        ],
      },
      {
        source: "/sitemap.xml",
        headers: [
          { key: "Cache-Control", value: seoCacheControl },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // vercel.live + vercel.com required for Vercel Toolbar avatars/images (per Vercel docs)
              "img-src 'self' res.cloudinary.com picsum.photos data: blob: https://vercel.live https://vercel.com",
              // vercel.live required for Vercel Toolbar styles
              "style-src 'self' 'unsafe-inline' https://vercel.live",
              // 'unsafe-inline' is required for Next.js inline hydration scripts.
              // 'unsafe-eval' is required for Fast Refresh (HMR) in development only.
              // vercel.live is needed for the Vercel preview feedback widget.
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://vercel.live`,
              // localhost WebSocket is required for HMR in development only.
              `connect-src ${connectSrcOrigins}`,
              "frame-src https://vercel.live",
              // vercel.live + assets.vercel.com required for Vercel Toolbar fonts
              "font-src 'self' https://vercel.live https://assets.vercel.com",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
