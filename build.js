/* eslint-disable no-console */
const {
    exec
} = require("child_process");
const commandLineArgs = require("command-line-args");
const fs = require("fs-extra");
const path = require("path");

const options = commandLineArgs([{
    name: "dev",
    type: Boolean
}, {
    name: "maps",
    type: Boolean
}, {
    name: "update",
    type: Boolean
}, {
    name: "production",
    type: Boolean
}]);

if (Object.keys(options).length !== 1) {
    console.error("Build parameter missing or invalid");
    return;
}

const command = Object.keys(options)[0];
const params = {
    dev: "--mode development --config ./webpack/config.js",
    maps: "--display minimal --progress --mode development --config ./webpack/config.js --maps true",
    update: "webpack --display minimal --progress --mode production --config ./webpack/config.js --type update",
    production: "webpack --display minimal --progress --mode production --config ./webpack/config.js",
};

if (!params[command]) {
    console.error("Build parameter missing or invalid");
    return;
}

const execCommand = cmd => new Promise((resolve, reject) => {
    let exitCode;
    const workerProcess = exec(cmd, (error, stdout, stderr) => {
        if (exitCode === 0) {
            resolve(stdout);
        } else {
            // eslint-disable-next-line prefer-promise-reject-errors
            reject(new Error(`${stdout || ""}${stderr || ""}`));
        }
    });
    workerProcess.on("exit", code => exitCode = code);
});

(async () => {
    const dir = command === "update" ? "update" : "zoia";
    console.log(`Starting the build process, this may take some time...`);
    try {
        if (fs.existsSync(path.resolve(`${__dirname}/build/bin/zoia.js`))) {
            fs.copySync(path.resolve(`${__dirname}/build/bin/zoia.js`), path.resolve(`${__dirname}/build/bin/zoia.js.bak`));
        }
        if (fs.existsSync(path.resolve(`${__dirname}/build/public/${dir}`))) {
            fs.copySync(path.resolve(`${__dirname}/build/public/${dir}`), path.resolve(`${__dirname}/build/public/${dir}_bak`));
        }
        await execCommand(`node node_modules/webpack-cli/bin/cli ${params[command]}`);
        fs.removeSync(path.resolve(`${__dirname}/build/bin/zoia.js.bak`));
        fs.removeSync(path.resolve(`${__dirname}/build/public/${dir}`));
        fs.removeSync(path.resolve(`${__dirname}/build/public/${dir}_bak`));
        fs.moveSync(path.resolve(`${__dirname}/build/public/${dir}_`), path.resolve(`${__dirname}/build/public/${dir}`));
    } catch (e) {
        try {
            if (fs.existsSync(path.resolve(`${__dirname}/build/public/${dir}_`))) {
                fs.removeSync(path.resolve(`${__dirname}/build/public/${dir}_`));
            }
        } catch {
            // Ignore
        }
        console.log(`Failed:\n`);
        console.log(e);
        process.exit(1);
    }
    console.log("All done.");
})();
