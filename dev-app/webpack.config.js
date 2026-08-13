const Encore = require('@symfony/webpack-encore');
const path = require('path');

if (!Encore.isRuntimeEnvironmentConfigured()) {
    Encore.configureRuntimeEnvironment(process.env.NODE_ENV || 'dev');
}

Encore
    .setOutputPath('public/build/')
    .setPublicPath('/build')
    .addEntry('app', './assets/app.js')
    .splitEntryChunks()
    .enableSingleRuntimeChunk()
    .cleanupOutputBeforeBuild()
    .enableSourceMaps(!Encore.isProduction())
    .enableVersioning(Encore.isProduction())
    .enableSassLoader()
    // The kit lives one level up, in the bundle itself: editing it rebuilds instantly.
    .addAliases({
        '@mvincent/ui-kit': path.resolve(__dirname, '..', 'assets'),
    })
;

const config = Encore.getWebpackConfig();

// The kit's sources live outside dev-app/, so Node's default resolution would look for
// node_modules next to them (i.e. at the bundle root) and miss every peer dependency.
// Pinning the lookup on dev-app/node_modules makes the aliased files resolve like local ones.
config.resolve.modules = [
    path.resolve(__dirname, 'node_modules'),
    'node_modules',
];

module.exports = config;
