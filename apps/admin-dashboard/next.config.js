/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@cleano/shared-types', '@cleano/shared-utils', '@cleano/shared-constants'],
}

module.exports = nextConfig
