export type DocSectionSpec = {
  id: string;
  title: string;
  outFile: string;       // local file to write
  topK?: number;
  queries: string[];     // we can run multiple generic queries per section
  category?: DocCategory; // used to boost / filter hits
  hint?: string;
};

export type DocCategory =
  | "architecture"
  | "controllers"
  | "routes"
  | "services"
  | "utils"
  | "types"
  | "database"
  | "external-apis";

export const DEFAULT_SECTIONS: DocSectionSpec[] = [
  {
    id: "architecture",
    title: "System Architecture",
    outFile: "architecture.md",
    topK: 24,
    category: "architecture",
    queries: [
      "overall system architecture and data flow",
      "how ingestion, parsing, embeddings, storage work together",
      "queues, background tasks, webhook triggers, s3 layout",
    ],
    hint: "Include Mermaid diagram(s) for data flow and storage layout."
  },
  {
    id: "controllers",
    title: "Controllers",
    outFile: "controllers.md",
    topK: 20,
    category: "controllers",
    queries: [
      "http controllers responsibilities and request handling",
      "webhook verification flow and follow-up processing",
    ],
  },
  {
    id: "routes",
    title: "Routes & Endpoints",
    outFile: "routes.md",
    topK: 20,
    category: "routes",
    queries: [
      "express routes and endpoints exposed",
      "request/response contracts for endpoints",
    ],
  },
  {
    id: "services",
    title: "Services",
    outFile: "services.md",
    topK: 24,
    category: "services",
    queries: [
      "ingestion, parsing, and embedding services contracts and flow",
      "indexer and search services and their roles",
    ],
  },
  {
    id: "utils",
    title: "Utilities",
    outFile: "utils.md",
    topK: 16,
    category: "utils",
    queries: [
      "utility helpers (s3 utils, parser utils), key functions and contracts",
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
      "usage of external apis like openai, github, aws s3 including rate limits and auth",
    ],
  }
];

export function inferCategory(filePath: string): DocCategory | "unknown" {
  const p = filePath.toLowerCase();

  // controllers
  if (/(^|\/)(controllers?|controller)\//.test(p) || /controller\.(t|j)sx?$/.test(p)) return "controllers";

  // routes
  if (/(^|\/)(routes?|router|api)\/|\/server\.(t|j)s$/.test(p) || /routes?\.(t|j)s$/.test(p)) return "routes";

  // services
  if (/(^|\/)services?\//.test(p) || /service\.(t|j)s$/.test(p)) return "services";

  // utils
  if (/(^|\/)(utils?|helpers?)\//.test(p) || /(util|helper)\.(t|j)s$/.test(p)) return "utils";

  // types
  if (/(^|\/)types?\//.test(p) || /\.d\.(t|j)s$/.test(p) || /types?\.(t|j)s$/.test(p)) return "types";

  // database (migrations, schema files)
  if (/(^|\/)(db|database|migrations?|schema)\//.test(p) || /(schema|migration)\.(t|j)s$/.test(p)) return "database";

  // external apis (very heuristic)
  if (/openai|octokit|github|aws|s3/.test(p)) return "external-apis";

  // architecture: broad — we consider everything, but prefer root/readme/config
  if (/readme\.md$|^docs\/|architecture|design|adr/.test(p)) return "architecture";

  return "unknown";
}