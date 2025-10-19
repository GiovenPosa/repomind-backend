# Utilities Documentation

## Overview
The Utilities module provides a set of helper functions and middleware for handling common tasks in web applications. It includes logging, error handling, text normalization, and various utility functions for string and file operations.

## How it Works
The Utilities module is designed to streamline common operations in Express applications and text processing. It consists of middleware functions for logging requests and handling errors, as well as utility functions for text manipulation and analysis.

### Middleware
- **Logger**: Logs the HTTP method and URL of incoming requests.
- **Error Handler**: Catches errors and sends a 500 status response with the error message.

### Utility Functions
- **Text Normalization**: Normalizes line endings and trims trailing spaces.
- **Average Line Length**: Calculates the average length of lines in a given text.
- **Byte Offset Calculation**: Determines the byte offset for a specific line index in a text.
- **Line Counting**: Counts the number of lines in a string.
- **Hashing**: Provides SHA-256 and SHA-1 hashing functions for generating unique identifiers.
- **Token Approximation**: Estimates the number of tokens in a string based on byte length.
- **Language Guessing**: Infers the programming language from a file extension.

## Key Components

| Function Name               | Description                                                  |
|-----------------------------|--------------------------------------------------------------|
| `logger`                    | Middleware to log requests.                                 |
| `errorHandler`              | Middleware to handle errors.                                |
| `normalizeText(s: string)`  | Normalizes text by converting CRLF to LF and trimming spaces. |
| `avgLineLen(text: string)`  | Computes the average line length of the provided text.     |
| `byteOffsetForLine(fullText: string, lineIndex: number)` | Returns the byte offset for a specific line index. |
| `countLines(s: string)`     | Counts the number of lines in a string.                    |
| `sha256(text: string)`      | Generates a SHA-256 hash of the input text.               |
| `approxTokenCount(s: string)` | Estimates the number of tokens in a string.              |
| `shortId(s: string)`        | Generates a short ID from a given path.                    |
| `chunkId(filePath: string, ord: number)` | Creates a chunk ID in the format `shortPathHash-0000`. |
| `guessLang(path: string)`   | Guesses the programming language based on file extension.  |

## Gotchas
- The `errorHandler` middleware should be placed after all other middleware to ensure it catches errors correctly.
- The `normalizeText` function does not handle all edge cases, such as mixed line endings in a single string.
- The `guessLang` function relies on specific file extensions; unsupported extensions will not return a language guess.

For further details, refer to the source code in the respective files: `src/middleware/index.ts` for middleware and `src/utils/parserUtil.ts` for utility functions.