# Utilities Documentation

## Overview
This documentation covers utility helpers, key functions, and contracts used in the project. The utilities include middleware for logging and error handling, as well as various text processing and hashing functions.

## How it Works
The utilities are organized into two main categories:

1. **Middleware Functions**: These are functions that handle HTTP requests and responses in an Express application.
   - **Logger**: Logs the HTTP method and URL of incoming requests.
   - **Error Handler**: Catches errors and sends a 500 status response with the error message.

2. **Utility Functions**: These functions provide various text processing capabilities, including normalization, line counting, and hashing.

## Key Components

### Middleware Functions
| Function Name   | Description                                           |
|------------------|-------------------------------------------------------|
| `logger`         | Logs the HTTP method and URL of incoming requests.   |
| `errorHandler`   | Handles errors by logging the stack and sending a 500 response. |

### Utility Functions
| Function Name                | Description                                                                 |
|-------------------------------|-----------------------------------------------------------------------------|
| `normalizeText(s: string)`    | Normalizes text by converting CRLF to LF and trimming trailing spaces.     |
| `avgLineLen(text: string)`    | Calculates the average line length of the provided text.                    |
| `byteOffsetForLine(fullText: string, lineIndex: number)` | Returns the byte offset for a given line index.                          |
| `countLines(s: string)`       | Counts the number of lines in a string based on UTF-8 line breaks.         |
| `sha256(text: string)`        | Generates a SHA-256 hash of the input text.                                |
| `approxTokenCount(s: string)` | Estimates the number of tokens in a string (approx. 4 chars per token).   |
| `shortId(s: string)`          | Generates a stable short ID from a given path.                             |
| `chunkId(filePath: string, ord: number)` | Creates a chunk ID in the format `shortPathHash-0000`.              |
| `guessLang(path: string)`     | Guesses the programming language based on the file extension.              |

## Gotchas
- Ensure that the middleware functions are properly integrated into the Express application to handle requests and errors effectively.
- The `normalizeText` function only normalizes line endings and trims spaces; it does not perform any other text processing.
- The `approxTokenCount` function provides a rough estimate and may not be accurate for all text inputs.

## Additional Notes
- For more detailed information on the implementation of these utilities, refer to the source files located in the `src/middleware` and `src/utils` directories.
- If you encounter any issues or need further clarification, consider checking the relevant sections of the codebase or reaching out to the development team.