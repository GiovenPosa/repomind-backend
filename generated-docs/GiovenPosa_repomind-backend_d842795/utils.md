# Utilities Documentation

## Overview
This documentation covers utility helpers for working with S3 and text parsing. The utilities include functions for managing JSON data in S3 buckets and various text processing tasks such as normalization, line counting, and hashing.

## How it Works
The utilities are divided into two main categories:

1. **S3 Utilities**: Functions that interact with AWS S3 to store and retrieve JSON and text data.
2. **Parser Utilities**: Functions that assist in text processing, including normalization, line counting, and language guessing.

### S3 Utilities
- **S3 Client**: Utilizes the AWS SDK for JavaScript to interact with S3.
- **Key Functions**:
  - `s3Prefix`: Constructs the S3 prefix for a given repository namespace.
  - `putJsonUnderRepo`: Stores JSON data under a specified repository prefix.
  - `putJsonRaw`: Stores JSON data at a specified bucket/key without a prefix.
  - `getJson`: Retrieves and parses JSON data from a specified bucket/key.
  - `putText`: Stores UTF-8 text at a specified bucket/key.

### Parser Utilities
- **Text Normalization**: Functions to clean and process text data.
- **Key Functions**:
  - `normalizeText`: Normalizes line endings and trims trailing spaces.
  - `avgLineLen`: Calculates the average line length for chunk sizing.
  - `countLines`: Counts the number of line breaks in a string.
  - `guessLang`: Guesses the programming language based on file extension.

## Key Components

### S3 Utilities Functions
| Function Name               | Description                                                  |
|-----------------------------|--------------------------------------------------------------|
| `s3Prefix`                  | Builds the S3 prefix for a repo namespace.                  |
| `putJsonUnderRepo`         | Puts JSON under the repo prefix.                             |
| `putJsonRaw`               | Puts JSON at a raw bucket/key.                               |
| `putJson`                   | Puts JSON at an exact bucket/key.                           |
| `putText`                   | Puts UTF-8 text at an exact bucket/key.                     |
| `getJson`                   | Reads and JSON parses an object from S3.                    |
| `getText`                   | Reads an object as a UTF-8 string from S3.                  |

### Parser Utilities Functions
| Function Name               | Description                                                  |
|-----------------------------|--------------------------------------------------------------|
| `normalizeText`             | Normalizes text by converting CRLF to LF and trimming.      |
| `avgLineLen`                | Computes the average line length of a text.                  |
| `byteOffsetForLine`         | Calculates byte offset for a given line index.              |
| `countLines`                | Counts the number of lines in a string.                     |
| `sha256`                    | Computes SHA-256 hash of a string.                          |
| `approxTokenCount`          | Estimates token count based on character length.            |
| `shortId`                   | Generates a short ID from a path using SHA-1.               |
| `chunkId`                   | Creates a chunk ID in the format `shortPathHash-0000`.     |
| `guessLang`                 | Guesses the programming language from a file extension.      |

## Gotchas
- Ensure that the AWS SDK is properly configured with the necessary credentials to access S3.
- Be cautious with the `putJson` and `putText` functions, as they overwrite existing data at the specified bucket/key.
- The `normalizeText` function may alter the original text format, which could affect data integrity if not handled properly.

For further details, refer to the source code in the respective utility files: [s3Util.ts](src/utils/s3Util.ts) and [parserUtil.ts](src/utils/parserUtil.ts).