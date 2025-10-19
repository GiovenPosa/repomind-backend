## Controllers

### Handler: `HealthController.checkHealth` (src/controllers/healthController.ts)
- **Purpose & Triggers:** This handler is invoked to check the health status of the service, typically triggered by a health check endpoint (e.g., `/health`). [ad7f6bcabc4e-0000]
- **Inputs/Validation:** No specific input parameters are required for this endpoint. [ad7f6bcabc4e-0000]
- **Control Flow:** The handler constructs a health check object containing service status, uptime, and memory usage, then sends it as a JSON response. [ad7f6bcabc4e-0000]
- **Side Effects:** None noted; primarily reads system status and responds. [ad7f6bcabc4e-0000]
- **Responses:**
  - **200 OK** example
    ```json
    {
      "status": "healthy",
      "timestamp": "2023-10-01T12:00:00Z",
      "uptime": 12345,
      "service": "repomind-backend",
      "environment": "development",
      "version": "1.0.0",
      "checks": {
        "api": "operational",
        "memory": {
          "usage": { /* memory usage details */ },
          "percentage": 75.5
        }
      }
    }
    ``` [ad7f6bcabc4e-0000]
  - **Errors** (status → when → example body)
    | Status | Condition | Example |
    |--------|-----------|---------|
    | 503 | service unhealthy | `{ "status": "unhealthy", "timestamp": "2023-10-01T12:00:00Z", "error": "Unknown error" }` [ad7f6bcabc4e-0000] |
- **Middleware/Guards:** None specified. [ad7f6bcabc4e-0000]
- **Observability:** Logs the health status; errors are caught and logged. [ad7f6bcabc4e-0000]

### Handler: `HealthController.ping` (src/controllers/healthController.ts)
- **Purpose & Triggers:** This handler is invoked to respond to a ping request, typically used for testing connectivity. [ad7f6bcabc4e-0000]
- **Inputs/Validation:** No specific input parameters are required for this endpoint. [ad7f6bcabc4e-0000]
- **Control Flow:** Sends a simple JSON response indicating the service is reachable. [ad7f6bcabc4e-0000]
- **Side Effects:** None noted; simply responds to the request. [ad7f6bcabc4e-0000]
- **Responses:**
  - **200 OK** example
    ```json
    {
      "message": "pong",
      "timestamp": "2023-10-01T12:00:00Z"
    }
    ``` [ad7f6bcabc4e-0000]
  - **Errors**: None specified. [ad7f6bcabc4e-0000]
- **Middleware/Guards:** None specified. [ad7f6bcabc4e-0000]
- **Observability:** Logs the ping response; no error handling needed. [ad7f6bcabc4e-0000]

### Handler: `GitHubController.getUserRepose` (src/controllers/githubController.ts)
- **Purpose & Triggers:** This handler is invoked to retrieve user repositories, typically triggered by a GET request to a specific endpoint. [3339a3abe4b6-0002]
- **Inputs/Validation:** No specific input parameters are required for this endpoint. [3339a3abe4b6-0002]
- **Control Flow:** Attempts to fetch user repositories and responds with a message indicating the endpoint is not implemented. [3339a3abe4b6-0002]
- **Side Effects:** None noted; primarily a placeholder response. [3339a3abe4b6-0002]
- **Responses:**
  - **200 OK** example
    ```json
    {
      "message": "Get user repos endpoint",
      "status": "Not implemented yet"
    }
    ``` [3339a3abe4b6-0002]
  - **Errors** (status → when → example body)
    | Status | Condition | Example |
    |--------|-----------|---------|
    | 500 | unhandled | `{ "error": "Failed to fetch repositories", "message": "Unknown error" }` [3339a3abe4b6-0002] |
- **Middleware/Guards:** None specified. [3339a3abe4b6-0002]
- **Observability:** Logs errors if they occur. [3339a3abe4b6-0002]

### Handler: `GitHubController.handleWebhook` (src/controllers/githubController.ts)
- **Purpose & Triggers:** This handler processes incoming webhook events from GitHub, triggered by specific GitHub events (e.g., push, pull request). [3339a3abe4b6-0002]
- **Inputs/Validation:** Expects headers for event type, signature, and delivery ID; validates the webhook signature. [3339a3abe4b6-0002]
- **Control Flow:** Validates the webhook signature, processes the event based on its type, and may trigger further actions (e.g., queuing ingests). [3339a3abe4b6-0002]
- **Side Effects:** Writes to logs, may queue ingestion tasks based on the event. [3339a3abe4b6-0002]
- **Responses:**
  - **200 OK** example
    ```json
    {
      "status": "Webhook processed successfully"
    }
    ``` [3339a3abe4b6-0002]
  - **Errors** (status → when → example body)
    | Status | Condition | Example |
    |--------|-----------|---------|
    | 400 | invalid signature | `{ "error": "Invalid signature" }` [3339a3abe4b6-0002] |
    | 500 | unhandled | `{ "error": "Failed to process webhook", "message": "Unknown error" }` [3339a3abe4b6-0002] |
- **Middleware/Guards:** Signature verification is performed. [3339a3abe4b6-0002]
- **Observability:** Logs event processing and errors. [3339a3abe4b6-0002]

### Handler: `GitHubController.getWebhookStatus` (src/controllers/githubController.ts)
- **Purpose & Triggers:** This handler retrieves the status of the webhook for debugging purposes, typically triggered by a GET request. [3339a3abe4b6-0002]
- **Inputs/Validation:** No specific input parameters are required for this endpoint. [3339a3abe4b6-0002]
- **Control Flow:** Compiles recent webhook events and returns their status. [3339a3abe4b6-0002]
- **Side Effects:** None noted; primarily reads from internal state. [3339a3abe4b6-0002]
- **Responses:**
  - **200 OK** example
    ```json
    {
      "status": "active",
      "endpoint": "http://example.com/api/github/webhook",
      "appId": "12345",
      "eventsConfigured": ["repository", "ping", "push"],
      "secretConfigured": true,
      "totalEventsReceived": 10,
      "recentEvents": [{ "type": "push", "deliveryId": "abc123", "timestamp": "2023-10-01T12:00:00Z" }],
      "newReposDetected": 5,
      "lastNewRepo": "repo-name"
    }
    ``` [3339a3abe4b6-0002]
  - **Errors** (status → when → example body)
    | Status | Condition | Example |
    |--------|-----------|---------|
    | 500 | unhandled | `{ "error": "Failed to get webhook status", "message": "Unknown error" }` [3339a3abe4b6-0002] |
- **Middleware/Guards:** None specified. [3339a3abe4b6-0002]
- **Observability:** Logs the status retrieval process and errors. [3339a3abe4b6-0002]

### Handler: `GitHubController.getNewRepositories` (src/controllers/githubController.ts)
- **Purpose & Triggers:** This handler retrieves a list of newly created repositories since the server started, typically triggered by a GET request. [3339a3abe4b6-0002]
- **Inputs/Validation:** No specific input parameters are required