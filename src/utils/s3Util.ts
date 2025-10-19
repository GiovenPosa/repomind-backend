import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import type { S3IngestLayout } from "../types/s3";

/** Build the S3 prefix for a repo namespace */
type S3RepoScope = { tenantId?: string; owner: string; repo: string };
export function s3Prefix({ tenantId, owner, repo }: S3RepoScope) {
  return `tenants/${tenantId ?? 'default'}/repos/${owner}/${repo}/`;
}

/** Put JSON under repo prefix, e.g. commits/{sha}/manifest.json */
export async function putJsonUnderRepo(
  s3: S3Client,
  layout: S3IngestLayout,
  keyUnderRepo: string,
  data: unknown
) {
  const key = s3Prefix(layout) + keyUnderRepo;
  await s3.send(
    new PutObjectCommand({
      Bucket: layout.bucket,
      Key: key,
      Body: Buffer.from(JSON.stringify(data, null, 2), "utf8"),
      ContentType: "application/json",
    })
  );
}

/** Put arbitrary JSON at a raw bucket/key (no repo prefix added) */
export async function putJsonRaw(
  s3: S3Client,
  bucket: string,
  key: string,
  data: unknown
) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(JSON.stringify(data, null, 2), "utf8"),
      ContentType: "application/json",
    })
  );
}

/** Put JSON at exact bucket/key */
export async function putJson(
  s3: S3Client,
  bucket: string,
  key: string,
  data: unknown
) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(JSON.stringify(data, null, 2), "utf8"),
      ContentType: "application/json",
    })
  );
}

/** Put UTF-8 text at exact bucket/key */
export async function putText(
  s3: S3Client,
  bucket: string,
  key: string,
  text: string,
  contentType = "text/plain; charset=utf-8"
) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(text, "utf8"),
      ContentType: contentType,
    })
  );
}

/** Read and JSON.parse an object */
export async function getJson<T>(
  s3: S3Client,
  bucket: string,
  key: string
): Promise<T> {
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const buf = await streamToBuffer(obj.Body as any);
  return JSON.parse(buf.toString("utf8")) as T;
}

/** Read an object as UTF-8 string */
export async function getText(
  s3: S3Client,
  bucket: string,
  key: string
): Promise<string> {
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const buf = await streamToBuffer(obj.Body as any);
  return buf.toString("utf8");
}

/** HEAD check (exists?) */
export async function s3Head(
  s3: S3Client,
  bucket: string,
  key: string
): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Convert S3 stream/body to a Buffer */
export async function streamToBuffer(
  stream: NodeJS.ReadableStream
): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (d) => chunks.push(d));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}