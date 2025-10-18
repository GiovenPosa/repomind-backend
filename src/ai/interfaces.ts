// Minimal, provider-agnostic contracts you can implement anywhere.

export interface Embedder {
  /** A short id used in S3 paths, e.g. "openai" or "ollama" */
  name: string;

  /** Embedding vector dimensionality */
  dim: number;

  /**
   * Embed an array of texts. Return one vector per text.
   * IMPORTANT: Implementations MUST preserve order.
   */
  embed(texts: string[]): Promise<number[][]>;
}

export interface Generator {
  generate(
    prompt: string,
    opts?: { system?: string; maxTokens?: number; temperature?: number }
  ): Promise<string>;
}