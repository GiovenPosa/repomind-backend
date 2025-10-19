// src/controllers/qaController.ts
import { Request, Response } from "express";
import { OpenAIEmbedder } from "../ai/adapters/openaiEmbedder";
import { OpenAIGenerator } from "../ai/adapters/openaiGenerator";
import { semanticSearch } from "../services/searchService";
import { loadChunkTexts } from "../services/chunkTextLoader";
import { synthesizeAnswer } from "../services/answerService";
import { resolveLatestCommit } from "../services/commitResolver";

import { S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-west-2" });

export async function askRepo(req: Request, res: Response) {
  try {
    const { owner, repo } = req.params;
    const { q, branch, commit } = req.body as { q: string; branch?: string; commit?: string };

    if (!q) return res.status(400).json({ error: "Missing q" });
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: "OPENAI_API_KEY not set (needed to embed query / generate answer)" });
    }

    // 0) Resolve which commit we’re answering against (so we can fetch chunk texts)
    const commitSha = commit ?? await resolveLatestCommit({
      s3,
      bucket: process.env.S3_BUCKET_NAME!,
      tenantId: "default",
      owner,
      repo,
      branch, // optional
    });

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

    if (!hits.length) {
      return res.json({ answer: "I couldn’t find anything relevant in this repo.", citations: [], hits: [] });
    }

    // 3) Load chunk texts from S3 (per-file JSONL) for the selected commit
    const chunkIds = hits.map(h => h.id);
    const map = await loadChunkTexts({
      s3,
      bucket: process.env.S3_BUCKET_NAME!,
      tenantId: "default",
      owner,
      repo,
      commit: commitSha,
      chunkIds,
    });

    const snippets = hits
      .map(h =>
        map[h.id]
          ? {
              id: h.id,
              filePath: map[h.id].filePath,
              startLine: map[h.id].startLine,
              endLine: map[h.id].endLine,
              text: map[h.id].text,
            }
          : null
      )
      .filter(Boolean) as {
        id: string;
        filePath: string;
        startLine: number;
        endLine: number;
        text: string;
      }[];

    if (!snippets.length) {
      return res.json({
        answer: "I found candidate locations, but couldn’t load their text context.",
        citations: [],
        hits,
      });
    }

    // 4) Synthesize an answer with citations
    const generator = new OpenAIGenerator({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
    });

    const { answer, citations } = await synthesizeAnswer({
      q,
      snippets,
      generator,
    });

    return res.json({ answer, citations, hits, commit: commitSha });
  } catch (e: any) {
    console.error("askRepo error", e);
    return res.status(500).json({ error: e.message || "Internal error" });
  }
}