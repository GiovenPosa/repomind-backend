import { getSpaceByKey, createSpace, getPageByTitle, createPage, updatePage } from "./confluenceService";

export async function ensureSpace({ key, name, description }: { key: string; name: string; description?: string }) {
  const existing = await getSpaceByKey(key);
  if (existing) return existing;
  return await createSpace(key, name, description);
}

export async function upsertPageTree(opts: {
  spaceKey: string; spaceName: string; spaceDesc?: string;
  rootTitle: string; pages: { title: string; html: string }[];
}) {
  const space = await ensureSpace({ key: opts.spaceKey, name: opts.spaceName, description: opts.spaceDesc });
  const spaceId = space.id;

  // ensure root page
  const rootExisting = await getPageByTitle(spaceId, opts.rootTitle);
  const root = rootExisting
    ? await updatePage(rootExisting.id, opts.rootTitle, rootExisting.body?.storage?.value ?? "<p>Updated root</p>")
    : await createPage(spaceId, opts.rootTitle, "<p>RepoMind root</p>");

  // children
  for (const p of opts.pages) {
    const existing = await getPageByTitle(spaceId, p.title);
    if (existing) await updatePage(existing.id, p.title, p.html);
    else await createPage(spaceId, p.title, p.html, root.id);
  }
  return { spaceId, rootId: root.id };
}