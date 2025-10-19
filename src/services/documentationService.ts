import { promises as fs } from "fs";
import * as path from "path";
import { semanticSearch } from "./searchService";
import { loadChunkTexts } from "./chunkTextLoader";
import { OpenAIGenerator } from "../ai/adapters/openaiGenerator";
import { inferCategory } from "../types/docs";
import type { DocSectionSpec, DocCategory } from "../types/docs";
import type { Generator } from "../ai/interfaces";
import OpenAI from "openai";

// small helper to embed queries without coupling to your controller
async function embedQuery(q: string): Promise<number[]> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const model = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
  const r = await client.embeddings.create({ model, input: [q] });
  return r.data[0].embedding;
}

type GenOpts = {
  owner: string;
  repo: string;
  commit: string;
  outDir?: string;          // local output folder; default ./generated-docs/<owner>_<repo>_<sha>
  tenantId?: string;        // for loading chunk texts from S3
  bucket?: string;          // same
  // retrieval tuning
  sections: DocSectionSpec[];
  capSnippetChars?: number; // default 2500
  keepIfCategory?: boolean; // default true -> filter to section category when we can infer
};

export async function generateDocsLocal(opts: GenOpts) {
  const {
    owner, repo, commit, tenantId, bucket,
    sections,
    outDir = path.join(process.cwd(), "generated-docs", `${owner}_${repo}_${commit.slice(0,7)}`),
    capSnippetChars = 2500,
    keepIfCategory = true
  } = opts;

  await fs.mkdir(outDir, { recursive: true });

  const generator = new OpenAIGenerator({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  });

  // For each section: run multiple generic queries, merge hits, categorize & filter
  for (const sec of sections) {
    const collected = new Map<string, { // id -> hit
      id: string; file_path: string; start_line: number; end_line: number; lang: string; distance: number;
    }>();

    for (const q of sec.queries) {
      const vec = await embedQuery(q);
      const hits = await semanticSearch({
        owner, repo, queryVector: vec, topK: sec.topK ?? 16, provider: "openai",
      });
      for (const h of hits) if (!collected.has(h.id)) collected.set(h.id, h);
    }

    // categorize & optionally filter to section category
    const wantedCategory: DocCategory | undefined = sec.category;
    const allHits = Array.from(collected.values());
    const filtered = wantedCategory && keepIfCategory
      ? allHits.filter(h => {
          const cat = inferCategory(h.file_path);
          if (wantedCategory === "architecture") return true; // keep broad
          if (cat === "unknown") return true;                 // unknowns may still be useful
          return cat === wantedCategory;
        })
      : allHits;

    // load chunk texts from S3 jsonl
    const s3Needed = { tenantId, bucket };
    if (!s3Needed.bucket) {
      // If you didn’t pass S3 info, we’ll still make the doc—without snippet text we’ll be sparse.
      console.warn("⚠️ No S3 bucket provided. Docs will have limited context.");
    }

    let snippets: { id: string; filePath: string; startLine: number; endLine: number; text: string }[] = [];
    if (s3Needed.bucket) {
      const textMap = await loadChunkTexts({
        s3: (await import("@aws-sdk/client-s3")).S3Client
          ? new (await import("@aws-sdk/client-s3")).S3Client({ region: process.env.AWS_REGION || "eu-west-2" })
          : (undefined as any),
        bucket: s3Needed.bucket!,
        tenantId,
        owner,
        repo,
        commit,
        chunkIds: filtered.map(h => h.id),
      });
      snippets = filtered.map(h => {
        const row = textMap[h.id];
        const txt = (row?.text ?? "").slice(0, capSnippetChars);
        return {
          id: h.id,
          filePath: row?.filePath ?? h.file_path,
          startLine: row?.startLine ?? h.start_line,
          endLine: row?.endLine ?? h.end_line,
          text: txt
        };
      }).filter(s => s.text && s.text.length);
    }

    // build context and let the LLM render markdown
    const md = await generateSectionMarkdown({
      title: sec.title,
      q: sec.queries.join(" | "),
      hint: sec.hint,
      snippets,
      generator
    });

    const outPath = path.join(outDir, sec.outFile);
    await fs.writeFile(outPath, md, "utf8");
    console.log(`📄 wrote ${outPath}`);
  }

  // write an index README
  const index = `# Repository Documentation\n\n${sections.map(s => `- [${s.title}](./${s.outFile})`).join("\n")}\n`;
  await fs.writeFile(path.join(outDir, "README.md"), index, "utf8");
  console.log(`📚 wrote ${path.join(outDir, "README.md")}`);

  return { outDir };
}

/* ---- prompt for markdown ---- */
function buildContextBlock(snips: { id: string; filePath: string; startLine: number; endLine: number; text: string }[]) {
  return snips.map(s => 
`[${s.id}] ${s.filePath}:${s.startLine}-${s.endLine}
${s.text}
---`).join("\n");
}

async function generateSectionMarkdown(opts: {
  title: string;
  q: string;
  hint?: string;
  snippets: { id: string; filePath: string; startLine: number; endLine: number; text: string }[];
  generator: Generator;
}) {
  const { title, q, hint, snippets, generator } = opts;
  const context = buildContextBlock(snippets);

  const system = `You write **software documentation** in Markdown for arbitrary repositories.
- Use ONLY the provided context.
- Be accurate and concise.
- Add inline citations like [chunk-id] next to claims derived from a snippet.
- Prefer bullet lists, tables, and Mermaid diagrams where helpful.`;

  const prompt =
`# ${title}

> Topics: ${q}
${hint ? `> Hint: ${hint}` : ""}

## Context
${context || "_No context snippets loaded._"}

## Instructions
- Produce a clear Markdown page for this topic.
- Include Overview, How it Works, Key Components, and Gotchas.
- Cite snippets inline like [3339a3abe4b6-0001].
- If context is insufficient, explicitly state gaps and suggest where to look.`;

  return await generator.generate(prompt, { system, maxTokens: 1400, temperature: 0.15 }) || `# ${title}\n_Context unavailable._`;
}