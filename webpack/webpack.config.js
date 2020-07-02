/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-console */
const fs = require("fs-extra");
const path = require("path");
const MarkoPlugin = require("@marko/webpack/plugin").default;
const config = require("../etc/zoia.json");
const utils = require("./webpack.config.utils");

const languages = Object.keys(config.languages);
const webpackConfig = [];
const moduleDirs = fs.readdirSync(path.resolve(`${__dirname}/../modules`)).filter(d => !d.match(/^\./));
const markoPlugin = new MarkoPlugin();

module.exports = (env, argv) => {
    console.log(`Building Zoia, mode: ${argv.mode}`);
    const configWebClient = require("./webpack.config.client")(moduleDirs, markoPlugin);
    const configWebServer = require("./webpack.config.server")(markoPlugin);
    utils.cleanUpWeb();
    utils.ensureDirectories();
    utils.generateModulesConfig(moduleDirs, languages, argv);
    utils.generateTemplatesJSON();
    utils.rebuildMarkoTemplates();
    console.log("Starting Webpack...");
    webpackConfig.push(configWebClient, configWebServer);
    return webpackConfig;
};
