/* eslint-disable */
const path = require('path')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')

module.exports = {
  entry: {
    background: './src/background/index.ts',
    options: './src/options/index.ts',
  },
  devtool: 'source-map',
  mode: 'development',
  performance: {
    hints: false,
  },
  node: false,
  optimization: {
    minimize: false,
    moduleIds: 'named',
    chunkIds: 'named',
    concatenateModules: false,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.module.scss'],
    plugins: [new TsconfigPathsPlugin()],
  },
  output: {
    filename: '[name]/index.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.module\.scss$/i,
        use: ['style-loader', 'css-modules-typescript-loader', {
          loader: 'css-loader',
          options: { modules: { localIdentName: '[name]__[local]--[hash:base64:5]' } }
        }, 'sass-loader'],
      },
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        'README.md',
        'LICENSE',
        'src/manifest.json',
        { from: '**/*.html', context: 'src' },
        { from: '**/*.css', context: 'src', },
        { from: '**/*.svg', context: 'src' },
        { from: 'src/_locales', to: '_locales' },
        // { from: 'src/ui/vendor', to: 'vendor' },
      ],
    }),
  ],
  devServer: {
    hot: false,
    inline: false,
    writeToDisk: true,
  },
}
