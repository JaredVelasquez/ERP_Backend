const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

/** Nest monorepo: resolve @domain/* and the other layer aliases. */
module.exports = (options) => ({
  ...options,
  resolve: {
    ...options.resolve,
    plugins: [
      ...(options.resolve?.plugins ?? []),
      new TsconfigPathsPlugin({ configFile: `${__dirname}/tsconfig.json` }),
    ],
  },
});
