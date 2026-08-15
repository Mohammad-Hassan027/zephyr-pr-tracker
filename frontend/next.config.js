/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
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
};

module.exports = nextConfig;
