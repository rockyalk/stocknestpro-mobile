const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package.json "exports" field resolution for ESM-only packages
// Required for superjson@2.2.6 → copy-anything dependency
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
