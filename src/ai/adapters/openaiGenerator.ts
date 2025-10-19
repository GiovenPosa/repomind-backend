import OpenAI from "openai";
import type { Generator } from "../interfaces";

export class OpenAIGenerator implements Generator {
  private client: OpenAI;
  private model: string;

  constructor(opts?: { apiKey?: string; model?: string }) {
    this.client = new OpenAI({ apiKey: opts?.apiKey ?? process.env.OPENAI_API_KEY! });
    this.model = opts?.model ?? process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
  }

  async generate(prompt: string, opts?: { system?: string; maxTokens?: number; temperature?: number }) {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: opts?.system ?? "You are a helpful codebase assistant. Only use the provided context." },
        { role: "user", content: prompt }
      ],
      max_tokens: opts?.maxTokens ?? 500,
      temperature: opts?.temperature ?? 0.2,
    });
    return res.choices[0]?.message?.content ?? "";
  }
}