const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");

module.exports = (markoPlugin, argv) => ({
    name: "Server Part",
    context: path.resolve(`${__dirname}/../${argv.type === "update" ? "update" : "src"}/shared/marko`),
    resolve: {
        extensions: [".js", ".json", ".marko"]
    },
    module: {
        rules: [{
                test: /\.marko$/,
                loader: "@marko/webpack/loader"
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    "style-loader",
                    "css-loader",
                    "sass-loader",
                ],
            }
        ]
    },
    target: "node",
    externals: [/^[^./!]/],
    optimization: argv.mode === "production" ? {
        splitChunks: false,
        minimizer: [
            new TerserPlugin({
                parallel: true,
                extractComments: false,
            })
        ]
    } : {},
    output: {
        // libraryTarget: "commonjs2",
        path: path.resolve(`${__dirname}/../build/bin`),
        filename: argv.type === "update" ? "zoia_update.js" : "zoia.js",
        publicPath: `/zoia/`,
    },
    plugins: [
        new webpack.DefinePlugin({
            "process.browser": undefined,
            "process.env.BUNDLE": true
        }),
        new webpack.optimize.LimitChunkCountPlugin({
            maxChunks: 1
        }),
        markoPlugin.server,
    ]
});
