const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "production",
  entry: "./src/Code.ts",
  output: {
    filename: "Code.js",
    path: path.resolve(__dirname, "dist"),
    iife: false,
  },
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      shared: path.resolve(__dirname, "../shared"),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              projectReferences: true,
              transpileOnly: true,
            },
          },
        ],
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "src/appsscript.json",
          to: "appsscript.json",
        },
      ],
    }),
  ],
  target: "web", // Ensures compatibility with Google Apps Script environment
  devtool: false, // Avoids source maps for Apps Script
  optimization: {
    // If minimized, important comments dictating @customfunction would be incorrectly stripped
    minimize: false,
    sideEffects: false,
    usedExports: false,
  },
};
