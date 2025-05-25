/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      // Dominios comunes para imágenes de NFTs
      'gateway.irys.xyz',
      'arweave.net',
      'cdn.metaplex.com',
      'www.arweave.net',
      'ipfs.io',
      'gateway.pinata.cloud',
      'cloudflare-ipfs.com',
      'dweb.link',
      'shdw-drive.genesysgo.net',
      'nftstorage.link'
    ],
    // Configurar un loader personalizado para mejorar la compatibilidad
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  }
}

module.exports = nextConfig
