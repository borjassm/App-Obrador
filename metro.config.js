const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Limit to 1 worker to help identify worker crash issues
config.maxWorkers = 1;

module.exports = config;
