"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferCategory = exports.DEFAULT_SECTIONS = void 0;
exports.DEFAULT_SECTIONS = [
    {
        id: "architecture",
        title: "System Architecture",
        outFile: "architecture.md",
        topK: 32,
        category: "architecture",
        queries: [
            "overall system architecture and interactions between modules",
            "data flow across controllers, services, persistence, external APIs",
            "background jobs, queues, schedulers, and webhook/event triggers",
            "configuration and environment variables used across the system",
            "error handling, retries, idempotency, and rate limiting patterns",
            "security boundaries: auth, secrets, HMAC/webhook verification",
            "observability: logging, metrics, tracing, health checks",
            "deployment/runtime topology (containers, processes, workers)",
            "RAG-style retrieval flow if present (ingest → parse → embed → store → query → generate)"
        ],
        hint: "Include relevant Mermaid diagram(s): system context, component, sequence, and (if applicable) deployment. " +
            "Infer only from snippets; don’t invent components. Prefer citing concrete files/functions."
    },
    {
        id: "controllers",
        title: "Controllers",
        outFile: "controllers.md",
        topK: 28,
        category: "controllers",
        queries: [
            "express controller handler functions and their responsibilities",
            "request validation logic for controllers",
            "controller response types and shapes",
            "examples of successful responses (status 200) and error cases",
            "error handling patterns used in controllers (try/catch, centralized handlers)"
        ],
        hint: "For each controller handler: list input shape, validation rules, auth requirements, response schema, a 200 example, and all non-2xx errors with reasons."
    },
    {
        id: "routes",
        title: "Routes & Endpoints",
        outFile: "routes.md",
        topK: 28,
        category: "routes",
        queries: [
            "all express routes and methods with full paths",
            "path params and query params used by each route",
            "request body schema and content-type for each route",
            "authentication and middleware requirements for endpoints",
            "response status codes and payload shapes for endpoints",
            "examples of 200 responses and common error responses with codes"
        ],
        hint: "Document EVERY endpoint with method, full path, auth/middleware, params (path/query/body), content-type, response schema, 200 example, and error catalogue (status, message, when)."
    },
    {
        id: "services",
        title: "Services",
        outFile: "services.md",
        topK: 28,
        category: "services",
        queries: [
            "service modules and business logic in the codebase",
            "files in services folder or files named *service.ts or *Service.ts",
            "classes or functions that implement business workflows or integrations",
            "how services interact with controllers, utils, database, or external APIs",
            "service boundaries, inputs/outputs, and side effects",
            "retry, idempotency, and error handling in services",
            "configuration and environment variables used by services"
        ],
        hint: "Do not assume service names. Infer from files (e.g., services/*, *service.ts, *Service.ts), exported classes/functions, and controller/service call sites."
    },
    {
        id: "utils",
        title: "Utilities",
        outFile: "utils.md",
        topK: 16,
        category: "utils",
        queries: [
            "utility helpers, key functions and contracts",
        ],
    },
    {
        id: "types",
        title: "Types & Interfaces",
        outFile: "types.md",
        topK: 16,
        category: "types",
        queries: [
            "shared type definitions and interfaces used across modules",
        ],
    },
    {
        id: "database",
        title: "Database Schema",
        outFile: "database.md",
        topK: 16,
        category: "database",
        queries: [
            "postgres schema, tables and indexes used by the app",
            "vector search usage and indexes",
        ],
    },
    {
        id: "external-apis",
        title: "External APIs",
        outFile: "external-apis.md",
        topK: 16,
        category: "external-apis",
        queries: [
            "usage of external apis including rate limits and auth",
        ],
    }
];
function inferCategory(filePath) {
    const p = filePath.toLowerCase();
    // controllers
    if (/(^|\/)(controllers?|controller)\//.test(p) || /controller\.(t|j)sx?$/.test(p))
        return "controllers";
    // routes
    if (/(^|\/)(routes?|router|api)\/|\/server\.(t|j)s$/.test(p) || /routes?\.(t|j)s$/.test(p))
        return "routes";
    // services
    if (/(^|\/)services?\//.test(p) || /service\.(t|j)s$/.test(p))
        return "services";
    // utils
    if (/(^|\/)(utils?|helpers?)\//.test(p) || /(util|helper)\.(t|j)s$/.test(p))
        return "utils";
    // types
    if (/(^|\/)types?\//.test(p) || /\.d\.(t|j)s$/.test(p) || /types?\.(t|j)s$/.test(p))
        return "types";
    // database (migrations, schema files)
    if (/(^|\/)(db|database|migrations?|schema)\//.test(p) || /(schema|migration)\.(t|j)s$/.test(p))
        return "database";
    // external apis (very heuristic)
    if (/openai|octokit|github|aws|s3/.test(p))
        return "external-apis";
    // architecture: broad — we consider everything, but prefer root/readme/config
    if (/readme\.md$|^docs\/|architecture|design|adr/.test(p))
        return "architecture";
    return "unknown";
}
exports.inferCategory = inferCategory;
