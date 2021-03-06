import template from "./template.marko";
import moduleData from "../../module.json";

export default routeId => ({
    async handler(req) {
        try {
            const {
                acl,
                response,
                auth,
            } = req.zoia;
            const site = new req.ZoiaSite(req, "users", this.mongo.db);
            response.setSite(site);
            if (!auth.statusAdmin()) {
                auth.clearAuthCookie();
                return response.redirectToLogin(req.zoiaModulesConfig["users"].routes.users);
            }
            site.setAuth(auth);
            const render = await template.stream({
                $global: {
                    serializedGlobals: {
                        template: true,
                        pageTitle: true,
                        routeId: true,
                        routeParams: true,
                        routes: true,
                        modules: true,
                        accessAllowed: true,
                        ...site.getSerializedGlobals()
                    },
                    template: "admin",
                    pageTitle: `${site.i18n.t(`moduleTitle.${moduleData.idAcl}`)} | ${site.i18n.t("adminPanel")}`,
                    routeId,
                    routeParams: req.params || {},
                    routes: {
                        ...req.zoiaModulesConfig["users"].routes,
                        ...req.zoiaConfig.routes
                    },
                    modules: this.zoiaAdmin,
                    accessAllowed: acl.checkPermission("users", "read"),
                    ...await site.getGlobals()
                },
                modules: req.zoiaAdmin.map(m => ({
                    ...m,
                    allowed: acl.checkPermission(m.id, "read")
                })),
                moduleId: moduleData.idAcl,
            });
            return response.sendHTML(render);
        } catch (e) {
            return Promise.reject(e);
        }
    }
});
