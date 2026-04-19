const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

const ignoredOptionalModules = new Set([
  '@apollo/gateway',
  '@grpc/grpc-js',
  '@grpc/proto-loader',
  '@nestjs/websockets/socket-module',
  'amqp-connection-manager',
  'amqplib',
  'apollo-server-fastify',
  'class-transformer/storage',
  'ioredis',
  'kafkajs',
  'mqtt',
  'nats',
  'ts-morph',
]);

module.exports = (options) => ({
  ...options,
  externals: [
    ...(Array.isArray(options.externals)
      ? options.externals
      : [options.externals].filter(Boolean)),
    nodeExternals({
      allowlist: [/^@nestjs-yalc\//],
    }),
    ({ request }, callback) => {
      if (ignoredOptionalModules.has(request)) {
        callback(null, `commonjs ${request}`);
        return;
      }

      callback();
    },
  ],
  resolve: {
    ...options.resolve,
    plugins: [
      ...(options.resolve?.plugins ?? []),
      new TsconfigPathsPlugin({
        configFile: './tsconfig.json',
        extensions: ['.ts', '.js', '.mjs', '.cjs'],
      }),
    ],
    extensionAlias: {
      ...(options.resolve?.extensionAlias ?? {}),
      '.js': ['.ts', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    },
  },
  plugins: [
    ...(options.plugins ?? []),
    new webpack.NormalModuleReplacementPlugin(
      /^@nestjs-yalc\/.*\.js$/,
      (resource) => {
        resource.request = resource.request.replace(/\.js$/, '');
      },
    ),
  ],
});
