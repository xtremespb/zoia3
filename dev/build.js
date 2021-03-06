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

let buildMode = "production";
try {
    const buildConfig = fs.readJSONSync(path.resolve(`${__dirname}/../build/etc/build.json`));
    buildMode = buildConfig.mode;
} catch {
    // Ignore
}
const command = Object.keys(options)[0];
const params = {
    dev: "--mode development --config ./dev/config.js",
    maps: "--progress --mode development --config ./dev/config.js --env=maps=true",
    update: `--progress --mode ${buildMode} --config ./dev/config.js --env=update=true`,
    production: "--progress --mode production --config ./dev/config.js",
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

const loadingAnimation = () => {
    const h = ["|", "/", "-", "\\"];
    let i = 0;
    return setInterval(() => {
        i = (i > 3) ? 0 : i;
        const msg = `Building ZOIA, this may take ${options.production ? "LONG" : "some"} time... ${h[i]}`;
        process.stdout.write(`\r${msg}`);
        i += 1;
    }, 100);
};

(async () => {
    const packageJson = require(path.resolve(`${__dirname}/../package.json`));
    console.log(`ZOIA Build Script, mode: ${buildMode}, version: ${packageJson.version}\nStart time: ${new Date()}\n`);
    const timestampStart = new Date().getTime() / 1000;
    const loading = loadingAnimation();
    const dir = command === "update" ? "update" : "zoia";
    try {
        if (fs.existsSync(path.resolve(`${__dirname}/../build/bin/zoia.js`))) {
            fs.copySync(path.resolve(`${__dirname}/../build/bin/zoia.js`), path.resolve(`${__dirname}/../build/bin/zoia.js.bak`));
        }
        if (fs.existsSync(path.resolve(`${__dirname}/../build/bin/test.js`))) {
            fs.copySync(path.resolve(`${__dirname}/../build/bin/test.js`), path.resolve(`${__dirname}/../build/bin/test.js.bak`));
        }
        if (fs.existsSync(path.resolve(`${__dirname}/../build/bin/cli.js`))) {
            fs.copySync(path.resolve(`${__dirname}/../build/bin/cli.js`), path.resolve(`${__dirname}/../build/bin/cli.js.bak`));
        }
        if (fs.existsSync(path.resolve(`${__dirname}/../build/public/${dir}`))) {
            fs.copySync(path.resolve(`${__dirname}/../build/public/${dir}`), path.resolve(`${__dirname}/../build/public/${dir}_bak`));
        }
        await execCommand(`node node_modules/webpack-cli/bin/cli ${params[command]}`);
        fs.removeSync(path.resolve(`${__dirname}/../build/bin/zoia.js.bak`));
        fs.removeSync(path.resolve(`${__dirname}/../build/bin/test.js.bak`));
        fs.removeSync(path.resolve(`${__dirname}/../build/bin/cli.js.bak`));
        fs.removeSync(path.resolve(`${__dirname}/../build/public/${dir}`));
        fs.removeSync(path.resolve(`${__dirname}/../build/public/${dir}_bak`));
        fs.moveSync(path.resolve(`${__dirname}/../build/public/${dir}_`), path.resolve(`${__dirname}/../build/public/${dir}`));
        clearTimeout(loading);
    } catch (e) {
        try {
            if (fs.existsSync(path.resolve(`${__dirname}/../build/public/${dir}_`))) {
                fs.removeSync(path.resolve(`${__dirname}/../build/public/${dir}_`));
            }
        } catch {
            // Ignore
        }
        clearTimeout(loading);
        console.log(`Failed:\n`);
        console.log(e);
        process.exit(1);
    }
    console.log(`\rAll done, ${command} version of ZOIA has been built successfully in ${parseInt(new Date().getTime() / 1000 - timestampStart, 10)} second(s).\n`);
})();
