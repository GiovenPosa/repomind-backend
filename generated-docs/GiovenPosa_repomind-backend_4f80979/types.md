# Types & Interfaces Documentation

## Overview
This document outlines the shared type definitions and interfaces used across various modules in the codebase. These types and interfaces facilitate consistent data structures and interactions within the application.

## How it Works
The types and interfaces are defined in TypeScript and are utilized throughout the application to ensure type safety and clarity. They cover various aspects of the application, including document specifications, chunk records, request handling, S3 ingestion layouts, GitHub interactions, and AI functionalities.

## Key Components

### Document Specifications
- **DocSectionSpec**: Defines the structure for document sections, including properties like `id`, `title`, `outFile`, `topK`, `queries`, and optional `category` and `hint` fields.
- **DocCategory**: Enumerates possible categories for document sections, such as "architecture", "controllers", and "routes".

```typescript
export type DocSectionSpec = {
  id: string;
  title: string;
  outFile: string;
  topK?: number;
  queries: string[];
  category?: DocCategory;
  hint?: string;
};
```

### Chunk Records
- **ChunkRecord**: Represents a record of a code chunk with properties like `id`, `filePath`, `fileSha`, and `tokenCount`.
- **ChunkIndex**: Contains metadata about a collection of chunk records.

```typescript
export type ChunkRecord = {
  id: string;
  filePath: string;
  fileSha: string;
  lang: string;
  startLine: number;
  endLine: number;
  byteStart: number;
  byteEnd: number;
  tokenCount: number;
  hash: string;
};
```

### Request Handling
- **CustomRequest**: Extends the Express `Request` interface to include optional user information.
- **ErrorResponse**: Defines the structure for error responses.
- **MiddlewareFunction**: Represents a middleware function signature.

```typescript
export interface CustomRequest extends Request {
    user?: any;
}

export interface ErrorResponse {
    status: number;
    message: string;
}
```

### S3 Ingestion Layout
- **S3IngestLayout**: Defines the structure for S3 ingestion, including properties like `bucket`, `tenantId`, and `repo`.
- **ManifestFileEntry**: Represents individual entries in a manifest file.
- **ManifestJson**: Represents the overall structure of a manifest JSON file.

```typescript
export interface S3IngestLayout {
  bucket: string;
  tenantId?: string;
  owner: string;
  repo: string;
  commit: string;
}
```

### GitHub Interactions
- **GithubRepositoryRef**: Represents a GitHub repository reference.
- **GithubPushCommit**: Contains details about a commit in a push event.
- **GithubPushPayload**: Represents the payload for GitHub push events.

```typescript
export interface GithubRepositoryRef {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description?: string | null;
  default_branch: string;
  owner: {
    login: string;
    id: number;
  };
}
```

### AI Functionalities
- **Embedder**: Interface for embedding text into vectors.
- **Generator**: Interface for generating text based on prompts.

```typescript
export interface Embedder {
  name: string;
  dim: number;
  embed(texts: string[]): Promise<number[][]>;
}
```

## Gotchas
- Ensure that the types and interfaces are consistently used across modules to avoid type mismatches.
- Be cautious when extending interfaces, especially with optional properties, as it may lead to unexpected behavior if not handled properly.
- Review the documentation for each interface to understand its intended use and constraints.

## Conclusion
This documentation provides a comprehensive overview of the types and interfaces used across the application. For further details, refer to the specific files where these types are defined. If additional context is needed, consider exploring the implementation of each module that utilizes these types.