import { Request, Response } from "express";
import { DEFAULT_SECTIONS } from "../types/docs";
import { generateDocsLocal } from "../services/documentationService";

export async function generateRepoDocsLocal(req: Request, res: Response) {
  try {
    const { owner, repo, commit } = req.params as { owner: string; repo: string; commit: string };
    if (!process.env.OPENAI_API_KEY) return res.status(400).json({ error: "OPENAI_API_KEY missing" });

    const out = await generateDocsLocal({
      owner, repo, commit,
      tenantId: "default",
      bucket: process.env.S3_BUCKET_NAME, // if set, we’ll load snippet text; else we still produce docs with fewer details
      sections: DEFAULT_SECTIONS
    });

    res.json({ ok: true, ...out });
  } catch (e: any) {
    console.error("generateRepoDocsLocal error", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
}