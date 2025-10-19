// src/services/confluenceService.ts
import axios, { AxiosError } from "axios";

const base = process.env.CONFLUENCE_BASE_URL!.replace(/\/$/, ""); // https://<site>.atlassian.net/wiki
const email = process.env.CONFLUENCE_EMAIL!;
const token = process.env.CONFLUENCE_API_KEY!;
const auth = "Basic " + Buffer.from(`${email}:${token}`).toString("base64");

const cf = axios.create({
  baseURL: `${base}/api/v2`,
  headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
  timeout: 20000,
});

// simple 429/5xx retry
cf.interceptors.response.use(undefined, async (err: AxiosError) => {
  const status = err.response?.status ?? 0;
  if (status === 429 || status >= 500) {
    const wait = Number(err.response?.headers?.["retry-after"] ?? 1) * 1000 || 1000;
    await new Promise(r => setTimeout(r, wait));
    return cf.request(err.config!);
  }
  throw err;
});

export async function getMe() {
  return (await cf.get("/users/me")).data;
}

export async function getSpaceByKey(spaceKey: string) {
  // v2 supports GET /spaces?keys=KEY
  const r = await cf.get(`/spaces?keys=${encodeURIComponent(spaceKey)}&limit=1`);
  return r.data?.results?.[0] ?? null;
}

export async function createSpace(spaceKey: string, name: string, desc?: string) {
  const body = {
    key: spaceKey,
    name,
    description: desc ? { plain: { value: desc, representation: "plain" } } : undefined,
  };
  return (await cf.post("/spaces", body)).data;
}

export async function createPage(spaceId: string, title: string, storageHtml: string, parentId?: string) {
  const body: any = {
    title,
    spaceId,
    status: "current",
    body: { representation: "storage", value: storageHtml },
  };
  if (parentId) body.parentId = parentId; // set parent to create a tree
  return (await cf.post("/pages", body)).data;
}

export async function getPageByTitle(spaceId: string, title: string) {
  const r = await cf.get(`/pages?space-id=${encodeURIComponent(spaceId)}&title=${encodeURIComponent(title)}&limit=1`);
  return r.data?.results?.[0] ?? null;
}

export async function updatePage(pageId: string, newTitle: string, storageHtml: string) {
  // need current version first
  const cur = (await cf.get(`/pages/${pageId}`)).data;
  const nextVersion = (cur?.version?.number ?? 0) + 1;
  const body = {
    id: pageId,
    title: newTitle,
    status: "current",
    version: { number: nextVersion },
    body: { representation: "storage", value: storageHtml },
  };
  return (await cf.put(`/pages/${pageId}`, body)).data;
}