# Types & Interfaces Documentation

## Overview
This document outlines the shared type definitions and interfaces used across various modules in the codebase. These types and interfaces facilitate consistent data structures and interactions between different components of the application.

## How it Works
The types and interfaces are defined in TypeScript, providing strong typing to enhance code quality and maintainability. They are utilized across different modules to ensure that data structures conform to expected formats, reducing runtime errors and improving developer experience.

## Key Components

### 1. Document Section Specifications
- **`DocSectionSpec`**: Defines the structure for documentation sections.
  - **Properties**:
    - `id`: Unique identifier for the section.
    - `title`: Title of the section.
    - `outFile`: Local file path for output.
    - `topK`: Optional; number of top results to return.
    - `queries`: Array of queries to run for the section.
    - `category`: Optional; categorizes the section for filtering.
    - `hint`: Optional; additional instructions for the section.

- **`DocCategory`**: Enumerates possible categories for documentation sections.
  - Values include: `architecture`, `controllers`, `routes`, `services`, `utils`, `types`, `database`, `external-apis`.

### 2. Chunk Records
- **`ChunkRecord`**: Represents a record of a code chunk.
  - **Properties**:
    - `id`: Stable identifier.
    - `filePath`: Path to the file.
    - `fileSha`: SHA of the file.
    - `lang`: Programming language.
    - `startLine` / `endLine`: Line numbers of the chunk.
    - `byteStart` / `byteEnd`: Byte offsets.
    - `tokenCount`: Approximate number of tokens.
    - `hash`: SHA256 hash of the chunk.

- **`ChunkIndex`**: Contains metadata about a collection of chunks.
  - **Properties**:
    - `commit`: Commit identifier.
    - `chunkModel`: Model used for chunking.
    - `generatedAt`: Timestamp of generation.
    - `chunks`: Array of `ChunkRecord`.

### 3. Custom Request and Middleware
- **`CustomRequest`**: Extends the Express `Request` object to include a user property.
- **`ErrorResponse`**: Standard structure for error responses.
  - **Properties**:
    - `status`: HTTP status code.
    - `message`: Error message.

- **`MiddlewareFunction`**: Type definition for middleware functions in Express.

### 4. S3 Ingest Layout and Manifest
- **`S3IngestLayout`**: Defines the layout for S3 ingestion.
  - **Properties**:
    - `bucket`: S3 bucket name.
    - `tenantId`: Optional tenant identifier.
    - `owner`: Owner of the repository.
    - `repo`: Repository name.
    - `commit`: Commit identifier.

- **`ManifestFileEntry`**: Represents an entry in a manifest file.
- **`ManifestJson`**: Structure for the manifest JSON file.

### 5. GitHub Interfaces
- **`GithubRepositoryRef`**: Represents a GitHub repository reference.
- **`GithubPushCommit`**: Represents a commit in a push event.
- **`GithubPushPayload`**: Structure for GitHub push event payloads.
- **`GithubRepositoryEvent`**: Represents events related to GitHub repositories.

### 6. AI Interfaces
- **`Embedder`**: Interface for embedding text.
- **`Generator`**: Interface for generating text based on prompts.

## Gotchas
- Ensure that all modules importing these types and interfaces are updated when changes are made to maintain compatibility.
- Be cautious with optional properties; always check for their existence before usage to avoid runtime errors.

## Conclusion
This documentation provides a comprehensive overview of the types and interfaces used throughout the application. For further details, refer to the respective source files where these types are defined.