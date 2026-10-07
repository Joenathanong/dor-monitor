/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    // Foto bukti dilayani langsung dari Google Drive (thumbnail endpoint) —
    // tidak lewat server kita, jadi tidak membebani Vercel.
    remotePatterns: [
      { protocol: 'https', hostname: 'drive.google.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

export default nextConfig;
