export default () => ({
    async handler(req) {
        const {
            log,
            response,
            auth,
            acl
        } = req.zoia;
        try {
            // Check permissions
            if (!auth.checkStatus("admin")) {
                response.unauthorizedError();
                return;
            }
            if (!acl.checkPermission("nav", "read")) {
                response.requestError({
                    failed: true,
                    error: "Access Denied",
                    errorKeyword: "accessDenied",
                    errorData: []
                });
                return;
            }
            // Get tree
            const treeData = await this.mongo.db.collection(req.zoiaConfig.collections.registry).findOne({
                _id: "nav_data"
            });
            const tree = {
                id: "/",
                c: treeData ? treeData.tree : []
            };
            // Send result
            response.successJSON({
                tree
            });
            return;
        } catch (e) {
            log.error(e);
            // eslint-disable-next-line consistent-return
            return Promise.reject(e);
        }
    }
});