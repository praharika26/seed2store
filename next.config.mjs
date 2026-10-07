/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  async redirects() {
    // Routes from the original app, kept so old links still work.
    return [
      { source: "/my-offers", destination: "/offers", permanent: true },
      { source: "/purchase-history", destination: "/orders", permanent: true },
      { source: "/switch-role", destination: "/settings", permanent: true },
      { source: "/diagnostics", destination: "/status", permanent: true },
    ]
  },
}

export default nextConfig
