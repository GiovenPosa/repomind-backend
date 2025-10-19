# External APIs Documentation

## Overview
This document provides an overview of how to use external APIs, specifically focusing on OpenAI, GitHub, and AWS S3. It covers authentication, rate limits, and key components necessary for integration.

## How it Works
External APIs allow applications to interact with services over the internet. Each API has its own authentication mechanisms, rate limits, and usage patterns. Below are the specifics for the APIs discussed.

### OpenAI
- **Authentication**: Uses an API key, which can be provided directly or retrieved from environment variables.
- **Rate Limits**: Not explicitly mentioned in the context, but typically, OpenAI APIs have usage limits based on the subscription plan.
- **Usage**: The API can generate text and create embeddings from input texts.

### AWS S3
- **Authentication**: Utilizes AWS credentials from environment variables.
- **Rate Limits**: Not specified in the context; AWS services generally have service limits that can be found in the AWS documentation.
- **Usage**: Allows uploading files to a specified S3 bucket.

## Key Components

### OpenAI Embedder
- **Class**: `OpenAIEmbedder`
- **Methods**:
  - `embed(texts: string[]): Promise<number[][]>`: Takes an array of texts and returns their embeddings.
- **Configuration**:
  - `apiKey`: API key for authentication.
  - `model`: Specifies the embedding model to use (default is `text-embedding-3-small`).

### OpenAI Generator
- **Class**: `OpenAIGenerator`
- **Methods**:
  - `generate(prompt: string, opts?: { system?: string; maxTokens?: number; temperature?: number })`: Generates text based on a prompt.
- **Configuration**:
  - `apiKey`: API key for authentication.
  - `model`: Specifies the chat model to use (default is `gpt-4o-mini`).

### AWS S3 Client
- **Client**: `S3Client`
- **Methods**:
  - `send(command: PutObjectCommand)`: Sends a command to upload an object to S3.
- **Configuration**:
  - `region`: AWS region for the S3 bucket.
  - `credentials`: AWS credentials from environment variables.

## Gotchas
- Ensure that all required environment variables (e.g., `AWS_REGION`, `S3_BUCKET_NAME`, `OPENAI_API_KEY`) are set before running the application.
- Be aware of the rate limits imposed by the APIs to avoid service interruptions.
- The default models for OpenAI can be overridden by providing specific model names in the constructor options.

## Conclusion
Integrating external APIs like OpenAI and AWS S3 can enhance the functionality of applications. Proper authentication and understanding of rate limits are crucial for successful implementation. For further details, refer to the respective API documentation for OpenAI and AWS S3.