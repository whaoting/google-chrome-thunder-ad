const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: "production",
  entry: {
    popup: "./src/popup/index.tsx",
    content: "./src/content/index.ts",
    background: "./src/background/index.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              compilerOptions: {
                jsx: "react",
              },
            },
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      react: path.resolve("./node_modules/react"),
      "react-dom": path.resolve("./node_modules/react-dom"),
    },
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "public", to: "." },
        { from: "manifest.json", to: "." },
      ],
    }),
    new HtmlWebpackPlugin({
      template: "./src/popup/index.html",
      filename: "popup.html",
      chunks: ["popup"],
    }),
  ],
  optimization: {
    splitChunks: {
      chunks(chunk) {
        return chunk.name !== "background";
      },
    },
  },
};
