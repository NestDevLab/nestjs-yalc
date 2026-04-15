module.exports = (options) => ({
  ...options,
  resolve: {
    ...options.resolve,
    extensionAlias: {
      ...(options.resolve?.extensionAlias ?? {}),
      '.js': ['.ts', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    },
  },
});
