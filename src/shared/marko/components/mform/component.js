const {
    InputMask
} = require("imask");
const {
    format,
    parse,
    parseISO,
} = require("date-fns");
const axios = require("axios");
const cloneDeep = require("lodash.clonedeep");
const ExtendedValidation = require("../../../lib/extendedValidation").default;

const serializableTypes = ["text", "select", "radio", "checkbox", "checkboxes", "file", "captcha", "textarea", "ace", "keyvalue", "images", "image", "range", "datepicker", "tags"];

module.exports = class {
    onCreate(input) {
        let tabs;
        if (input.tabsAvail && input.tabsActive) {
            tabs = input.tabsActive.map(taId => input.tabsAvail.find(t => t.id === taId));
        } else if (input.tabsAvail) {
            tabs = input.tabsAvail;
        } else {
            tabs = [{
                id: "__default",
                label: "",
                default: true
            }];
        }
        const state = {
            tabs,
            tabsSelect: [],
            tabSettingsDialogActive: false,
            activeTabId: tabs[0].id,
            data: {},
            error: null,
            errors: {},
            disabled: false,
            progress: false,
            loading: false,
            allSettled: false,
            validation: input.validation,
            visible: {}
        };
        tabs.map(tab => {
            state.data[tab.id] = {};
            state.errors[tab.id] = {};
        });
        this.fieldsFlat = input.fields.reduce((acc, val) => acc.concat(val), []);
        this.fieldsFlat.map(f => state.visible[f.id] = true);
        if (input.fields) {
            tabs.map(tab => this.fieldsFlat.map(i => state.data[tab.id][i.id] = this.getDefaultValue(i)));
        }
        this.state = state;
        if (input.validation) {
            this.extendedValidation = new ExtendedValidation(null, input.validation.root, input.validation.part, input.validation.files, tabs.map(t => t.id));
        }
        this.func = {
            autoFocus: this.autoFocus.bind(this),
            loadData: this.loadData.bind(this),
            setProgress: this.setProgress.bind(this),
            setData: this.setData.bind(this),
            setValue: this.setValue.bind(this),
            getValue: this.getValue.bind(this),
            submitForm: this.submitForm.bind(this),
            setError: this.setError.bind(this),
            resetData: this.resetData.bind(this),
            setFieldVisible: this.setFieldVisible.bind(this),
            setFieldEnabled: this.setFieldEnabled.bind(this),
            setFieldMandatory: this.setFieldMandatory.bind(this),
            getItemData: this.getItemData.bind(this),
            setItemData: this.setItemData.bind(this),
            emitFieldsUpdate: this.emitFieldsUpdate.bind(this),
            setAceValue: this.setAceValue.bind(this),
            getAceInstance: this.getAceInstance.bind(this),
            focus: this.focus.bind(this),
        };
        this.i18n = input.i18n;
        this.masked = {};
        this.captchaSecret = undefined;
        this.fieldsSettled = 0;
    }

    getDefaultValue(item) {
        if (item.defaultValue) {
            return item.defaultValue;
        }
        switch (item.type) {
        case "select":
            return item.options && item.options.length ? item.options[0].value : null;
        case "checkbox":
            return false;
        case "checkboxes":
        case "tags":
            return [];
        case "keyvalue":
            return {
                data: "", label: ""
            };
            // case "datepicker":
            // return "";
        default:
            return null;
        }
    }

    autoFocus() {
        const autoFocusField = this.fieldsFlat.find(i => i.autoFocus);
        if (autoFocusField && this.getComponent(`mf_cmp_${autoFocusField.id}`)) {
            this.getComponent(`mf_cmp_${autoFocusField.id}`).func.setFocus();
        }
    }

    focus(id) {
        const component = this.getComponent(`mf_cmp_${id}`);
        if (component) {
            component.func.setFocus();
        }
    }

    emitFieldsUpdate() {
        this.fieldsFlat.map(f => {
            const component = this.getComponent(`mf_cmp_${f.id}`);
            if (component && component.func.performUpdate) {
                component.func.performUpdate();
            }
        });
    }

    insertImageURL(url) {
        this.fieldsFlat.map(f => {
            const component = this.getComponent(`mf_cmp_${f.id}`);
            if (component && component.func.performUpdate) {
                component.func.insertImage(url);
            }
        });
    }

    onMount() {
        this.contextMenu = this.getComponent("z3_mf_image_menu");
        document.addEventListener("click", () => {
            if (this.contextMenu) {
                this.contextMenu.setActive(false);
            }
        });
        window.addEventListener("scroll", () => {
            if (this.contextMenu) {
                this.contextMenu.setActive(false);
            }
        });
        this.autoFocus();
        this.fieldsFlat.map(field => {
            if (field.maskOptions) {
                const element = document.getElementById(`${this.input.id}_${field.id}`);
                if (element) {
                    this.masked[field.id] = new InputMask(element, field.maskOptions);
                }
            }
            if (this.input.save) {
                this.getComponent(`mf_cmp_${field.id}`).func.setHeaders(this.input.save.headers);
            }
        });
        this.dataOnMount = cloneDeep(this.state.data);
        window.__zoiaCoreImagesBrowser = {
            insertImageURL: this.insertImageURL.bind(this)
        };
        this.setState("allSettled", true);
    }

    resetData() {
        this.setState("data", this.dataOnMount);
        this.setError(null);
        this.state.tabs.map(tab => {
            this.state.errors[tab.id] = {};
        });
        this.fieldsFlat.map(field => {
            setTimeout(() => this.setAceValue(field.id, ""), 10);
        });
    }

    onTabClick(e) {
        const dataset = Object.keys(e.target.dataset).length ? e.target.dataset : Object.keys(e.target.parentNode.dataset).length ? e.target.parentNode.dataset : Object.keys(e.target.parentNode.parentNode.dataset).length ? e.target.parentNode.parentNode.dataset : {};
        this.setState("activeTabId", dataset.id);
        setTimeout(this.emitFieldsUpdate.bind(this), 0);
        setTimeout(this.autoFocus.bind(this), 0);
        this.fieldsFlat.map(field => {
            if (this.masked[field.id]) {
                this.masked[field.id].destroy();
                setTimeout(() => {
                    const element = document.getElementById(`${this.input.id}_${field.id}`);
                    this.masked[field.id] = new InputMask(element, field.maskOptions);
                }, 10);
            }
        });
    }

    onTabSettingsClick() {
        const tabsSelect = this.input.tabsAvail.map(tab => ({
            ...tab,
            selected: !!this.state.tabs.find(t => t.id === tab.id)
        }));
        this.setState("tabsSelect", tabsSelect);
        this.setState("tabSettingsDialogActive", true);
    }

    onTabsSelectChange(e) {
        const tabsSelect = cloneDeep(this.state.tabsSelect);
        const {
            id
        } = e.target.dataset;
        const {
            checked
        } = e.target;
        const tab = tabsSelect.find(t => t.id === id);
        if (tab) {
            tab.selected = checked;
        }
        this.setState("tabsSelect", tabsSelect);
        setTimeout(this.emitFieldsUpdate.bind(this), 0);
    }

    onTabSettingsDialogCloseClick() {
        this.setState("tabSettingsDialogActive", false);
    }

    onTabSettingsDialogSaveClick() {
        let tabs = cloneDeep(this.state.tabs);
        const data = cloneDeep(this.state.data);
        const errors = {};
        tabs.map(t => errors[t.id] = {});
        let dataCurrent = {};
        if (this.state.activeTabId) {
            dataCurrent = cloneDeep(this.state.data[this.state.activeTabId]);
        } else {
            this.fieldsFlat.map(i => dataCurrent[i.id] = this.getDefaultValue(i));
        }
        this.state.tabsSelect.map(ts => {
            const findTab = tabs.find(t => t.id === ts.id);
            // Add missing tabs and data
            if (ts.selected && !findTab) {
                delete ts.selected;
                tabs.push(ts);
                data[ts.id] = {};
                errors[ts.id] = {};
                this.fieldsFlat.map(i => data[ts.id][i.id] = i.shared ? dataCurrent[i.id] : this.getDefaultValue(i));
            }
            // Remove existing tabs and data
            if (!ts.selected && findTab) {
                tabs = tabs.filter(t => t.id !== ts.id);
                delete data[ts.id];
                delete errors[ts.id];
            }
        });
        let activeTabId = cloneDeep(this.state.activeTabId);
        if (!tabs.find(t => t.id === activeTabId)) {
            if (Object.keys(tabs).length) {
                activeTabId = tabs[0].id;
            } else {
                activeTabId = null;
            }
        }
        if (this.state.validation) {
            this.extendedValidation.setParts(tabs.map(t => t.id));
        }
        this.setState("data", data);
        this.setState("errors", errors);
        this.setState("tabs", tabs);
        this.setState("tabSettingsDialogActive", false);
        this.setState("activeTabId", activeTabId);
        setTimeout(this.emitFieldsUpdate.bind(this), 0);
        if (activeTabId) {
            this.autoFocus();
        }
    }

    onValueChange(obj) {
        const data = cloneDeep(this.state.data);
        let {
            value,
        } = obj;
        const item = this.fieldsFlat.find(i => i.id === obj.id);
        switch (item.type) {
        case "select":
            obj.label = item.options.find(i => String(i.value) === String(obj.value)).label;
            break;
        }
        switch (obj.type) {
        case "boolean":
            value = Boolean(value);
            break;
        case "file":
        case "images":
            const prev = data[this.state.activeTabId][obj.id] ? data[this.state.activeTabId][obj.id] : [];
            value = [...prev, ...Array.from(value)];
            break;
        case "image":
            value = Array.from(value);
            break;
        case "arr":
            let currentItemState = cloneDeep(data[this.state.activeTabId][obj.id]);
            const checked = !!value;
            if (currentItemState.indexOf(obj.inputid) === -1 && checked) {
                currentItemState.push(obj.inputid);
            }
            if (currentItemState.indexOf(obj.inputid) > -1 && !checked) {
                currentItemState = currentItemState.filter(i => i !== obj.inputid);
            }
            value = currentItemState;
            break;
        case "tags":
            value = Array.from(new Set(value));
            break;
        case "datepicker":
            value = value ? format(value, "yyyyMMdd") : null;
            break;
        default:
            value = String(value).trim();
        }
        data[this.state.activeTabId][obj.id] = value;
        if (this.fieldsFlat.find(f => f.id === obj.id).shared) {
            this.state.tabs.map(tab => data[tab.id][obj.id] = value);
        }
        this.emit("value-change", obj);
        this.setState("data", data);
    }

    setValue(id, value) {
        const data = cloneDeep(this.state.data);
        data[this.state.activeTabId][id] = value;
        if (this.fieldsFlat.find(f => f.id === id).shared) {
            this.state.tabs.map(tab => data[tab.id][id] = value);
        }
        this.setState("data", data);
        const component = this.getComponent(`mf_cmp_${id}`);
        if (component && component.func.performUpdate) {
            component.func.performUpdate();
        }
    }

    onValueSet(data) {
        this.setValue(data.id, data.value);
    }

    setAceValue(id, value) {
        const component = this.getComponent(`mf_cmp_${id}`);
        if (component && component.func.setAceValue) {
            component.func.setAceValue(value);
        }
    }

    getAceInstance(id) {
        const component = this.getComponent(`mf_cmp_${id}`);
        if (component && component.func.getAceInstance) {
            return component.func.getAceInstance();
        }
    }

    getValue(id) {
        return this.masked[id] ? this.masked[id].unmaskedValue : this.state.data[this.state.activeTabId][id];
    }

    onRemoveArrItem(obj) {
        const data = {
            ...this.state.data
        };
        const value = data[this.state.activeTabId][obj.id].filter(i => i.id !== obj.itemid);
        data[this.state.activeTabId][obj.id] = value;
        if (this.fieldsFlat.find(f => f.id === obj.id).shared) {
            this.state.tabs.map(tab => data[tab.id][obj.id] = value);
        }
        this.setState("data", data);
    }

    onSetPrimaryArrItem(obj) {
        const data = cloneDeep(this.state.data);
        if (data[this.state.activeTabId][obj.id].length < 2) {
            return;
        }
        const currentIndex = data[this.state.activeTabId][obj.id].findIndex(i => i.id === obj.itemid);
        const element = data[this.state.activeTabId][obj.id][currentIndex];
        data[this.state.activeTabId][obj.id].splice(currentIndex, 1);
        data[this.state.activeTabId][obj.id].splice(0, 0, element);
        this.setState("data", data);
    }

    onMoveLeftArrItem(obj) {
        const data = cloneDeep(this.state.data);
        if (data[this.state.activeTabId][obj.id].length < 2) {
            return;
        }
        const currentIndex = data[this.state.activeTabId][obj.id].findIndex(i => i.id === obj.itemid);
        if (currentIndex === 0) {
            return;
        }
        const element = data[this.state.activeTabId][obj.id][currentIndex];
        data[this.state.activeTabId][obj.id].splice(currentIndex, 1);
        data[this.state.activeTabId][obj.id].splice(currentIndex - 1, 0, element);
        this.setState("data", data);
    }

    onMoveRightArrItem(obj) {
        const data = cloneDeep(this.state.data);
        if (data[this.state.activeTabId][obj.id].length < 2) {
            return;
        }
        const currentIndex = data[this.state.activeTabId][obj.id].findIndex(i => i.id === obj.itemid);
        if (currentIndex === data[this.state.activeTabId][obj.id].length - 1) {
            return;
        }
        const element = data[this.state.activeTabId][obj.id][currentIndex];
        data[this.state.activeTabId][obj.id].splice(currentIndex, 1);
        data[this.state.activeTabId][obj.id].splice(currentIndex + 1, 0, element);
        this.setState("data", data);
    }

    visualizeErrors(validationErrors, generalError = true) {
        let errorData = cloneDeep(validationErrors);
        const errors = {};
        const formData = cloneDeep(this.state.data);
        this.state.tabs.map(tab => errors[tab.id] = {});
        if (errorData && errorData.length) {
            // Identify field for each error
            errorData.map(error => {
                error.field = error.dataPath;
                if (!error.field && error.params && error.params.missingProperty) {
                    error.field = error.params.missingProperty;
                }
                if (error.field) {
                    error.field = error.field.replace(/^\./, "");
                    if (error.clear) {
                        formData[this.state.activeTabId][error.field] = "";
                        if (this.masked[error.field]) {
                            this.masked[error.field].value = "";
                            this.masked[error.field].maskedValue = "";
                            this.masked[error.field].updateValue();
                        }
                    }
                    if (error.reloadCaptcha) {
                        const reloadCaptchaComponent = this.getComponent(error.field);
                        if (reloadCaptchaComponent) {
                            reloadCaptchaComponent.func.reloadCaptcha();
                        }
                    }
                } else {
                    error.field = null;
                }
            });
            // Sort errors as it appears on form
            errorData = errorData.sort((i1, i2) => {
                const f1 = this.fieldsFlat.findIndex(f => f.id === i1.field);
                const f2 = this.fieldsFlat.findIndex(f => f.id === i2.field);
                if (f1 === f2) {
                    return 0;
                }
                return f1 > f2 ? 1 : -1;
            });
            // Set keywords for errors
            errorData.map(error => {
                const {
                    field
                } = error;
                if (!field) {
                    return;
                }
                const {
                    keyword,
                    part
                } = error;
                if (part) {
                    errors[part][field] = this.i18n.t(`mFormErr.${keyword}`) || keyword;
                } else {
                    this.state.tabs.map(tab => errors[tab.id][field] = this.i18n.t(`mFormErr.${keyword}`) || keyword);
                }
            });
        }
        let focus = false;
        Object.keys(errors).map(tab => {
            if (!focus && Object.keys(errors[tab]).length) {
                this.setState("activeTabId", tab);
                const firstField = Object.keys(errors[tab])[0];
                const firstFieldComponent = this.getComponent(`mf_cmp_${firstField}`);
                if (firstFieldComponent) {
                    setTimeout(firstFieldComponent.func.setFocus.bind(this), 0);
                    focus = true;
                }
            }
        });
        if (generalError) {
            this.setError(focus ? this.i18n.t(`mFormErr.general`) : null);
        }
        this.setState("errors", errors);
        this.setState("data", formData);
    }

    async validate(serialized) {
        const data = cloneDeep(serialized);
        if (!this.state.validation) {
            return {
                failed: false,
                errorData: []
            };
        }
        const validationResult = await this.extendedValidation.validate(data);
        this.fieldsFlat.map(field => {
            if (field.shouldMatch) {
                const value1 = String(this.state.data[this.state.activeTabId][field.id]);
                const value2 = String(this.state.data[this.state.activeTabId][field.shouldMatch]);
                if ((field.mandatory && (!value1 || value1 !== value2)) || (!field.mandatory && value1 !== value2)) {
                    validationResult.failed = true;
                    validationResult.errorData.push({
                        keyword: "shouldMatch",
                        dataPath: `.${field.id}`,
                        message: `Should match ${field.shouldMatch}`
                    });
                }
            }
        });
        return validationResult;
    }

    processSerializedValue(field, value) {
        let valueProcess = value;
        if (field.convert) {
            if (!value || value === "") {
                valueProcess = field.convert === "string" ? "" : null;
            } else {
                valueProcess = field.convert === "integer" ? parseInt(value, 10) : field.convert === "float" ? parseFloat(value, "") : field.convert === "boolean" ? value === "true" || value === "1" : String(value);
            }
        } else if (value === "" && field.emptyNull) {
            valueProcess = null;
        }
        if ((field.type === "file" || field.type === "images" || field.type === "image") && !Array.isArray(value)) {
            valueProcess = [];
        }
        if (field.type === "keyvalue") {
            valueProcess = value.data;
        }
        if (field.type === "datepicker") {
            valueProcess = value;
        }
        return valueProcess;
    }

    serialize(undef) {
        const serialized = {};
        const data = cloneDeep(this.state.data);
        this.fieldsFlat.map(field => {
            if (field.shared) {
                const valueRaw = this.masked[field.id] ? this.masked[field.id].unmaskedValue : data[this.state.activeTabId][field.id];
                const value = this.processSerializedValue(field, valueRaw);
                if (field.tags) {
                    const valueArr = value && Array.isArray(value) ? value : value && typeof value === "string" ? value.replace(/\s/gm, "").split(",") : [];
                    serialized[field.id] = [...new Set(valueArr)];
                } else {
                    serialized[field.id] = value;
                    if (undef && (serialized[field.id] === null || serialized[field.id] === "")) {
                        serialized[field.id] = undefined;
                    }
                }
            } else {
                this.state.tabs.map(tab => {
                    serialized[tab.id] = serialized[tab.id] || {};
                    const valueRaw = this.masked[field.id] ? this.masked[field.id].unmaskedValue : data[tab.id][field.id];
                    const value = this.processSerializedValue(field, valueRaw);
                    if (field.tags) {
                        const valueArr = value ? value.replace(/\s/gm, "").split(",") : [];
                        serialized[tab.id][field.id] = [...new Set(valueArr)];
                    } else {
                        serialized[tab.id][field.id] = value;
                        if (undef && (serialized[tab.id][field.id] === null || serialized[tab.id][field.id] === "")) {
                            serialized[tab.id][field.id] = undefined;
                        }
                    }
                });
            }
        });
        return serialized;
    }

    flatten(object, prefix = "") {
        return Object.keys(object).reduce((prev, element) => (object[element] && typeof object[element] === "object" && !(object[element] instanceof File) && !Array.isArray(element) ? {
            ...prev,
            ...this.flatten(object[element], `${prefix}${element}.`)
        } : {
            ...prev,
            ...{
                [`${prefix}${element}`]: object[element]
            }
        }), {});
    }

    filterSerialized(serialized) {
        let data = cloneDeep(serialized);
        this.state.tabs.map(tab => {
            Object.keys(data[tab.id]).map(i => {
                if (data[tab.id][i] && Array.isArray(data[tab.id][i])) {
                    data[tab.id][i].map(f => {
                        if (typeof f === "object" && (f.type === "file" || f.type === "image")) {
                            if (f.data) {
                                delete f.data;
                                f.upload = true;
                            } else {
                                delete f.upload;
                            }
                        }
                    });
                }
                const field = this.fieldsFlat.find(f => f.id === i);
                if (field && field.type && serializableTypes.indexOf(field.type) === -1) {
                    data[tab.id][field.id] = undefined;
                }
            });
        });
        Object.keys(data).map(i => {
            if (data[i] && Array.isArray(data[i])) {
                data[i].map(f => {
                    if (typeof f === "object" && (f.type === "file" || f.type === "image")) {
                        if (f.data) {
                            delete f.data;
                            f.upload = true;
                        } else {
                            delete f.upload;
                        }
                    }
                });
            }
            const field = this.fieldsFlat.find(f => f.id === i);
            if (field && field.type && serializableTypes.indexOf(field.type) === -1) {
                data[field.id] = undefined;
            }
        });
        if (this.state.tabs[0].id === "__default") {
            data = {
                ...data,
                ...data.__default
            };
            delete data.__default;
        }
        return data;
    }

    setProgress(state) {
        this.setState("progress", state);
        this.setState("disabled", state);
    }

    async upload(serialized) {
        if (!this.input.save) {
            return;
        }
        const data = cloneDeep(serialized);
        let uploadData;
        if (this.input.formType === "formData") {
            uploadData = new FormData();
            const serializedFlat = this.flatten(data);
            if (this.input.save.extras) {
                Object.keys(this.input.save.extras).map(e => uploadData.append(e, this.input.save.extras[e]));
            }
            if (this.captchaSecret) {
                uploadData.append("captchaSecret", this.captchaSecret);
            }
            uploadData.append("__form", JSON.stringify(this.filterSerialized(data)));
            Object.keys(serializedFlat).map(i => {
                if (serializedFlat[i] && serializedFlat[i] instanceof File) {
                    uploadData.append(serializedFlat[i].zuid, serializedFlat[i]);
                }
            });
        } else {
            uploadData = this.filterSerialized(data);
            if (this.input.save.extras) {
                uploadData = {
                    ...uploadData,
                    ...this.input.save.extras,
                    captchaSecret: this.captchaSecret
                };
            }
        }
        try {
            this.setProgress(true);
            const result = await axios.post(this.input.save.url, uploadData, this.input.save.headers ? {
                headers: this.input.save.headers
            } : undefined);
            this.setProgress(false);
            this.emit("post-success", result);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
            if (e && e.response && e.response.status === 401) {
                this.emit("unauthorized", {});
            } else {
                this.emit("post-fail", e);
            }
            this.setProgress(false);
            if (e.response && e.response.data && e.response.data.error) {
                const errorKeyword = e.response.data.error.errorKeyword || (e.response.data.error.errorData && e.response.data.error.errorData.length && e.response.data.error.errorData[0] && e.response.data.error.errorData[0].keyword) ? e.response.data.error.errorKeyword ? e.response.data.error.errorKeyword : e.response.data.error.errorData[0].keyword : null;
                if (errorKeyword) {
                    this.setError(this.i18n.t(`mFormErr.${errorKeyword || "general"}`));
                } else {
                    this.setError(this.i18n.t(`mFormErr.server`));
                }
                if (e.response.data.error.errorData) {
                    this.visualizeErrors(e.response.data.error.errorData, false);
                }
            } else {
                this.setError(this.i18n.t(`mFormErr.server`));
            }
            this.getEl(`${this.input.id}_mForm_Wrap`).scrollIntoView();
        }
    }

    async submitForm(noEmit) {
        return this.onFormSubmit(noEmit);
    }

    async onFormSubmit(e) {
        e && e.preventDefault ? e.preventDefault() : null;
        const serialized = this.serialize(true);
        const validationResult = await this.validate(serialized);
        this.visualizeErrors(validationResult.errorData);
        if (validationResult.failed) {
            this.emit("validation-fail", validationResult);
            return false;
        }
        const data = this.serialize(false);
        if (e !== true) {
            this.emit("form-submit", data);
        }
        if (this.input.manual && (e !== true || !this.input.save)) {
            return true;
        }
        await this.upload(data);
        return false;
    }

    onButtonClick(obj) {
        this.emit("button-click", obj);
    }

    deserialize(raw) {
        const data = {};
        if (this.input.tabsAvail) {
            // Deserialize all tabs
            this.input.tabsAvail.map(tab => {
                data[tab.id] = {};
                this.fieldsFlat.map(field => {
                    data[tab.id][field.id] = raw[tab.id] && raw[tab.id][field.id] ? raw[tab.id][field.id] : this.getDefaultValue(field);
                    if (field.type === "datepicker" && data[tab.id][field.id]) {
                        const date = data[tab.id][field.id];
                        data[tab.id][field.id] = parse(date, "yyyyMMdd", new Date()) || null;
                        // eslint-disable-next-line no-self-compare
                        if (!data[tab.id][field.id] || (data[tab.id][field.id] instanceof Date && data[tab.id][field.id].getTime() !== data[tab.id][field.id].getTime())) {
                            data[tab.id][field.id] = parseISO(date);
                        }
                        // eslint-disable-next-line no-self-compare
                        if (data[tab.id][field.id] instanceof Date && data[tab.id][field.id].getTime() === data[tab.id][field.id].getTime()) {
                            data[tab.id][field.id] = format(data[tab.id][field.id], "yyyyMMdd");
                        } else {
                            data[tab.id][field.id] = null;
                        }
                    }
                    if (this.masked[field.id]) {
                        this.masked[field.id].destroy();
                        setTimeout(() => {
                            const element = document.getElementById(`${this.input.id}_${field.id}`);
                            this.masked[field.id] = new InputMask(element, field.maskOptions);
                        }, 1);
                    }
                });
            });
            // Deserialize shared fields
            this.input.tabsAvail.map(tab => {
                this.fieldsFlat.map(field => {
                    if (raw[field.id]) {
                        data[tab.id][field.id] = raw[field.id];
                        if (field.type === "datepicker" && data[tab.id][field.id]) {
                            const date = data[tab.id][field.id];
                            data[tab.id][field.id] = parse(date, "yyyyMMdd", new Date()) || null;
                            // eslint-disable-next-line no-self-compare
                            if (!data[tab.id][field.id] || (data[tab.id][field.id] instanceof Date && data[tab.id][field.id].getTime() !== data[tab.id][field.id].getTime())) {
                                data[tab.id][field.id] = parseISO(date);
                            }
                            // eslint-disable-next-line no-self-compare
                            if (data[tab.id][field.id] instanceof Date && data[tab.id][field.id].getTime() === data[tab.id][field.id].getTime()) {
                                data[tab.id][field.id] = format(data[tab.id][field.id], "yyyyMMdd");
                            } else {
                                data[tab.id][field.id] = null;
                            }
                        }
                        if (this.masked[field.id]) {
                            this.masked[field.id].destroy();
                            setTimeout(() => {
                                const element = document.getElementById(`${this.input.id}_${field.id}`);
                                this.masked[field.id] = new InputMask(element, field.maskOptions);
                            }, 1);
                        }
                    }
                });
            });
        } else {
            // There are no tabs
            data.__default = {};
            this.fieldsFlat.map(field => {
                data.__default[field.id] = raw[field.id] || this.getDefaultValue(field);
                if (field.type === "datepicker" && data.__default[field.id]) {
                    const date = data.__default[field.id];
                    data.__default[field.id] = parse(date, "yyyyMMdd", new Date()) || null;
                    // eslint-disable-next-line no-self-compare
                    if (!data.__default[field.id] || (data.__default[field.id] instanceof Date && data.__default[field.id].getTime() !== data.__default[field.id].getTime())) {
                        data.__default[field.id] = parseISO(date);
                    }
                    // eslint-disable-next-line no-self-compare
                    if (data.__default[field.id] instanceof Date && data.__default[field.id].getTime() === data.__default[field.id].getTime()) {
                        data.__default[field.id] = format(data.__default[field.id], "yyyyMMdd");
                    } else {
                        data.__default[field.id] = null;
                    }
                }
                if (this.masked[field.id]) {
                    this.masked[field.id].destroy();
                    setTimeout(() => {
                        const element = document.getElementById(`${this.input.id}_${field.id}`);
                        this.masked[field.id] = new InputMask(element, field.maskOptions);
                    }, 1);
                }
            });
        }
        return data;
    }

    setData(data) {
        this.setState("data", this.deserialize(data));
        setTimeout(this.autoFocus.bind(this), 0);
        setTimeout(this.emitFieldsUpdate.bind(this), 0);
    }

    async loadData() {
        if (!this.input.load) {
            return;
        }
        this.setState("loading", true);
        this.setState("disabled", true);
        try {
            const result = await axios.post(this.input.load.url, this.input.load.extras, this.input.load.headers ? {
                headers: this.input.load.headers
            } : undefined);
            this.setState("loading", false);
            this.setState("disabled", false);
            if (result && result.data && result.data.data) {
                if (this.input.tabsAvail && this.input.tabsActive) {
                    const tabs = this.input.tabsAvail.map(t => {
                        if (result.data.data[t.id]) {
                            return t;
                        }
                        return null;
                    }).filter(t => t);
                    this.setState("tabs", tabs);
                    const errors = {};
                    tabs.map(tab => {
                        errors[tab.id] = {};
                    });
                    if (tabs.length) {
                        this.setState("activeTabId", tabs[0].id);
                    }
                    this.setState("errors", errors);
                }
                this.setData(result.data.data);
                this.emit("load-success", result.data.data);
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
            if (e && e.response && e.response.status === 401) {
                this.emit("unauthorized", {});
            }
            this.setState("loading", false);
            if (e && e.response && e.response.data && e.response.data.error && e.response.data.error.errorKeyword) {
                this.getComponent(`${this.input.id}_mnotify`).func.show(this.i18n.t(`mFormErr.${e.response.data.error.errorKeyword}`) || this.i18n.t(`mFormErr.server`), "is-danger");
            } else {
                this.getComponent(`${this.input.id}_mnotify`).func.show(this.i18n.t(`mFormErr.server`), "is-danger");
            }
            this.emit("load-error");
        }
    }

    onCaptcha(secret) {
        this.captchaSecret = secret;
    }

    onGetKeyValue(data) {
        this.emit("get-key-value", data);
    }

    setError(error) {
        setTimeout(() => this.setState("error", error), 1);
        if (error) {
            setTimeout(() => {
                const mFormError = document.getElementById(`${this.input.id}_mForm_Error`);
                if (mFormError) {
                    const y = mFormError.top + window.scrollY;
                    window.scroll({
                        top: y
                    });
                }
            }, 100);
        }
    }

    onContextMenu(data) {
        this.contextMenuId = data.fieldId;
        this.contextMenu.setActive(true, data.x, data.y, data.id);
    }

    onMenuItemClick(data) {
        this.contextMenu.setActive(false);
        switch (data.cmd) {
        case "delete":
            this.onRemoveArrItem({
                id: this.contextMenuId,
                itemid: data.uid
            });
            break;
        case "primary":
            this.onSetPrimaryArrItem({
                id: this.contextMenuId,
                itemid: data.uid
            });
            break;
        case "left":
            this.onMoveLeftArrItem({
                id: this.contextMenuId,
                itemid: data.uid
            });
            break;
        case "right":
            this.onMoveRightArrItem({
                id: this.contextMenuId,
                itemid: data.uid
            });
            break;
        }
    }

    setFieldVisible(id, flag) {
        this.getComponent(`mf_cmp_${id}`).func.setVisible(flag);
        const visible = cloneDeep(this.state.visible);
        visible[id] = flag;
        this.setState("visible", visible);
    }

    setFieldEnabled(id, flag) {
        this.getComponent(`mf_cmp_${id}`).func.setEnabled(flag);
    }

    setFieldMandatory(id, flag) {
        this.getComponent(`mf_cmp_${id}`).func.setMandatory(flag);
        this.fieldsFlat.find(i => i.id === id).mandatory = flag;
        if (this.state.validation) {
            if (this.state.validation.root && this.state.validation.root.properties && this.state.validation.root.properties[id]) {
                const rootIndex = this.state.validation.root.required.indexOf(id);
                if (!flag) {
                    this.state.validation.root.required = this.state.validation.root.required.filter(i => i !== id);
                } else if (rootIndex === -1) {
                    this.state.validation.root.required.push(id);
                }
                this.extendedValidation.setSchemaRoot(this.state.validation.root);
            }
            if (this.state.validation.part && this.state.validation.part.properties && this.state.validation.part.properties[id]) {
                const partIndex = this.state.validation.part.required.indexOf(id);
                if (!flag) {
                    this.state.validation.part.required = this.state.validation.part.required.filter(i => i !== id);
                } else if (partIndex === -1) {
                    this.state.validation.part.required.push(id);
                }
                this.extendedValidation.setSchemaPart(this.state.validation.part);
            }
        }
    }

    setItemData(id, data) {
        this.getComponent(`mf_cmp_${id}`).func.setData(data);
        const currentData = this.fieldsFlat[this.fieldsFlat.findIndex(i => i.id === id)];
        this.fieldsFlat[this.fieldsFlat.findIndex(i => i.id === id)] = {
            ...currentData,
            ...data
        };
    }

    getItemData(id) {
        return this.getComponent(`mf_cmp_${id}`).func.getData();
    }

    onFieldSettled() {
        this.fieldsSettled += 1;
        if (this.fieldsSettled === this.fieldsFlat.length) {
            this.emit("all-settled");
        }
    }
};
