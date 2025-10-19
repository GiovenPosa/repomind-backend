// confluencePublisher.ts (or wherever you put these helpers)

import { getSpaceByKey, createSpace, getPageByTitle, createPage, updatePage } from "./confluenceService";

export function normalizeSpaceKey(input: string) {
  // Uppercase alnum, must start with a letter, length 2..255
  let key = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]/.test(key)) key = "X" + key;   // Confluence prefers starting letter
  if (key.length < 2) key = (key + "XX").slice(0, 2);
  if (key.length > 255) key = key.slice(0, 255);
  return key;
}

export function toTitleCase(s: string) {
  return s
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function ensureSpace({ key, name, description }: { key: string; name: string; description?: string }) {
  // 1) Check first
  const existing = await getSpaceByKey(key);
  if (existing) {
    console.log(`✅ Using existing space: ${key} (id=${existing.id})`);
    return existing;
  }

  // 2) Create if not found
  console.log(`🆕 Creating new space: ${key} (${name})`);
  try {
    const created = await createSpace(key, name, description);
    console.log(`✅ Space created: ${key} (id=${created.id})`);
    return created;
  } catch (e: any) {
    const status = e?.response?.status;
    const data = e?.response?.data;
    const errors = data?.data?.errors || data?.errors || [];
    console.error("❌ createSpace failed", { status, message: e?.message, errors });

    // If server says key already exists, treat as existing
    const alreadyExists = Array.isArray(errors) && errors.some((er: any) => {
      const msg = (er?.message || er)?.toString().toLowerCase();
      return msg.includes("already exist") || msg.includes("already in use") || msg.includes("duplicate");
    });

    if (alreadyExists) {
      const again = await getSpaceByKey(key);
      if (again) {
        console.log(`ℹ️ Space key ${key} reported as existing; proceeding with id=${again.id}`);
        return again;
      }
    }

    throw e; // rethrow unknown 400s
  }
}

export async function upsertPageTree(opts: {
  spaceKey: string; spaceName: string; spaceDesc?: string;
  rootTitle: string; pages: { title: string; html: string }[];
}) {
  const space = await ensureSpace({ key: opts.spaceKey, name: opts.spaceName, description: opts.spaceDesc });
  const spaceId = space.id;

  // ensure root page
  const rootExisting = await getPageByTitle(space.key || opts.spaceKey, opts.rootTitle);
  let root;
  if (rootExisting) {
    console.log(`📝 Updating existing root page: "${opts.rootTitle}" (id=${rootExisting.id})`);
    const currentHtml = rootExisting.body?.storage?.value ?? "<p>Updated root</p>";
    root = await updatePage(rootExisting.id, opts.rootTitle, currentHtml);
  } else {
    console.log(`📄 Creating root page: "${opts.rootTitle}"`);
    root = await createPage(space.key || opts.spaceKey, opts.rootTitle, "<p>RepoMind root</p>");
  }

  // children
  for (const p of opts.pages) {
    const existing = await getPageByTitle(space.key || opts.spaceKey, p.title);
    if (existing) {
      console.log(`🔁 Updating page: "${p.title}" (id=${existing.id})`);
      await updatePage(existing.id, p.title, p.html);
    } else {
      console.log(`➕ Creating page: "${p.title}" (parent=${root.id})`);
      await createPage(space.key || opts.spaceKey, p.title, p.html, root.id);
    }
  }

  return { spaceId, rootId: root.id };
}