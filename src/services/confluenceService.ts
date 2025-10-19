// Confluence Cloud REST v1 (stable)
import axios, { AxiosError } from "axios";

const base = process.env.CONFLUENCE_BASE_URL!.replace(/\/$/, ""); // https://<site>.atlassian.net/wiki
const email = process.env.CONFLUENCE_EMAIL!;
const token = process.env.CONFLUENCE_API_KEY!;
const auth = "Basic " + Buffer.from(`${email}:${token}`).toString("base64");

export const cf = axios.create({
  baseURL: `${base}/rest/api`,
  headers: {
    Authorization: auth,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
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

// --- helpers (v1) ---
export async function getMe() {
  return (await cf.get("/user/current")).data; // v1 equivalent
}

// GET /space?spaceKey=KEY
export async function getSpaceByKey(spaceKey: string) {
  const r = await cf.get(`/space`, { params: { spaceKey, limit: 1 } });
  return r.data?._links ? r.data.results?.[0] ?? null : r.data.results?.[0] ?? null;
}

// POST /space
export async function createSpace(spaceKey: string, name: string, desc?: string) {
  const body: any = { key: spaceKey, name };
  if (desc) body.description = { plain: { value: desc, representation: "plain" } };
  return (await cf.post(`/space`, body)).data;
}

// GET /content?spaceKey=KEY&title=...&expand=version,body.storage
export async function getPageByTitle(spaceKey: string, title: string) {
  const r = await cf.get(`/content`, {
    params: { spaceKey, title, expand: "version,body.storage", limit: 1 }
  });
  return r.data?.results?.[0] ?? null;
}

// POST /content (type: page)
export async function createPage(spaceKey: string, title: string, storageHtml: string, parentId?: string) {
  const body: any = {
    type: "page",
    title,
    space: { key: spaceKey },
    body: { storage: { value: storageHtml, representation: "storage" } },
  };
  if (parentId) body.ancestors = [{ id: parentId }];
  return (await cf.post(`/content`, body)).data;
}

// PUT /content/{id}
export async function updatePage(pageId: string, newTitle: string, storageHtml: string) {
  const cur = (await cf.get(`/content/${pageId}`, { params: { expand: "version" } })).data;
  const nextVersion = (cur?.version?.number ?? 0) + 1;
  const body = {
    id: pageId,
    type: "page",
    title: newTitle,
    version: { number: nextVersion },
    body: { storage: { value: storageHtml, representation: "storage" } },
  };
  return (await cf.put(`/content/${pageId}`, body)).data;
}