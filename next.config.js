/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['googleapis', 'nodemailer'],
  },
};

module.exports = nextConfig;
