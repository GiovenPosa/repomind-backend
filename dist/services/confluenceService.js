"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.movePageToTrash = exports.listPagesInSpace = exports.updatePage = exports.createPage = exports.getPageByTitle = exports.createSpace = exports.getSpaceByKey = exports.getMe = exports.cf = void 0;
// Confluence Cloud REST v1 (stable)
const axios_1 = __importDefault(require("axios"));
const base = process.env.CONFLUENCE_BASE_URL.replace(/\/$/, ""); // https://<site>.atlassian.net/wiki
const email = process.env.CONFLUENCE_EMAIL;
const token = process.env.CONFLUENCE_API_KEY;
const auth = "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
exports.cf = axios_1.default.create({
    baseURL: `${base}/rest/api`,
    headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
    },
    timeout: 20000,
});
// simple 429/5xx retry
exports.cf.interceptors.response.use(undefined, async (err) => {
    const status = err.response?.status ?? 0;
    if (status === 429 || status >= 500) {
        const wait = Number(err.response?.headers?.["retry-after"] ?? 1) * 1000 || 1000;
        await new Promise(r => setTimeout(r, wait));
        return exports.cf.request(err.config);
    }
    throw err;
});
// --- helpers (v1) ---
async function getMe() {
    return (await exports.cf.get("/user/current")).data; // v1 equivalent
}
exports.getMe = getMe;
// GET /space?spaceKey=KEY
async function getSpaceByKey(spaceKey) {
    const r = await exports.cf.get(`/space`, { params: { spaceKey, limit: 1 } });
    return r.data?._links ? r.data.results?.[0] ?? null : r.data.results?.[0] ?? null;
}
exports.getSpaceByKey = getSpaceByKey;
// POST /space
async function createSpace(spaceKey, name, desc) {
    const body = { key: spaceKey, name };
    if (desc)
        body.description = { plain: { value: desc, representation: "plain" } };
    return (await exports.cf.post(`/space`, body)).data;
}
exports.createSpace = createSpace;
// GET /content?spaceKey=KEY&title=...&expand=version,body.storage
async function getPageByTitle(spaceKey, title) {
    const r = await exports.cf.get(`/content`, {
        params: { spaceKey, title, expand: "version,body.storage", limit: 1 }
    });
    return r.data?.results?.[0] ?? null;
}
exports.getPageByTitle = getPageByTitle;
// POST /content (type: page)
async function createPage(spaceKey, title, storageHtml, parentId) {
    const body = {
        type: "page",
        title,
        space: { key: spaceKey },
        body: { storage: { value: storageHtml, representation: "storage" } },
    };
    if (parentId)
        body.ancestors = [{ id: parentId }];
    return (await exports.cf.post(`/content`, body)).data;
}
exports.createPage = createPage;
// PUT /content/{id}
async function updatePage(pageId, newTitle, storageHtml) {
    const cur = (await exports.cf.get(`/content/${pageId}`, { params: { expand: "version" } })).data;
    const nextVersion = (cur?.version?.number ?? 0) + 1;
    const body = {
        id: pageId,
        type: "page",
        title: newTitle,
        version: { number: nextVersion },
        body: { storage: { value: storageHtml, representation: "storage" } },
    };
    return (await exports.cf.put(`/content/${pageId}`, body)).data;
}
exports.updatePage = updatePage;
// List all pages in a space (flat, paginated)
async function listPagesInSpace(spaceKey) {
    const pages = [];
    let start = 0;
    const limit = 50;
    while (true) {
        const r = await exports.cf.get(`/content`, {
            params: {
                spaceKey,
                type: "page",
                status: "current",
                expand: "version",
                limit,
                start,
            },
        });
        pages.push(...(r.data?.results || []));
        if (!r.data?._links?.next)
            break;
        start += limit;
    }
    return pages;
}
exports.listPagesInSpace = listPagesInSpace;
// Soft-delete (move to Trash)
async function movePageToTrash(pageId) {
    // Confluence Cloud REST v1: DELETE /content/{id} moves the page to trash
    await exports.cf.delete(`/content/${pageId}`);
    return pageId;
}
exports.movePageToTrash = movePageToTrash;
