"use strict";
// confluencePublisher.ts (or wherever you put these helpers)
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertPageTree = exports.ensureSpace = exports.toTitleCase = exports.normalizeSpaceKey = void 0;
const confluenceService_1 = require("./confluenceService");
function normalizeSpaceKey(input) {
    // Uppercase alnum, must start with a letter, length 2..255
    let key = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z]/.test(key))
        key = "X" + key; // Confluence prefers starting letter
    if (key.length < 2)
        key = (key + "XX").slice(0, 2);
    if (key.length > 255)
        key = key.slice(0, 255);
    return key;
}
exports.normalizeSpaceKey = normalizeSpaceKey;
function toTitleCase(s) {
    return s
        .replace(/[-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
exports.toTitleCase = toTitleCase;
async function ensureSpace({ key, name, description }) {
    // 1) Check first
    const existing = await (0, confluenceService_1.getSpaceByKey)(key);
    if (existing) {
        console.log(`✅ Using existing space: ${key} (id=${existing.id})`);
        return existing;
    }
    // 2) Create if not found
    console.log(`🆕 Creating new space: ${key} (${name})`);
    try {
        const created = await (0, confluenceService_1.createSpace)(key, name, description);
        console.log(`✅ Space created: ${key} (id=${created.id})`);
        return created;
    }
    catch (e) {
        const status = e?.response?.status;
        const data = e?.response?.data;
        const errors = data?.data?.errors || data?.errors || [];
        console.error("❌ createSpace failed", { status, message: e?.message, errors });
        // If server says key already exists, treat as existing
        const alreadyExists = Array.isArray(errors) && errors.some((er) => {
            const msg = (er?.message || er)?.toString().toLowerCase();
            return msg.includes("already exist") || msg.includes("already in use") || msg.includes("duplicate");
        });
        if (alreadyExists) {
            const again = await (0, confluenceService_1.getSpaceByKey)(key);
            if (again) {
                console.log(`ℹ️ Space key ${key} reported as existing; proceeding with id=${again.id}`);
                return again;
            }
        }
        throw e; // rethrow unknown 400s
    }
}
exports.ensureSpace = ensureSpace;
async function upsertPageTree(opts, options = {}) {
    const { deleteMissing = false, ignoreTitles = [], dryRun = false } = options;
    const space = await ensureSpace({ key: opts.spaceKey, name: opts.spaceName, description: opts.spaceDesc });
    const spaceKey = space.key || opts.spaceKey;
    // Ensure root page exists
    const rootExisting = await (0, confluenceService_1.getPageByTitle)(spaceKey, opts.rootTitle);
    let root;
    if (rootExisting) {
        console.log(`📝 Updating existing root page: "${opts.rootTitle}" (id=${rootExisting.id})`);
        const currentHtml = rootExisting.body?.storage?.value ?? "<p>Updated root</p>";
        root = dryRun ? rootExisting : await (0, confluenceService_1.updatePage)(rootExisting.id, opts.rootTitle, currentHtml);
    }
    else {
        console.log(`📄 Creating root page: "${opts.rootTitle}"`);
        root = dryRun ? { id: "DRY_RUN" } : await (0, confluenceService_1.createPage)(spaceKey, opts.rootTitle, "<p>RepoMind root</p>");
    }
    // Create / Update children
    for (const p of opts.pages) {
        const existing = await (0, confluenceService_1.getPageByTitle)(spaceKey, p.title);
        if (existing) {
            console.log(`🔁 Updating page: "${p.title}" (id=${existing.id})`);
            if (!dryRun)
                await (0, confluenceService_1.updatePage)(existing.id, p.title, p.html);
        }
        else {
            console.log(`➕ Creating page: "${p.title}" (parent=${root.id})`);
            if (!dryRun)
                await (0, confluenceService_1.createPage)(spaceKey, p.title, p.html, root.id);
        }
    }
    // Optional cleanup: delete pages not present in the new set
    if (deleteMissing) {
        const desiredTitles = new Set([opts.rootTitle, ...opts.pages.map(p => p.title)]);
        for (const t of ignoreTitles)
            desiredTitles.add(t);
        const existingPages = await (0, confluenceService_1.listPagesInSpace)(spaceKey);
        for (const ep of existingPages) {
            const title = ep.title || "";
            if (!desiredTitles.has(title)) {
                console.log(`🗑️ Removing stale page: "${title}" (id=${ep.id})`);
                if (!dryRun)
                    await (0, confluenceService_1.movePageToTrash)(ep.id);
            }
        }
    }
    return { spaceId: space.id, rootId: root.id };
}
exports.upsertPageTree = upsertPageTree;
