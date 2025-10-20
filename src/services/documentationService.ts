import { promises as fs } from "fs";
import * as path from "path";
import { semanticSearch } from "./searchService";
import { loadChunkTexts } from "./chunkTextLoader";
import { OpenAIGenerator } from "../ai/adapters/openaiGenerator";
import { inferCategory } from "../types/docs";
import type { DocSectionSpec, DocCategory } from "../types/docs";
import type { Generator } from "../ai/interfaces";
import OpenAI from "openai";
import { importEsm } from "../utils/importEsm"; // 👈 add this near the top

type MarkedNS = typeof import("marked");
let _markedNS: Promise<MarkedNS> | null = null;

function getMarked() {
  return (_markedNS ??= importEsm<MarkedNS>("marked"));
}

async function renderMarkdown(md: string): Promise<string> {
  const { marked } = await getMarked();
  return String(marked.parse(md));
}

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

export async function generateDocsPages(opts: {
  owner: string;
  repo: string;
  commit: string;
  tenantId?: string;
  bucket?: string;
  sections: DocSectionSpec[];
  capSnippetChars?: number;
  keepIfCategory?: boolean;
}): Promise<{ title: string; html: string }[]> {
  const {
    owner, repo, commit, tenantId, bucket,
    sections, capSnippetChars = 2500, keepIfCategory = true
  } = opts;

  const generator = new OpenAIGenerator({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  });

  const pages: { title: string; html: string }[] = [];

  for (const sec of sections) {
    // ---- same retrieval pipeline as generateDocsLocal ----
    const collected = new Map<string, { id: string; file_path: string; start_line: number; end_line: number; lang: string; distance: number }>();
    for (const q of sec.queries) {
      const vec = await embedQuery(q);
      const hits = await semanticSearch({
        owner, repo, queryVector: vec, topK: sec.topK ?? 16, provider: "openai",
      });
      for (const h of hits) if (!collected.has(h.id)) collected.set(h.id, h);
    }

    const wanted = sec.category;
    const allHits = Array.from(collected.values());
    const filtered = wanted && keepIfCategory
      ? allHits.filter(h => {
          const cat = inferCategory(h.file_path);
          if (wanted === "architecture") return true;
          if (cat === "unknown") return true;
          return cat === wanted;
        })
      : allHits;

    let snippets: { id: string; filePath: string; startLine: number; endLine: number; text: string }[] = [];
    if (bucket) {
      const textMap = await loadChunkTexts({
        s3: new (await import("@aws-sdk/client-s3")).S3Client({ region: process.env.AWS_REGION || "eu-west-2" }),
        bucket,
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

    const md = await generateSectionMarkdown({
      title: sec.title,
      q: sec.queries.join(" | "),
      hint: sec.hint,
      snippets,
      generator
    });

    const html = await renderMarkdown(md);
    pages.push({ title: sec.title, html });
  }

  return pages;
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
  const lower = title.toLowerCase();

  // ---------- Architecture ----------
  if (lower.includes("architecture")) {
    const system = `You write **software architecture** docs in Markdown using ONLY the provided context.
- Be accurate and evidence-based; never invent components.
- Add inline citations like [chunk-id] beside each claim.
- Prefer Mermaid diagrams (system context, component, sequence, deployment) when supported by evidence.
- Mark uncertain/unknown details explicitly as **Unknown** with the closest citation.`;

    const prompt =
`# ${title}

> Topics: ${q}
${hint ? `> Hint: ${hint}` : ""}

## Context
${context || "_No context snippets loaded._"}

## Output Requirements

### Overview
- Purpose/scope and core capabilities. [chunk-id]

### System Context (Mermaid)
- External actors and how they interact (HTTP/webhooks/queues). [chunk-id]

### Components
- Major components (controllers, services, jobs, storage, external APIs). [chunk-id]
- For each: **Responsibility**, **Inputs/Outputs**, **Dependencies**. [chunk-id]
- Include a component diagram if supported.

### Data Flow / Sequence (Mermaid)
- Typical request/job path and async boundaries (queues/schedulers). [chunk-id]

### Configuration & Secrets
- Key env vars/config and where they are used. [chunk-id]

### Reliability & Performance
- Retries, idempotency, timeouts, rate-limiting, indexing/caching. [chunk-id]

### Security
- AuthN/Z, webhook verification, data access restrictions. [chunk-id]

### Observability
- Logging, metrics, tracing, health checks. [chunk-id]

### Deployment / Runtime Topology (optional)
- Processes/containers/workers; add a deployment diagram if warranted. [chunk-id]

### Risks & Gaps
- Unknowns, TODOs, edge cases; cite closest evidence.

## Instructions
- Derive all details strictly from the snippets; do not guess beyond evidence.
- Use inline citations like [3339a3abe4b6-0001] near each claim.`;

    return await generator.generate(prompt, { system, maxTokens: 2200, temperature: 0.12 })
      || `# ${title}\n_Context unavailable._`;
  }

  // ---------- Services ----------
  if (lower.includes("services")) {
    const system = `You write **service-level** documentation in Markdown using ONLY the provided context.
- Be precise about responsibilities, inputs/outputs, dependencies, side effects.
- Add inline citations like [chunk-id] beside each claim.
- Include sequence diagrams when helpful and supported by evidence.`;

    const prompt =
`# ${title}

> Topics: ${q}
${hint ? `> Hint: ${hint}` : ""}

## Context
${context || "_No context snippets loaded._"}

## Output Requirements

### Service Catalogue
- For each service/module discovered in the snippets:
  - **Name/Location** (file path). [chunk-id]
  - **Responsibilities**. [chunk-id]
  - **Public API** (functions, signatures, expected params/returns). [chunk-id]
  - **Dependencies** (other services, DB, S3, external APIs). [chunk-id]
  - **Side Effects** (writes, network calls, messages). [chunk-id]
  - **Error Handling** (error types, retries, backoff). [chunk-id]
  - **Configuration** (env vars used). [chunk-id]

### Interactions (Mermaid sequence, if supported)
- Typical call flow between services and external systems. [chunk-id]

### Gotchas & Constraints
- Performance notes, rate limits, idempotency, concurrency concerns. [chunk-id]

## Instructions
- Cite snippets inline like [3339a3abe4b6-0001].
- If something cannot be confirmed from context, mark it **Unknown**.`;

    return await generator.generate(prompt, { system, maxTokens: 1800, temperature: 0.12 })
      || `# ${title}\n_Context unavailable._`;
  }

  // ---------- Routes & Endpoints ----------
  if (lower.includes("routes") || lower.includes("endpoints")) {
    const system = `You produce precise **API route documentation** in Markdown using ONLY the provided context.
- Extract endpoints from Express routers/controllers.
- For each endpoint, document: method, full path, auth requirements, params (path/query/body) with type & required/optional, request example, response schemas and examples for 200 plus common errors, and status codes.
- Add inline citations like [chunk-id] for each extracted fact.
- If a detail is not in context, mark it **Unknown**.`;

    const prompt =
`# ${title}

> Topics: ${q}
${hint ? `> Hint: ${hint}` : ""}

## Context
${context || "_No context snippets loaded._"}

## Endpoints
For **each** endpoint discovered in the snippets, include a block like:

### \`METHOD /path\`
- **Description:** … [chunk-id]
- **Auth:** \`required|optional|Unknown\` (e.g., HMAC, token, header names). [chunk-id]
- **Path Params:**
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | …    | …    | yes/no   | … [chunk-id] |
- **Query Params:**
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | …    | …    | yes/no   | … [chunk-id] |
- **Body Schema:**
  \`\`\`json
  { /* inferred shape; Unknown fields must be marked */ }
  \`\`\` [chunk-id]
- **Request Example:**
  \`\`\`bash
  curl -X METHOD https://host/path \\
    -H 'content-type: application/json' \\
    -d '{ ... }'
  \`\`\`
- **Responses:**
  - **200 OK** (schema + example)
    \`\`\`json
    { /* representative success */ }
    \`\`\` [chunk-id]
  - **4xx/5xx** (list likely errors seen in snippets: 400, 401, 403, 404, 409, 429, 500)
    | Status | When | Example Payload |
    |--------|------|------------------|
    | 400 | invalid input | \`{ "error": "…" }\` [chunk-id] |
    | 401 | auth failed | \`{ "error": "…" }\` [chunk-id] |
    | …  | … | … |

## Notes
- If router composition or middleware affects routes (prefixes, versioning), document that. [chunk-id]
- Mark anything not directly evidenced as **Unknown**.

## Instructions
- Do not invent fields or paths. Cite every concrete claim.`;

    return await generator.generate(prompt, { system, maxTokens: 2000, temperature: 0.12 })
      || `# ${title}\n_Context unavailable._`;
  }

  // ---------- Controllers ----------
  if (lower.includes("controller")) {
    const system = `You write **controller-level** documentation in Markdown using ONLY the provided context.
- Explain responsibilities, validation, side effects, downstream calls, and error mapping.
- Document response shapes: success (200) and error variants with examples.
- Add inline citations like [chunk-id] for each claim.`;

    const prompt =
`# ${title}

> Topics: ${q}
${hint ? `> Hint: ${hint}` : ""}

## Context
${context || "_No context snippets loaded._"}

## Controllers
For each controller/handler found:

### Handler: \`name\` (file path)
- **Purpose & Triggers:** when/how it's invoked. [chunk-id]
- **Inputs/Validation:** expected params, schema checks, defaults. [chunk-id]
- **Control Flow:** main steps; calls to services/DB/external APIs. [chunk-id]
- **Side Effects:** writes, messages, S3/HTTP calls. [chunk-id]
- **Responses:**
  - **200 OK** example
    \`\`\`json
    { /* representative success */ }
    \`\`\` [chunk-id]
  - **Errors** (status → when → example body)
    | Status | Condition | Example |
    |--------|-----------|---------|
    | 400 | validation failed | \`{ "error": "…" }\` [chunk-id] |
    | 401/403 | auth/permission | … |
    | 500 | unhandled | … |
- **Middleware/Guards:** auth, signature verification, rate limiters. [chunk-id]
- **Observability:** logs, metrics, tracing, error reporting. [chunk-id]

## Instructions
- Cite every concrete fact with [chunk-id].
- Mark gaps as **Unknown** where the snippets don’t prove it.`;

    return await generator.generate(prompt, { system, maxTokens: 1900, temperature: 0.12 })
      || `# ${title}\n_Context unavailable._`;
  }

  // ---------- Generic (fallback) ----------
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

  return await generator.generate(prompt, { system, maxTokens: 1400, temperature: 0.15 })
    || `# ${title}\n_Context unavailable._`;
}