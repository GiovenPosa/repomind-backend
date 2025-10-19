import { getSpaceByKey, createSpace, getPageByTitle, createPage, updatePage } from "./confluenceService";

export function normalizeSpaceKey(input: string) {
  // Uppercase, alnum only, max 20
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
}

export function toTitleCase(s: string) {
  return s
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function ensureSpace({ key, name, description }: { key: string; name: string; description?: string }) {
  const existing = await getSpaceByKey(key);
  if (existing) {
    console.log(`✅ Using existing space: ${key} (id=${existing.id})`);
    return existing;
  }
  console.log(`🆕 Creating new space: ${key} (${name})`);
  const created = await createSpace(key, name, description);
  console.log(`✅ Space created: ${key} (id=${created.id})`);
  return created;
}

export async function upsertPageTree(opts: {
  spaceKey: string; spaceName: string; spaceDesc?: string;
  rootTitle: string; pages: { title: string; html: string }[];
}) {
  const space = await ensureSpace({ key: opts.spaceKey, name: opts.spaceName, description: opts.spaceDesc });
  const spaceId = space.id;

  // ensure root page
  const rootExisting = await getPageByTitle(spaceId, opts.rootTitle);
  let root;
  if (rootExisting) {
    console.log(`📝 Updating existing root page: "${opts.rootTitle}" (id=${rootExisting.id})`);
    const currentHtml = rootExisting.body?.storage?.value ?? "<p>Updated root</p>";
    root = await updatePage(rootExisting.id, opts.rootTitle, currentHtml);
  } else {
    console.log(`📄 Creating root page: "${opts.rootTitle}"`);
    root = await createPage(spaceId, opts.rootTitle, "<p>RepoMind root</p>");
  }

  // children
  for (const p of opts.pages) {
    const existing = await getPageByTitle(spaceId, p.title);
    if (existing) {
      console.log(`🔁 Updating page: "${p.title}" (id=${existing.id})`);
      await updatePage(existing.id, p.title, p.html);
    } else {
      console.log(`➕ Creating page: "${p.title}" (parent=${root.id})`);
      await createPage(spaceId, p.title, p.html, root.id);
    }
  }

  return { spaceId, rootId: root.id };
}