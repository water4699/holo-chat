import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bind to 0.0.0.0 for WSL access
  experimental: {
    // Allow access from Windows host when running in WSL
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
  headers() {
    // Required by FHEVM 
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ]);
  },
  // Allow images from external sources
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
