import Auth from "../../../shared/lib/auth";
import C from "../../../shared/lib/constants";

export default () => ({
    async handler(req, rep) {
        // Check permissions
        const auth = new Auth(this.mongo.db, this, req, rep, C.USE_BEARER_FOR_TOKEN);
        if (!(await auth.getUserData()) || !auth.checkStatus("admin")) {
            rep.unauthorizedError(rep);
            return;
        }
        try {
            const backupState = await this.mongo.db.collection(req.zoiaConfig.collections.registry).findOne({
                _id: "backup"
            });
            if (backupState && backupState.running) {
                rep.requestError(rep, {
                    failed: true,
                    error: "Backup process is already running",
                    errorKeyword: "alreadyRunning",
                    errorData: []
                });
                return;
            }
            setTimeout(async () => {
                const resultUpdate = await this.mongo.db.collection(req.zoiaConfig.collections.registry).updateOne({
                    _id: "backup"
                }, {
                    $set: {
                        running: true
                    }
                }, {
                    upsert: true
                });
                if (!resultUpdate || !resultUpdate.result || !resultUpdate.result.ok) {
                    // Hmm
                }
            }, 1);
            // Send response
            rep.successJSON(rep, {});
            return;
        } catch (e) {
            rep.logError(req, null, e);
            rep.internalServerError(rep, e.message);
        }
    }
});