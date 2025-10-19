# Types & Interfaces Documentation

## Overview
This document outlines the shared type definitions and interfaces used across various modules in the codebase. These types and interfaces facilitate consistent data structures and interactions within the application.

## How it Works
The types and interfaces are defined in TypeScript and are used to enforce type safety and clarity in the code. They are particularly useful for defining the shape of data being passed around in the application, ensuring that components interact correctly.

## Key Components

### 1. Document Section Specifications
- **`DocSectionSpec`**: Defines the structure for documentation sections.
  - **Properties**:
    - `id`: Unique identifier for the section.
    - `title`: Title of the section.
    - `outFile`: Output file name for the section.
    - `topK`: Optional parameter for limiting results.
    - `queries`: Array of queries related to the section.
    - `category`: Optional category for filtering.
    - `hint`: Optional hint for additional context.

- **`DocCategory`**: Enum-like type for categorizing documentation sections.
  - Possible values include: `architecture`, `controllers`, `routes`, `services`, `utils`, `types`, `database`, `external-apis`.

- **`DEFAULT_SECTIONS`**: An array of predefined documentation sections, each adhering to the `DocSectionSpec` structure.

### 2. Chunk Records
- **`ChunkRecord`**: Represents a record of a code chunk.
  - **Properties**:
    - `id`: Stable identifier.
    - `filePath`: Path to the file.
    - `fileSha`: SHA of the file.
    - `lang`: Programming language.
    - `startLine` and `endLine`: Line numbers for the chunk.
    - `byteStart` and `byteEnd`: Byte offsets.
    - `tokenCount`: Approximate token count.
    - `hash`: SHA256 hash of the text.

- **`ChunkIndex`**: Represents an index of chunks.
  - **Properties**:
    - `commit`: Commit identifier.
    - `chunkModel`: Model used for chunking.
    - `generatedAt`: Timestamp of generation.
    - `chunks`: Array of `ChunkRecord`.

### 3. Custom Request and Middleware
- **`CustomRequest`**: Extends the Express `Request` to include an optional `user` property.
- **`ErrorResponse`**: Structure for error responses.
  - **Properties**:
    - `status`: HTTP status code.
    - `message`: Error message.

- **`MiddlewareFunction`**: Type for middleware functions in Express.

### 4. S3 Ingest Layout and Manifest
- **`S3IngestLayout`**: Defines the layout for S3 ingestion.
  - **Properties**:
    - `bucket`: S3 bucket name.
    - `tenantId`: Optional tenant identifier.
    - `owner`: Owner of the repository.
    - `repo`: Repository name.
    - `commit`: Commit identifier.

- **`ManifestFileEntry`**: Represents an entry in a manifest file.
  - **Properties**:
    - `path`, `sha`, `size`, `lang`, `mime`, `binary`, `storedAt`, `startLine`, `endLine`, `skippedReason`.

- **`ManifestJson`**: Structure for the manifest JSON file.

### 5. GitHub Interfaces
- **`GithubRepositoryRef`**: Represents a GitHub repository reference.
- **`GithubPushCommit`**: Represents a commit in a GitHub push event.
- **`GithubPushPayload`**: Structure for GitHub push event payloads.
- **`GithubRepositoryEvent`**: Represents events related to GitHub repositories.

### 6. AI Interfaces
- **`Embedder`**: Interface for embedding text.
  - **Methods**:
    - `embed(texts: string[]): Promise<number[][]>`: Embeds an array of texts.

- **`Generator`**: Interface for generating text based on prompts.
  - **Methods**:
    - `generate(prompt: string, opts?: { system?: string; maxTokens?: number; temperature?: number }): Promise<string>`.

## Gotchas
- Ensure that all types and interfaces are consistently used across modules to avoid type mismatches.
- Pay attention to optional properties, as they may lead to undefined values if not handled properly.
- Review the documentation for each type to understand the expected data structures and usage patterns.

For further details, refer to the source files in the `src/types` directory.