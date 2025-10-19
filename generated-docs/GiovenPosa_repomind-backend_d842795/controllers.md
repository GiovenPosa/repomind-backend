# Controllers Documentation

## Overview
This documentation covers the responsibilities and request handling of the controllers in the application, specifically focusing on HTTP controllers, webhook verification flows, and follow-up processing.

## How it Works
The controllers are designed to handle incoming HTTP requests, process them, and return appropriate responses. They utilize Express.js for routing and middleware management. Key functionalities include health checks, repository queries, and GitHub webhook handling.

### Health Check
- **Endpoint**: `/health`
- **Method**: `GET`
- **Response**: Returns the health status of the service, including uptime and memory usage.

### Repository Queries
- **Endpoint**: `/repos/:owner/:repo/ask`
- **Method**: `POST`
- **Request Body**: 
  - `q`: Query string (required)
  - `branch`: Optional branch name
  - `commit`: Optional commit SHA
- **Response**: Returns relevant snippets from the repository based on the query.

### GitHub Webhook Handling
- **Endpoint**: `/webhook`
- **Method**: `POST`
- **Request Headers**: 
  - `x-github-event`: Type of event (e.g., `push`, `pull_request`)
  - `x-hub-signature-256`: Signature for verification
- **Response**: Acknowledges receipt of the webhook event and processes it accordingly.

## Key Components

| Component          | Description                                                                 |
|--------------------|-----------------------------------------------------------------------------|
| **HealthController** | Manages health check and ping endpoints.                                   |
| **GitHubController** | Handles GitHub webhook events and repository management.                  |
| **QAController**    | Processes repository queries and generates answers using AI embeddings.    |
| **DocsController**  | Generates documentation for repositories based on specified sections.      |
| **Middleware**      | Includes logging and error handling functionalities.                        |

### HealthController
- **Methods**:
  - `checkHealth`: Returns service health status.
  - `ping`: Simple ping response.

### GitHubController
- **Methods**:
  - `handleWebhook`: Validates and processes incoming GitHub webhook events.
  - `getUserRepos`: Placeholder for fetching user repositories.

### QAController
- **Methods**:
  - `askRepo`: Handles queries against a repository and retrieves relevant information.

### DocsController
- **Methods**:
  - `generateRepoDocsLocal`: Generates documentation for a specified repository.

## Gotchas
- Ensure that environment variables such as `OPENAI_API_KEY` and `GITHUB_WEBHOOK_SECRET` are set correctly to avoid errors during processing.
- The GitHub webhook verification relies on the correct configuration of the secret; if not set, the verification will be skipped, which may lead to security vulnerabilities.
- The `askRepo` method requires a valid query (`q`) to function properly; otherwise, it will return a 400 error.

## Conclusion
This documentation provides a concise overview of the controllers within the application, detailing their responsibilities and how they interact with incoming requests. For further details, refer to the specific controller implementations in the source code.