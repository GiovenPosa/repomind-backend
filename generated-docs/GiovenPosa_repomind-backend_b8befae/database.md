# Database Schema Documentation

## Overview
This documentation provides an overview of the database schema used in the application, focusing on the PostgreSQL schema, tables, indexes, and the implementation of vector search functionality.

## How it Works
The application utilizes a PostgreSQL database to manage data efficiently. It connects to the database using a connection pool, which allows for multiple concurrent connections without the overhead of establishing a new connection for each request. The connection settings are defined in the `src/db.ts` file, where the connection string and SSL settings are configured.

### Connection Pooling
- **Library Used**: `pg` (PostgreSQL client for Node.js)
- **Connection String**: Retrieved from environment variables (`SUPABASE_URL`)
- **SSL Configuration**: Controlled by the `DB_SSL` environment variable

## Key Components

### Database Connection
- **Pool**: An instance of `Pool` from the `pg` library is created to manage database connections.
- **SQLClient Interface**: Defines a method for executing SQL queries:
  ```typescript
  export type SQLClient = {
    query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
  };
  ```

### Vector Search
The application supports vector search functionality, which is essential for tasks such as embedding text and generating responses based on those embeddings.

#### Interfaces
- **Embedder Interface**: Responsible for generating embedding vectors from text.
  - **Properties**:
    - `name`: Identifier for the embedding method (e.g., "openai").
    - `dim`: Dimensionality of the embedding vectors.
  - **Method**: `embed(texts: string[]): Promise<number[][]>;` - Takes an array of texts and returns their corresponding embedding vectors.

- **Generator Interface**: Used for generating text based on a prompt.
  - **Method**: `generate(prompt: string, opts?: { system?: string; maxTokens?: number; temperature?: number }): Promise<string>;` - Generates text based on the provided prompt and optional parameters.

### Indexes
While specific indexes are not detailed in the provided context, it is important to consider indexing strategies for optimizing query performance, especially for vector search operations.

## Gotchas
- **SSL Configuration**: Ensure that the `DB_SSL` environment variable is set correctly to avoid connection issues, especially in production environments.
- **Error Handling**: The `withClient` function handles client connection management but does not specify error handling for SQL queries. Implement appropriate error handling in the application logic.

## Gaps
- The documentation lacks specific details on the tables and indexes used in the database schema. For a complete understanding, refer to the database migration files or schema definitions in the repository.
- Information on the actual implementation of vector search queries and how they interact with the database is not provided. Check the relevant sections of the codebase for further insights.