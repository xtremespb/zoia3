import apiPagesList from "./apiPagesList";
import apiPageSave from "./apiPageSave";
import apiPageLoad from "./apiPageLoad";
import apiPageDelete from "./apiPageDelete";
import apiTree from "./apiTree";

export default fastify => {
    fastify.post("/api/pages/list", apiPagesList());
    fastify.post("/api/pages/edit/save", apiPageSave());
    fastify.post("/api/pages/edit/load", apiPageLoad());
    fastify.post("/api/pages/edit/delete", apiPageDelete());
    fastify.post("/api/pages/tree", apiTree());
};
