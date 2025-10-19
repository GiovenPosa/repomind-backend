# Controllers Documentation

## Overview
Controllers in this application handle HTTP requests and responses, manage webhook events, and facilitate interactions with various services. They are primarily built using Express.js and are responsible for ensuring that incoming requests are processed correctly and that appropriate responses are sent back to the client.

## How it Works
Controllers are structured to handle specific routes and functionalities:

- **Health Checks**: The `HealthController` provides endpoints to check the health status of the service and respond to ping requests.
- **Question and Answer**: The `qaController` processes user queries related to repositories, utilizing AI services to generate responses based on the repository's content.
- **GitHub Webhook Handling**: The `GitHubController` manages incoming webhook events from GitHub, verifying signatures and processing various event types such as issues, stars, and forks.

### Request Handling Flow
1. **Incoming Request**: A request is received at a specific endpoint.
2. **Controller Method Invocation**: The corresponding controller method is invoked based on the route.
3. **Processing Logic**: The controller processes the request, which may involve:
   - Validating input parameters.
   - Interacting with external services (e.g., AI services, S3 storage).
   - Performing business logic (e.g., searching for relevant repository chunks).
4. **Response Generation**: The controller sends a JSON response back to the client, indicating success or failure.

## Key Components

### HealthController
- **Methods**:
  - `checkHealth(req, res)`: Returns the health status of the service, including uptime and memory usage.
  - `ping(req, res)`: Responds with a simple "pong" message.

### qaController
- **Methods**:
  - `askRepo(req, res)`: Handles user queries about repositories, embedding the query and retrieving relevant chunks from S3.

### GitHubController
- **Methods**:
  - `handleWebhook(req, res)`: Processes incoming webhook events, verifies signatures, and routes events to specific handlers.
  - **Event Handlers**:
    - `handleIssuesEvent(payload)`: Logs details about issue events.
    - `handleStarEvent(payload)`: Logs details about star events.
    - `handleForkEvent(payload)`: Logs details about fork events.

### Middleware
- **Logger**: Logs incoming requests.
- **Error Handler**: Catches and logs errors, sending a 500 response to the client.

## Gotchas
- **Environment Variables**: Ensure that required environment variables (e.g., `OPENAI_API_KEY`, `GITHUB_WEBHOOK_SECRET`) are set, as missing variables can lead to errors in processing requests [9ee77cb9ce9b-0000].
- **Webhook Signature Verification**: If the webhook secret is not configured, the application will skip signature verification, which could expose it to security risks [3339a3abe4b6-0001].
- **Error Handling**: Proper error handling is crucial to avoid exposing sensitive information in responses. Always check for errors and respond with generic messages when necessary [dedaf00e393f-0000].

## Conclusion
This documentation provides an overview of the controllers used in the application, detailing their responsibilities and how they interact with incoming requests and external services. For further details, refer to the specific controller implementations in the source code.