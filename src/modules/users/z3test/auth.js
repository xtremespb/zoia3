export default async (test, zoia, userData) => {
    const result = {
        success: true,
        page: null
    };
    try {
        try {
            zoia.log.warn(`Auth test starting`);
            await test.init();
            const authPage = await test.browser.newPage();
            zoia.log.step("Opening authentication page");
            await authPage.goto(`${zoia.config.url}${zoia.config.routes.login}?redirect=${zoia.modulesConfig["core"].routes.core}`);
            zoia.log.step("Setting username and password");
            await authPage.type("#userLoginForm_username", userData.username);
            await authPage.type("#userLoginForm_password", userData.password);
            zoia.log.step("Clicking on a login button");
            await authPage.click("#userLoginForm_btnLogin");
            zoia.log.step("Waiting for admin panel");
            await authPage.waitForSelector(".z3-ap-head-thin", {
                visible: true,
                timeout: 15000
            });
            zoia.log.success(`Auth test success, running time: ${(test.getRunTimeMs() / 1000).toFixed(2)} second(s)`);
            result.page = authPage;
        } catch (e) {
            zoia.log.error(`Auth test failed: ${e.message}`);
            result.success = false;
        }
    } catch (e) {
        zoia.log.error(e);
        result.success = false;
    }
    return result;
};
