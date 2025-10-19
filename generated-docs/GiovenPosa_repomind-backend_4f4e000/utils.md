# Utilities Documentation

## Overview
This documentation covers utility helpers for S3 operations and text parsing. The utilities are designed to facilitate interactions with AWS S3 and provide various text processing functions.

## How it Works
The utilities are divided into two main categories:

1. **S3 Utilities**: Functions for interacting with AWS S3, including uploading and retrieving JSON and text data.
2. **Parser Utilities**: Functions for text normalization, line counting, hashing, and language guessing based on file extensions.

## Key Components

### S3 Utilities
- **s3Prefix**: Constructs the S3 prefix for a repository namespace.
  ```typescript
  export function s3Prefix({ tenantId, owner, repo }: S3RepoScope)
  ```

- **putJsonUnderRepo**: Uploads JSON data under a specified repository prefix.
  ```typescript
  export async function putJsonUnderRepo(s3: S3Client, layout: S3IngestLayout, keyUnderRepo: string, data: unknown)
  ```

- **putJsonRaw**: Uploads JSON data to a specified bucket and key without any prefix.
  ```typescript
  export async function putJsonRaw(s3: S3Client, bucket: string, key: string, data: unknown)
  ```

- **putJson**: Uploads JSON data to a specific bucket and key.
  ```typescript
  export async function putJson(s3: S3Client, bucket: string, key: string, data: unknown)
  ```

- **putText**: Uploads UTF-8 text to a specified bucket and key.
  ```typescript
  export async function putText(s3: S3Client, bucket: string, key: string, text: string, contentType = "text/plain; charset=utf-8")
  ```

- **getJson**: Retrieves and parses JSON data from a specified bucket and key.
  ```typescript
  export async function getJson<T>(s3: S3Client, bucket: string, key: string): Promise<T>
  ```

- **getText**: Retrieves text data from a specified bucket and key.
  ```typescript
  export async function getText(s3: S3Client, bucket: string, key: string): Promise<string>
  ```

### Parser Utilities
- **normalizeText**: Normalizes text by converting CRLF to LF and trimming trailing spaces.
  ```typescript
  export function normalizeText(s: string)
  ```

- **avgLineLen**: Calculates the average line length for chunk sizing heuristics.
  ```typescript
  export function avgLineLen(text: string)
  ```

- **byteOffsetForLine**: Computes the byte offset for a given line index.
  ```typescript
  export function byteOffsetForLine(fullText: string, lineIndex: number)
  ```

- **countLines**: Counts the number of line breaks in a string.
  ```typescript
  export function countLines(s: string)
  ```

- **sha256**: Computes the SHA-256 hash of a string.
  ```typescript
  export function sha256(text: string)
  ```

- **approxTokenCount**: Estimates the number of tokens in a string.
  ```typescript
  export function approxTokenCount(s: string)
  ```

- **shortId**: Generates a stable short ID from a path.
  ```typescript
  export function shortId(s: string)
  ```

- **chunkId**: Creates a chunk ID in the format `shortPathHash-0000`.
  ```typescript
  export function chunkId(filePath: string, ord: number)
  ```

- **guessLang**: Guesses the programming language based on the file extension.
  ```typescript
  export function guessLang(path: string)
  ```

### Middleware
- **logger**: Middleware for logging HTTP requests.
  ```typescript
  export const logger = (req: Request, res: Response, next: NextFunction) => { ... }
  ```

- **errorHandler**: Middleware for handling errors in the application.
  ```typescript
  export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => { ... }
  ```

## Gotchas
- Ensure that the AWS SDK is properly configured with the necessary credentials and permissions to access S3.
- Be cautious with the size of the data being uploaded; large objects may require additional handling.
- The `getJson` and `getText` functions assume that the object exists and is accessible; error handling should be implemented for production use.

For further details, refer to the source code in the respective utility files: `src/utils/s3Util.ts` and `src/utils/parserUtil.ts`.