/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@marque/shared",
    "@marque/x402",
    "@marque/delegation",
    "@marque/agents",
  ],
  experimental: {
    optimizePackageImports: ["viem", "wagmi", "@rainbow-me/rainbowkit"],
  },
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false }
    return config
  },
}

export default nextConfig
