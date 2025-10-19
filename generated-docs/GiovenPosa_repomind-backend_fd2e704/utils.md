# Utilities Documentation

## Overview
This document provides an overview of utility helpers, key functions, and contracts used in the project. The utilities are designed to assist with text processing, error handling, and logging within an Express application.

## How it Works
The utilities consist of middleware functions and various helper functions that perform tasks such as logging requests, handling errors, normalizing text, calculating line lengths, and generating hashes. These functions are intended to streamline common operations and improve code maintainability.

### Middleware Functions
- **Logger**: Logs the HTTP method and URL of incoming requests.
- **Error Handler**: Catches errors and sends a 500 status response with the error message.

### Utility Functions
- **Text Normalization**: Normalizes line endings and trims trailing spaces.
- **Average Line Length**: Calculates the average length of lines in a given text.
- **Byte Offset Calculation**: Determines the byte offset for a specific line index in a text.
- **Line Count**: Counts the number of lines in a string based on UTF-8 line breaks.
- **Hashing**: Provides SHA-256 and SHA-1 hashing functions for generating unique identifiers.
- **Token Approximation**: Estimates the number of tokens in a string based on character count.
- **Language Guessing**: Infers the programming language from the file extension.

## Key Components

| Function Name            | Description                                           |
|--------------------------|-------------------------------------------------------|
| `logger`                 | Logs HTTP requests                                    |
| `errorHandler`           | Handles errors and sends a response                   |
| `normalizeText`          | Normalizes text format                                |
| `avgLineLen`             | Computes average line length                           |
| `byteOffsetForLine`      | Finds byte offset for a specific line index           |
| `countLines`             | Counts the number of lines in a string                |
| `sha256`                 | Generates a SHA-256 hash of a string                  |
| `approxTokenCount`       | Estimates token count based on character length        |
| `shortId`                | Creates a short ID from a given path                  |
| `chunkId`                | Generates a chunk ID in the format `shortPathHash-0000` |
| `guessLang`              | Guesses the programming language from file extension   |

## Gotchas
- Ensure that the `errorHandler` middleware is added after all other middleware to catch errors effectively.
- The `normalizeText` function assumes that input strings are UTF-8 encoded.
- The `approxTokenCount` function provides a rough estimate and may not be accurate for all text inputs.
- The `guessLang` function relies on specific file extensions; unsupported extensions will not be recognized.

For further details, refer to the source code in the respective files:
- Middleware: `src/middleware/index.ts`
- Utility Functions: `src/utils/parserUtil.ts`