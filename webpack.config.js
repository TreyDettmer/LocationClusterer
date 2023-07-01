require("dotenv").config();


module.exports = {
  env: {
    MAPBOX_API_ACCESS_TOKEN: process.env.MAPBOX_API_ACCESS_TOKEN,
    SITE_ACCESS_SHA256: process.env.SITE_ACCESS_SHA256
  },
  resolve: {
    fallbacks:{
      "path": require.resolve("path-browserify"),
      "os": require.resolve("os-browserify/browser"),
      "crypto": require.resolve("crypto-browserify")
    }
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.MAPBOX_API_ACCESS_TOKEN': JSON.stringify(process.env.MAPBOX_API_ACCESS_TOKEN),
      'process.env.SITE_ACCESS_SHA256': JSON.stringify(process.env.SITE_ACCESS_SHA256),
    })
  ]
}