const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Swap @rnmapbox/maps for a web-safe stub on web builds
const webMapboxStub = path.resolve(__dirname, 'src/mocks/rnmapbox-maps.web.tsx');
const originalResolveRequest = config.resolver?.resolveRequest;

config.resolver = config.resolver ?? {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === '@rnmapbox/maps') {
    return { filePath: webMapboxStub, type: 'sourceFile' };
  }
  if (originalResolveRequest) return originalResolveRequest(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/styles/global.css' });
