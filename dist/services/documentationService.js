"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDocsPages = exports.generateDocsLocal = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const searchService_1 = require("./searchService");
const chunkTextLoader_1 = require("./chunkTextLoader");
const openaiGenerator_1 = require("../ai/adapters/openaiGenerator");
const docs_1 = require("../types/docs");
const openai_1 = __importDefault(require("openai"));
const importEsm_1 = require("../utils/importEsm"); // 👈 add this near the top
let _markedNS = null;
function getMarked() {
    return (_markedNS ?? (_markedNS = (0, importEsm_1.importEsm)("marked")));
}
async function renderMarkdown(md) {
    const { marked } = await getMarked();
    return String(marked.parse(md));
}
// small helper to embed queries without coupling to your controller
async function embedQuery(q) {
    const client = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
    const r = await client.embeddings.create({ model, input: [q] });
    return r.data[0].embedding;
}
async function generateDocsLocal(opts) {
    const { owner, repo, commit, tenantId, bucket, sections, outDir = path.join(process.cwd(), "generated-docs", `${owner}_${repo}_${commit.slice(0, 7)}`), capSnippetChars = 5000, keepIfCategory = true } = opts;
    await fs_1.promises.mkdir(outDir, { recursive: true });
    const generator = new openaiGenerator_1.OpenAIGenerator({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
    });
    // For each section: run multiple generic queries, merge hits, categorize & filter
    for (const sec of sections) {
        const collected = new Map();
        for (const q of sec.queries) {
            const vec = await embedQuery(q);
            const hits = await (0, searchService_1.semanticSearch)({
                owner, repo, queryVector: vec, topK: sec.topK ?? 16, provider: "openai",
            });
            for (const h of hits)
                if (!collected.has(h.id))
                    collected.set(h.id, h);
        }
        // categorize & optionally filter to section category
        const wantedCategory = sec.category;
        const allHits = Array.from(collected.values());
        const filtered = wantedCategory && keepIfCategory
            ? allHits.filter(h => {
                const cat = (0, docs_1.inferCategory)(h.file_path);
                if (wantedCategory === "architecture")
                    return true; // keep broad
                if (cat === "unknown")
                    return true; // unknowns may still be useful
                return cat === wantedCategory;
            })
            : allHits;
        // load chunk texts from S3 jsonl
        const s3Needed = { tenantId, bucket };
        if (!s3Needed.bucket) {
            // If you didn’t pass S3 info, we’ll still make the doc—without snippet text we’ll be sparse.
            console.warn("No S3 bucket provided. Docs will have limited context.");
        }
        let snippets = [];
        if (s3Needed.bucket) {
            const textMap = await (0, chunkTextLoader_1.loadChunkTexts)({
                s3: (await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-s3")))).S3Client
                    ? new (await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-s3")))).S3Client({ region: process.env.AWS_REGION || "eu-west-2" })
                    : undefined,
                bucket: s3Needed.bucket,
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
        // Split by file for routes, controllers, and services
        const shouldSplitByFile = sec.id === "routes" || sec.id === "controllers" || sec.id === "services";
        if (shouldSplitByFile && snippets.length > 0) {
            console.log(`📚 Generating one page per file for ${sec.title} (${snippets.length} snippets)`);
            const fileGroups = groupSnippetsByFile(snippets);
            // Generate one page per source file
            for (const group of fileGroups) {
                const { filePath, snippets: fileSnippets } = group;
                // Extract the file name without extension for the page title
                const fileName = path.basename(filePath, path.extname(filePath));
                const fileDir = path.dirname(filePath).split('/').pop(); // get parent folder name
                const md = await generateSectionMarkdown({
                    title: `${sec.title.slice(0, -1)} - ${fileName}`,
                    q: sec.queries.join(" | "),
                    hint: `${sec.hint || ""}\n\nThis page documents: ${filePath}`,
                    snippets: fileSnippets,
                    generator,
                    sectionId: sec.id
                });
                // Create subfolder for the section category
                const sectionDir = path.join(outDir, sec.id);
                await fs_1.promises.mkdir(sectionDir, { recursive: true });
                const outPath = path.join(sectionDir, `${fileName}.md`);
                await fs_1.promises.writeFile(outPath, md, "utf8");
                console.log(`📄 wrote ${outPath} (${fileSnippets.length} snippets from ${filePath})`);
            }
        }
        else {
            // Single-pass generation for architecture, utils, types, database, external-apis
            const md = await generateSectionMarkdown({
                title: sec.title,
                q: sec.queries.join(" | "),
                hint: sec.hint,
                snippets,
                generator,
                sectionId: sec.id
            });
            const outPath = path.join(outDir, sec.outFile);
            await fs_1.promises.writeFile(outPath, md, "utf8");
            console.log(`📄 wrote ${outPath} (${snippets.length} snippets)`);
        }
    }
    // write an index README with proper links to all generated pages
    let indexContent = `# Repository Documentation\n\n`;
    for (const sec of sections) {
        const shouldSplitByFile = sec.id === "routes" || sec.id === "controllers" || sec.id === "services";
        if (shouldSplitByFile) {
            // Check if the section directory exists and list all files
            const sectionDir = path.join(outDir, sec.id);
            try {
                const files = await fs_1.promises.readdir(sectionDir);
                if (files.length > 0) {
                    indexContent += `## ${sec.title}\n`;
                    for (const file of files.sort()) {
                        const fileName = path.basename(file, '.md');
                        indexContent += `- [${fileName}](./${sec.id}/${file})\n`;
                    }
                    indexContent += `\n`;
                }
            }
            catch (err) {
                // Directory doesn't exist, skip
            }
        }
        else {
            // Single file sections
            indexContent += `## ${sec.title}\n- [${sec.title}](./${sec.outFile})\n\n`;
        }
    }
    await fs_1.promises.writeFile(path.join(outDir, "README.md"), indexContent, "utf8");
    console.log(`📚 wrote ${path.join(outDir, "README.md")}`);
    return { outDir };
}
exports.generateDocsLocal = generateDocsLocal;
async function generateDocsPages(opts) {
    const { owner, repo, commit, tenantId, bucket, sections, capSnippetChars = 5000, keepIfCategory = true } = opts;
    const generator = new openaiGenerator_1.OpenAIGenerator({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
    });
    const pages = [];
    for (const sec of sections) {
        // ---- same retrieval pipeline as generateDocsLocal ----
        const collected = new Map();
        for (const q of sec.queries) {
            const vec = await embedQuery(q);
            const hits = await (0, searchService_1.semanticSearch)({
                owner, repo, queryVector: vec, topK: sec.topK ?? 16, provider: "openai",
            });
            for (const h of hits)
                if (!collected.has(h.id))
                    collected.set(h.id, h);
        }
        const wanted = sec.category;
        const allHits = Array.from(collected.values());
        const filtered = wanted && keepIfCategory
            ? allHits.filter(h => {
                const cat = (0, docs_1.inferCategory)(h.file_path);
                if (wanted === "architecture")
                    return true;
                if (cat === "unknown")
                    return true;
                return cat === wanted;
            })
            : allHits;
        let snippets = [];
        if (bucket) {
            const textMap = await (0, chunkTextLoader_1.loadChunkTexts)({
                s3: new (await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-s3")))).S3Client({ region: process.env.AWS_REGION || "eu-west-2" }),
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
        // Split by file for routes, controllers, and services
        const shouldSplitByFile = sec.id === "routes" || sec.id === "controllers" || sec.id === "services";
        if (shouldSplitByFile && snippets.length > 0) {
            console.log(`📚 Generating one page per file for ${sec.title} (${snippets.length} snippets)`);
            const fileGroups = groupSnippetsByFile(snippets);
            // Generate one page per source file
            for (const group of fileGroups) {
                const { filePath, snippets: fileSnippets } = group;
                // Extract the file name without extension for the page title
                const fileName = path.basename(filePath, path.extname(filePath));
                const md = await generateSectionMarkdown({
                    title: `${sec.title.slice(0, -1)} - ${fileName}`,
                    q: sec.queries.join(" | "),
                    hint: `${sec.hint || ""}\n\nThis page documents: ${filePath}`,
                    snippets: fileSnippets,
                    generator,
                    sectionId: sec.id
                });
                const html = await renderMarkdown(md);
                pages.push({ title: `${sec.title.slice(0, -1)} - ${fileName}`, html });
                console.log(`📄 generated page "${fileName}" (${fileSnippets.length} snippets from ${filePath})`);
            }
        }
        else {
            // Single page generation for architecture, utils, types, database, external-apis
            const md = await generateSectionMarkdown({
                title: sec.title,
                q: sec.queries.join(" | "),
                hint: sec.hint,
                snippets,
                generator,
                sectionId: sec.id
            });
            const html = await renderMarkdown(md);
            pages.push({ title: sec.title, html });
            console.log(`📄 generated page "${sec.title}" (${snippets.length} snippets)`);
        }
    }
    return pages;
}
exports.generateDocsPages = generateDocsPages;
function detectLanguage(snippets) {
    const extCounts = new Map();
    for (const s of snippets) {
        const ext = s.filePath.split('.').pop()?.toLowerCase() || "";
        extCounts.set(ext, (extCounts.get(ext) || 0) + 1);
    }
    // Find most common extension
    let maxCount = 0;
    let primaryExt = "";
    for (const [ext, count] of extCounts) {
        if (count > maxCount) {
            maxCount = count;
            primaryExt = ext;
        }
    }
    // Map extensions to languages
    const langMap = {
        "ts": "typescript",
        "tsx": "typescript",
        "js": "javascript",
        "jsx": "javascript",
        "py": "python",
        "go": "go",
        "java": "java",
        "rs": "rust",
        "php": "php",
        "rb": "ruby"
    };
    return langMap[primaryExt] || "unknown";
}
function getLanguageContext(lang) {
    const contexts = {
        typescript: "TypeScript/Node.js backend with Express.js framework, async/await patterns, TypeScript types and interfaces",
        javascript: "JavaScript/Node.js backend with Express.js framework, async/await patterns, CommonJS or ES modules",
        python: "Python backend with Flask/FastAPI/Django framework, decorators, type hints, async/await patterns",
        go: "Go backend with Gorilla/Chi/Gin framework, structs, interfaces, goroutines, channels",
        java: "Java backend with Spring Boot framework, annotations, REST controllers, dependency injection",
        rust: "Rust backend with Actix/Rocket framework, traits, async/await, Result types",
        php: "PHP backend with Laravel/Symfony framework, classes, namespaces, middleware",
        ruby: "Ruby backend with Rails/Sinatra framework, classes, modules, middleware",
        unknown: "Backend codebase"
    };
    return contexts[lang];
}
/* ---- helpers for multi-pass generation ---- */
// Group snippets by file to enable multi-pass generation
function groupSnippetsByFile(snippets) {
    const byFile = new Map();
    for (const s of snippets) {
        if (!byFile.has(s.filePath))
            byFile.set(s.filePath, []);
        byFile.get(s.filePath).push(s);
    }
    return Array.from(byFile.entries()).map(([filePath, snips]) => ({ filePath, snippets: snips }));
}
// Split large collections into batches for multi-pass
function batchSnippets(snippets, maxPerBatch = 50) {
    const batches = [];
    for (let i = 0; i < snippets.length; i += maxPerBatch) {
        batches.push(snippets.slice(i, i + maxPerBatch));
    }
    return batches;
}
/* ---- prompt for markdown ---- */
function buildContextBlock(snips) {
    return snips.map(s => `[${s.id}] ${s.filePath}:${s.startLine}-${s.endLine}
${s.text}
---`).join("\n");
}
async function generateSectionMarkdown(opts) {
    const { title, q, hint, snippets, generator } = opts;
    const context = buildContextBlock(snippets);
    const lower = title.toLowerCase();
    // Detect language for context-aware documentation
    const language = detectLanguage(snippets);
    const langContext = getLanguageContext(language);
    console.log(`🔍 Detected language: ${language} for ${title}`);
    // ---------- Architecture ----------
    if (lower.includes("architecture")) {
        const system = `You write **software architecture** docs in Markdown using ONLY the provided context.
- Be accurate and evidence-based; never invent components.
- Add inline citations like [chunk-id] beside each claim.
- Prefer Mermaid diagrams (system context, component, sequence, deployment) when supported by evidence.
- Mark uncertain/unknown details explicitly as **Unknown** with the closest citation.
- This is a ${langContext}.`;
        const prompt = `# ${title}

> Topics: ${q}
${hint ? `> Hint: ${hint}` : ""}
> **Language/Framework**: ${language.toUpperCase()} - ${langContext}

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
        return await generator.generate(prompt, { system, maxTokens: 8000, temperature: 0.12 })
            || `# ${title}\n_Context unavailable._`;
    }
    // ---------- Services ----------
    if (lower.includes("services")) {
        const system = `You write **service-level** documentation in Markdown using ONLY the provided context.
- This is a ${langContext}.
- Be precise about responsibilities, inputs/outputs, dependencies, side effects.
- CRITICAL: For each service, identify which CONTROLLERS call it and which OTHER SERVICES/EXTERNAL APIs it depends on.
- Add inline citations like [chunk-id] beside each claim.
- Include sequence diagrams when helpful and supported by evidence.`;
        const prompt = `# ${title}

> Topics: ${q}
${hint ? `> Hint: ${hint}` : ""}
> **Language/Framework**: ${language.toUpperCase()} - ${langContext}

## Context
${context || "_No context snippets loaded._"}

## Output Requirements

### Service Catalogue
- For each service/module discovered in the snippets:
  - **Name/Location** (file path). [chunk-id]
  - **Responsibilities**. [chunk-id]
  - **Called By:** List controllers that use this service (e.g., githubController.ingestRepo()) [chunk-id]
  - **Public API** (functions, signatures, expected params/returns). [chunk-id]
  - **Dependencies** (other services, DB, S3, external APIs). [chunk-id]
    - Other services called: [chunk-id]
    - Database operations: [chunk-id]
    - External APIs: [chunk-id]
  - **Side Effects** (writes, network calls, messages). [chunk-id]
  - **Error Handling** (error types, retries, backoff). [chunk-id]
  - **Configuration** (env vars used). [chunk-id]

### Interactions (Mermaid sequence, if supported)
- Typical call flow: controllers → this service → dependencies (other services/DB/APIs). [chunk-id]

### Call Chain Context
- **Upstream**: Which controllers call this service? [chunk-id]
- **Downstream**: Which services/databases/APIs does this service call? [chunk-id]

### Gotchas & Constraints
- Performance notes, rate limits, idempotency, concurrency concerns. [chunk-id]

## Instructions
- Cite snippets inline like [3339a3abe4b6-0001].
- If something cannot be confirmed from context, mark it **Unknown**.
- TRACE THE CALL CHAIN: controllers → THIS SERVICE → dependencies.`;
        return await generator.generate(prompt, { system, maxTokens: 8000, temperature: 0.12 })
            || `# ${title}\n_Context unavailable._`;
    }
    // ---------- Routes & Endpoints ----------
    if (lower.includes("routes") || lower.includes("endpoints")) {
        const system = `You produce precise **API route documentation** in Markdown using ONLY the provided context.
- Extract endpoints from ${langContext} routers/controllers.
- CRITICAL: For each route, TRACE THE CALL CHAIN from route definition → controller handler → implementation details.
  * When you see a route like "router.post('/path', controllerName.methodName)", you MUST:
    1. Find the route definition [chunk-id]
    2. Look for the controller method implementation in the context [chunk-id]
    3. Extract parameter validation, request body schema, and response types from the controller code [chunk-id]
- For each endpoint, document: method, full path, auth requirements, params (path/query/body) with type & required/optional (extracted from controller validation), request example, response schemas and examples for 200 plus common errors, and status codes.
- Add inline citations like [chunk-id] for each extracted fact.
- If a detail is not in context, mark it **Unknown**.`;
        const prompt = `# ${title}

> Topics: ${q}
${hint ? `> Hint: ${hint}` : ""}
> **Language/Framework**: ${language.toUpperCase()} - ${langContext}

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

## Call Chain Tracing
For each route, follow this process:
1. **Identify the route definition** (e.g., router.post('/api/ingest/:owner/:repo', githubController.ingestRepo)) [chunk-id]
2. **Find the controller handler** in the snippets (search for githubController.ingestRepo or similar) [chunk-id]
3. **Extract from controller implementation**:
   - Parameter extraction (e.g., const { owner, repo } = req.params) [chunk-id]
   - Body validation (e.g., const { branch, message } = req.body) [chunk-id]
   - Query params (e.g., const { force } = req.query) [chunk-id]
   - Response structure (e.g., res.json({ success: true, commitId: ... })) [chunk-id]
   - Error responses (e.g., res.status(400).json({ error: ... })) [chunk-id]
4. **Document services called** by the controller (e.g., await githubService.clone(...)) [chunk-id]

## Notes
- If router composition or middleware affects routes (prefixes, versioning), document that. [chunk-id]
- Mark anything not directly evidenced as **Unknown**.
- **IMPORTANT**: Always cite BOTH the route definition AND the controller implementation.

## Instructions
- Do not invent fields or paths. Cite every concrete claim.
- Follow the call chain: route → controller → services.
- Extract actual parameter schemas from controller code, not just route patterns.`;
        return await generator.generate(prompt, { system, maxTokens: 8000, temperature: 0.12 })
            || `# ${title}\n_Context unavailable._`;
    }
    // ---------- Controllers ----------
    if (lower.includes("controller")) {
        const system = `You write **controller-level** documentation in Markdown using ONLY the provided context.
- This is a ${langContext}.
- Explain responsibilities, validation, side effects, downstream calls, and error mapping.
- CRITICAL: For each controller, identify which ROUTES call it and which SERVICES it calls.
- Document response shapes: success (200) and error variants with examples.
- Add inline citations like [chunk-id] for each claim.`;
        const prompt = `# ${title}

> Topics: ${q}
${hint ? `> Hint: ${hint}` : ""}
> **Language/Framework**: ${language.toUpperCase()} - ${langContext}

## Context
${context || "_No context snippets loaded._"}

## Controllers
For each controller/handler found:

### Handler: name (file path)
- **Purpose & Triggers:** when/how it's invoked. [chunk-id]
- **Called By Routes:** List specific routes that call this controller (e.g., POST /api/ingest/:owner/:repo) [chunk-id]
- **Inputs/Validation:** expected params, schema checks, defaults. [chunk-id]
  - Path params: [chunk-id]
  - Query params: [chunk-id]
  - Body schema: [chunk-id]
- **Control Flow:** main steps; calls to services/DB/external APIs. [chunk-id]
- **Services Called:** List specific service methods called (e.g., githubService.cloneRepo()) [chunk-id]
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

## Call Chain Context
- **Upstream**: Which routes call this controller? [chunk-id]
- **Downstream**: Which services does this controller call? [chunk-id]

## Instructions
- Cite every concrete fact with [chunk-id].
- Mark gaps as **Unknown** where the snippets don't prove it.
- TRACE THE CALL CHAIN: routes → THIS CONTROLLER → services.`;
        return await generator.generate(prompt, { system, maxTokens: 8000, temperature: 0.12 })
            || `# ${title}\n_Context unavailable._`;
    }
    // ---------- Generic (fallback) ----------
    const system = `You write **software documentation** in Markdown for arbitrary repositories.
- Use ONLY the provided context.
- Be accurate and concise.
- Add inline citations like [chunk-id] next to claims derived from a snippet.
- Prefer bullet lists, tables, and Mermaid diagrams where helpful.`;
    const prompt = `# ${title}

> Topics: ${q}
${hint ? `> Hint: ${hint}` : ""}

## Context
${context || "_No context snippets loaded._"}

## Instructions
- Produce a clear Markdown page for this topic.
- Include Overview, How it Works, Key Components, and Gotchas.
- Cite snippets inline like [3339a3abe4b6-0001].
- If context is insufficient, explicitly state gaps and suggest where to look.`;
    return await generator.generate(prompt, { system, maxTokens: 8000, temperature: 0.15 })
        || `# ${title}\n_Context unavailable._`;
}
