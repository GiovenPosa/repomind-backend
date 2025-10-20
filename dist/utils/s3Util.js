"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamToBuffer = exports.s3Head = exports.getText = exports.getJson = exports.putText = exports.putJson = exports.putJsonRaw = exports.putJsonUnderRepo = exports.s3Prefix = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
function s3Prefix({ tenantId, owner, repo }) {
    return `tenants/${tenantId ?? 'default'}/repos/${owner}/${repo}/`;
}
exports.s3Prefix = s3Prefix;
/** Put JSON under repo prefix, e.g. commits/{sha}/manifest.json */
async function putJsonUnderRepo(s3, layout, keyUnderRepo, data) {
    const key = s3Prefix(layout) + keyUnderRepo;
    await s3.send(new client_s3_1.PutObjectCommand({
        Bucket: layout.bucket,
        Key: key,
        Body: Buffer.from(JSON.stringify(data, null, 2), "utf8"),
        ContentType: "application/json",
    }));
}
exports.putJsonUnderRepo = putJsonUnderRepo;
/** Put arbitrary JSON at a raw bucket/key (no repo prefix added) */
async function putJsonRaw(s3, bucket, key, data) {
    await s3.send(new client_s3_1.PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(JSON.stringify(data, null, 2), "utf8"),
        ContentType: "application/json",
    }));
}
exports.putJsonRaw = putJsonRaw;
/** Put JSON at exact bucket/key */
async function putJson(s3, bucket, key, data) {
    await s3.send(new client_s3_1.PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(JSON.stringify(data, null, 2), "utf8"),
        ContentType: "application/json",
    }));
}
exports.putJson = putJson;
/** Put UTF-8 text at exact bucket/key */
async function putText(s3, bucket, key, text, contentType = "text/plain; charset=utf-8") {
    await s3.send(new client_s3_1.PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(text, "utf8"),
        ContentType: contentType,
    }));
}
exports.putText = putText;
/** Read and JSON.parse an object */
async function getJson(s3, bucket, key) {
    const obj = await s3.send(new client_s3_1.GetObjectCommand({ Bucket: bucket, Key: key }));
    const buf = await streamToBuffer(obj.Body);
    return JSON.parse(buf.toString("utf8"));
}
exports.getJson = getJson;
/** Read an object as UTF-8 string */
async function getText(s3, bucket, key) {
    const obj = await s3.send(new client_s3_1.GetObjectCommand({ Bucket: bucket, Key: key }));
    const buf = await streamToBuffer(obj.Body);
    return buf.toString("utf8");
}
exports.getText = getText;
/** HEAD check (exists?) */
async function s3Head(s3, bucket, key) {
    try {
        await s3.send(new client_s3_1.HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
    }
    catch {
        return false;
    }
}
exports.s3Head = s3Head;
/** Convert S3 stream/body to a Buffer */
async function streamToBuffer(stream) {
    const chunks = [];
    return await new Promise((resolve, reject) => {
        stream.on("data", (d) => chunks.push(d));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });
}
exports.streamToBuffer = streamToBuffer;
