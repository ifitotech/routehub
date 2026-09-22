const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This repository lives below a parent folder that also has a lockfile.
  // Pin tracing to this app so Next does not resolve production files from
  // outside RouteHub-v2.
  outputFileTracingRoot: path.join(__dirname),
}

module.exports = nextConfig
