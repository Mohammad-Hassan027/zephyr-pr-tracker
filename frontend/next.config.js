/** @type {import('next').NextConfig} */
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
        source: "/api/events/:path*",
        destination: `${baseUrl}/api/events/:path*`,
      },
      {
        source: "/api/members/:path*",
        destination: `${baseUrl}/api/members/:path*`,
      },
      {
        source: "/api/registrations/:path*",
        destination: `${baseUrl}/api/registrations/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' res.cloudinary.com picsum.photos data:",
              "style-src 'self' 'unsafe-inline'",
              "script-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'self'",
            ].join("; "),
          },
          ,
        ],
      },
    ];
  },
};

module.exports = nextConfig;
