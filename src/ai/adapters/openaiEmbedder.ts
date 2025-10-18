import OpenAI from "openai";
import { Embedder } from "../interfaces";

export class OpenAIEmbedder implements Embedder {
  name = "openai";
  // Good default: cheaper 1536-dim model
  dim = 1536;

  private client: OpenAI;
  private model: string;

  constructor(opts?: { apiKey?: string; model?: string }) {
    this.client = new OpenAI({ apiKey: opts?.apiKey ?? process.env.OPENAI_API_KEY! });
    this.model = opts?.model ?? process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    const res = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return res.data.map(d => d.embedding);
  }
}