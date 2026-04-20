const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    background: './src/background/index.ts',
    content: './src/content/index.ts',
    sidepanel: './src/sidepanel/sidepanel.ts',
    options: './src/options/options.ts',
    devtools: './src/devtools/devtools.ts',
    panel: './src/devtools/panel.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/sidepanel/sidepanel.html', to: 'sidepanel.html' },
        { from: 'src/options/options.html', to: 'options.html' },
        { from: 'src/icons', to: 'icons' },
        { from: 'src/devtools/devtools.html', to: 'devtools.html' },
        { from: 'src/devtools/panel.html', to: 'panel.html' },
      ],
    }),
  ],
  devtool: false,
};
