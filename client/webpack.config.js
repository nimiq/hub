module.exports = {
  entry: './AccountsManagerClient.ts',
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader"
        }
      }
    ]
  },
  resolve: {
    extensions: [ '.ts', '.tsx', '.js' ]
  },
  mode: 'development',
  output: {
    filename: 'AccountsManager.js',
  }
};
