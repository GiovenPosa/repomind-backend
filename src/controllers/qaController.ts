import { Request, Response } from "express";
import { OpenAIEmbedder } from "../ai/adapters/openaiEmbedder";
import { semanticSearch } from "../services/searchService";
import { getText, s3Prefix } from "../utils/s3Util";

import { S3Client } from "@aws-sdk/client-s3";
const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-west-2" });

export async function askRepo(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const { q } = req.body as { q: string };

    if (!q) return res.status(400).json({ error: "Missing q" });
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: "OPENAI_API_KEY not set (needed to embed query)" });
    }

    // 1) Embed the query
    const embedder = new OpenAIEmbedder({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
    });
    const [vec] = await embedder.embed([q]);

    // 2) Retrieve nearest chunks
    const hits = await semanticSearch({
      owner, repo, queryVector: vec, provider: embedder.name, topK: 8
    });

    // 3) (Optional) load chunk texts from S3 to show context in UI
    //    Text lives in: commits/{sha}/parse/chunks/<fileId>.jsonl
    //    Since we stored only IDs in DB, you can return hits first or fetch text on-demand.

    return res.json({ hits });
  } catch (e: any) {
    console.error("askRepo error", e);
    return res.status(500).json({ error: e.message || "Internal error" });
  }
}