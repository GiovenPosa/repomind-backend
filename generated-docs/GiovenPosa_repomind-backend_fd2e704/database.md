# Database Schema Documentation

## Overview
This documentation provides an overview of the database schema used in the application, focusing on the PostgreSQL setup, the tables and indexes utilized, and the implementation of vector search functionality.

## How it Works
The application connects to a PostgreSQL database using a connection pool. The connection string is sourced from an environment variable, allowing for flexible deployment configurations. The database connection supports SSL configurations based on the environment settings.

### Connection Pooling
- **Library Used**: `pg` (PostgreSQL client for Node.js)
- **Connection String**: Retrieved from `process.env.SUPABASE_URL`
- **SSL Configuration**: 
  - Disabled for internal connections if `DB_SSL` is set to "false".
  - Otherwise, SSL is enabled with `rejectUnauthorized` set to false for development purposes.

### SQL Client
The application defines a `SQLClient` type that includes a `query` method for executing SQL commands. The `withClient` function manages the connection lifecycle, ensuring that connections are released after use.

## Key Components
### Database Connection
- **Pool**: Manages multiple connections to the database.
- **SQLClient**: Interface for executing SQL queries.

### Vector Search
The application utilizes embedding techniques for vector search, which involves:
- **Embedder Interface**: Defines methods for generating embedding vectors from text inputs.
  - **Properties**:
    - `name`: Identifier for the embedding model (e.g., "openai", "ollama").
    - `dim`: Dimensionality of the embedding vectors.
  - **Method**: `embed(texts: string[]): Promise<number[][]>` - Generates embeddings for an array of texts.

### Generator Interface
- **Purpose**: To generate text based on a given prompt.
- **Method**: `generate(prompt: string, opts?: { system?: string; maxTokens?: number; temperature?: number }): Promise<string>` - Produces a text response based on the input prompt and optional parameters.

## Gotchas
- Ensure that the `DB_SSL` environment variable is correctly set based on the deployment environment to avoid connection issues.
- The embedding and generation functionalities depend on the correct implementation of the `Embedder` and `Generator` interfaces, which may require additional context on the specific models used.

## Conclusion
This documentation outlines the essential components of the database schema and its interaction with vector search capabilities. For further details on specific tables and indexes, additional context may be required from the database schema definitions or migration files.