export interface S3IngestLayout {
  bucket: string;
  tenantId?: string; // "default" if omitted
  owner: string;
  repo: string;
  commit: string;
}

export interface ManifestFileEntry {
  path: string;
  sha: string; // git blob SHA (or your sha256 if you prefer)
  size: number;
  lang?: string;
  mime?: string;
  binary: boolean;
  storedAt?: string; // "blobs/ab/12/ab12..."
  startLine?: number;
  endLine?: number;
  skippedReason?: 'excluded_path' | 'max_size' | 'binary' | string;
}

export interface ManifestJson {
  owner: string;
  repo: string;
  commit: string;
  ingestedAt: string;
  config: {
    include: string[];
    exclude: string[];
    maxFileKB: number;
  };
  stats: {
    filesTotal: number;
    filesKept: number;
    filesSkipped: number;
    bytesKept: number;
  };
  files: ManifestFileEntry[];
}