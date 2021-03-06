import template from "./template.marko";

export default () => ({
    async handler(req) {
        try {
            const {
                response,
                auth,
                acl,
            } = req.zoia;
            const site = new req.ZoiaSite(req, "core", this.mongo.db);
            response.setSite(site);
            if (!auth.statusAdmin()) {
                auth.clearAuthCookie();
                return response.redirectToLogin(req.zoiaConfig.routes.imagesBrowser);
            }
            site.setAuth(auth);
            const render = await template.stream({
                $global: {
                    serializedGlobals: {
                        template: true,
                        pageTitle: true,
                        routes: true,
                        accessAllowed: true,
                        ...site.getSerializedGlobals()
                    },
                    template: "admin",
                    pageTitle: site.i18n.t("moduleTitleImages"),
                    routes: {
                        ...req.zoiaConfig.routes
                    },
                    accessAllowed: acl.checkPermission("imagesBrowser", "read"),
                    ...await site.getGlobals(),
                }
            });
            return response.sendHTML(render);
        } catch (e) {
            return Promise.reject(e);
        }
    }
});
