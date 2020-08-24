const axios = require("axios");
const Cookies = require("../../../../../shared/lib/cookies").default;

/* eslint-disable arrow-body-style */
module.exports = class {
    onCreate(input, out) {
        this.state = {
            processValue: null,
            error: null,
            dir: "",
            loading: false
        };
        this.i18n = out.global.i18n;
        this.language = out.global.language;
        this.routes = out.global.routes;
        this.cookieOptions = out.global.cookieOptions;
        this.siteOptions = out.global.siteOptions;
    }

    async onMount() {
        const cookies = new Cookies(this.cookieOptions);
        this.token = cookies.get(`${this.siteOptions.id || "zoia3"}.authToken`);
        this.tree = this.getComponent("z3_ap_ps_tree");
        this.table = this.getComponent("z3_ap_ps_table");
        this.editModal = this.getComponent("z3_ap_ps_editModal");
        // eslint-disable-next-line no-unused-vars
        this.state.processValue = (id, value, column, row) => {
            switch (column) {
            default:
                return value;
            }
        };
        if (this.input.successNotification) {
            this.getComponent(`pagesList_mnotify`).func.show(this.i18n.t("dataSaveSuccess"), "is-success");
        }
        await this.loadTree();
        if (this.input.dirData) {
            this.state.dir = this.input.dirData.join("/");
            this.tree.func.selectNode(this.input.dirData);
        }
        await this.table.func.dataRequest({
            dir: this.state.dir
        });
    }

    setLoadingTree(state) {
        this.tree.func.setLoading(state);
    }

    async loadTree() {
        this.setLoadingTree(true);
        try {
            const res = await axios({
                method: "post",
                url: "/api/pages/tree/load",
                headers: {
                    Authorization: `Bearer ${this.token}`
                }
            });
            const treeData = res.data.tree || {};
            this.tree.func.initData(treeData);
            this.setLoadingTree(false);
        } catch (e) {
            this.setLoadingTree(false);
            this.state.error = e && e.response && e.response.data && e.response.data.error && e.response.data.error.errorKeyword ? this.i18n.t(e.response.data.error.errorKeyword) : this.i18n.t("couldNotLoadDataFromServer");
        }
    }

    // eslint-disable-next-line class-methods-use-this
    onActionClick(data) {
        switch (data.action) {
        case "btnEdit":
            window.router.navigate("pages.edit", {
                id: data.id
            });
            break;
        }
    }

    onTopButtonClick(data) {
        switch (data.button) {
        case "btnReload":
            this.table.func.dataRequest();
            break;
        case "btnAdd":
            window.router.navigate("pages.edit", {
                id: "new"
            });
            break;
        }
    }

    onUnauthorized() {
        window.location.href = this.i18n.getLocalizedURL(`${this.routes.login}?_=${new Date().getTime()}`, this.language);
    }

    onFolderAddClick() { // Param: data
        this.editModal.func.setTitle(this.i18n.t("addFolder"));
        this.editModal.func.setUUID(null);
        this.editModal.func.setData({});
        this.editModal.func.setActive(true);
    }

    onFolderEditClick(data) { // Param: data
        this.editModal.func.setTitle(this.i18n.t("editFolder"));
        this.editModal.func.setUUID(data.uuid);
        this.editModal.func.setData({
            id: data.item.id,
            ...data.item.data
        });
        this.editModal.func.setActive(true);
    }

    onFolderSave(data) {
        if (data.uuid) {
            this.tree.func.saveChild(data.uuid, data.item);
        } else {
            this.tree.func.addChild(data.item);
        }
    }

    // User has clicked a tree item
    async onTreeItemClick(data) {
        const dir = data.path.length ? data.path.join("/") : "";
        this.state.dir = dir;
        this.table.func.dataRequest({
            dir
        });
    }

    // Tree has been changed
    async onTreeDataChange(data) {
        this.setLoadingTree(true);
        try {
            await axios({
                method: "post",
                url: "/api/pages/tree/save",
                data: {
                    tree: data.data.c
                },
                headers: {
                    Authorization: `Bearer ${this.token}`
                }
            });
            this.setLoadingTree(false);
        } catch (e) {
            this.setLoadingTree(false);
            this.state.error = e && e.response && e.response.data && e.response.data.error && e.response.data.error.errorKeyword ? this.i18n.t(e.response.data.error.errorKeyword) : this.i18n.t("couldNotLoadDataFromServer");
        }
    }
};
