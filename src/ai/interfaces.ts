export interface Embedder {
  /** A short id used in S3 paths, e.g. "openai" or "ollama" */
  name: string;

  /** Embedding vector dimensionality */
  dim: number;

  embed(texts: string[]): Promise<number[][]>;
}

export interface Generator {
  generate(
    prompt: string,
    opts?: { system?: string; maxTokens?: number; temperature?: number }
  ): Promise<string>;
}