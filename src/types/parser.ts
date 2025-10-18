export type ChunkRecord = {
  id: string;             // stable id: short(file)+ord
  filePath: string;
  fileSha: string;
  lang: string;
  startLine: number;
  endLine: number;
  byteStart: number;
  byteEnd: number;
  tokenCount: number;     // approx
  hash: string;           // sha256:text
};

export type ChunkIndex = {
  commit: string;
  chunkModel: string;
  generatedAt: string;
  chunks: ChunkRecord[];
};