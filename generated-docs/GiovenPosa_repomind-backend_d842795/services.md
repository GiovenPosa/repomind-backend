# Services Documentation

## Overview
This document provides an overview of the services involved in the ingestion, parsing, embedding, indexing, and searching of code and markdown files within a repository. It outlines the flow of data through these services and their respective roles in processing commits.

## How it Works
The services operate in a sequence that involves:

1. **Ingestion**: The `ingestRepository` function retrieves files from a repository based on specified criteria (e.g., include/exclude patterns) and prepares a manifest of the files to be processed [7c8a84372a2b-0000].

2. **Parsing**: The `parseCommit` function processes the files listed in the manifest, normalizing their content and splitting them into manageable chunks. This includes identifying the language of the files and generating metadata for each chunk [149ebc4a9df3-0001].

3. **Embedding**: The `embedCommit` function computes embeddings for the parsed chunks using an embedding service. This involves loading the chunk text, generating vectors, and storing them in a specified format [45ddf38d4fde-0000].

4. **Indexing**: The `upsertChunks` function saves the chunk metadata into a database, ensuring that each chunk is indexed for efficient retrieval [34bf20c27f27-0000].

5. **Searching**: The `semanticSearch` function allows users to query the indexed chunks using vector representations, returning relevant results based on the similarity of embeddings [beb3b4d0235f-0000].

## Key Components

| Component        | Description                                                                 |
|------------------|-----------------------------------------------------------------------------|
| **Ingest Service** | Handles the retrieval of repository files and prepares a manifest.        |
| **Parser Service** | Normalizes and chunks the content of files, generating metadata.          |
| **Embedder**      | Computes embeddings for text chunks, providing a vector representation.    |
| **Indexer Service**| Saves chunk metadata and embeddings into a database for retrieval.        |
| **Search Service** | Facilitates semantic search over the indexed chunks using embeddings.      |

### Embedder Interface
The `Embedder` interface defines the structure for embedding services, including the name and dimensionality of the embeddings [258eb093eb37-0000].

### Chunk Metadata
Each chunk is represented by a `ChunkRecord`, which includes:
- `id`: Unique identifier for the chunk.
- `filePath`: Path to the file from which the chunk was derived.
- `startLine` and `endLine`: Line numbers indicating the chunk's location in the file.
- `lang`: Language of the chunk [34bf20c27f27-0000].

## Gotchas
- **Error Handling**: Ensure that error handling is implemented in each service to manage failures gracefully, especially during S3 operations and database interactions [dedaf00e393f-0000].
- **Batch Processing**: When embedding chunks, consider the batch size and part size to optimize performance and avoid exceeding limits [45ddf38d4fde-0000].
- **Data Consistency**: Ensure that the chunk metadata and embeddings are consistently updated in the database to avoid discrepancies during searches [34bf20c27f27-0000].

## Conclusion
This documentation outlines the essential services involved in processing code and markdown files within a repository. For further details on specific implementations, refer to the respective service files in the codebase.