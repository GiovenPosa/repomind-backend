"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLatestCommit = void 0;
const s3Util_1 = require("../utils/s3Util");
async function resolveLatestCommit(opts) {
    const { s3, bucket, tenantId, owner, repo, branch } = opts;
    // Prefer branch pointer if given, otherwise use "refs/latest.json"
    const base = (0, s3Util_1.s3Prefix)({ tenantId, owner, repo });
    const key = branch
        ? `${base}refs/branches/${branch}.json`
        : `${base}refs/latest.json`;
    const ref = await (0, s3Util_1.getJson)(s3, bucket, key);
    if (!ref?.commit) {
        throw new Error(`Could not resolve latest commit (key: ${key})`);
    }
    return ref.commit;
}
exports.resolveLatestCommit = resolveLatestCommit;
