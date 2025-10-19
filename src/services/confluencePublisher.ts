// src/services/confluencePublisher.ts
import { getSpaceByKey, createSpaceV2, createSpaceV1, getPageByTitle, createPage, updatePage } from "./confluenceService";

export async function ensureSpace(opts: { key: string; name: string; description?: string }) {
  const { key, name, description } = opts;

  // 1) If it exists, return it
  const existing = await getSpaceByKey(key);
  if (existing) return existing;

  // 2) Try v2 create
  try {
    return await createSpaceV2(key, name, description);
  } catch (e: any) {
    const status = e?.response?.status;
    // 3) Fallback to v1 create (handles tenants that 404 on v2)
    try {
      return await createSpaceV1(key, name, description);
    } catch (e2: any) {
      console.error("Space create failed:", {
        v2Status: status,
        v2Payload: e?.response?.data,
        v1Status: e2?.response?.status,
        v1Payload: e2?.response?.data,
      });
      throw e2;
    }
  }
}

export async function upsertPageTree(opts: {
  spaceKey: string; spaceName: string; spaceDesc?: string;
  rootTitle: string; pages: { title: string; html: string }[];
}) {
  // ensure space (with v1 fallback)
  const space = await ensureSpace({ key: opts.spaceKey, name: opts.spaceName, description: opts.spaceDesc });
  const spaceId = space.id;

  // ensure root page
  const rootExisting = await getPageByTitle(spaceId, opts.rootTitle);
  const root = rootExisting
    ? await updatePage(rootExisting.id, opts.rootTitle, rootExisting.body?.storage?.value ?? "<p>RepoMind root</p>")
    : await createPage(spaceId, opts.rootTitle, "<p>RepoMind root</p>");

  // children
  for (const p of opts.pages) {
    const existing = await getPageByTitle(spaceId, p.title);
    if (existing) await updatePage(existing.id, p.title, p.html);
    else await createPage(spaceId, p.title, p.html, root.id);
  }
  return { spaceId, rootId: root.id };
}