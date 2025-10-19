### Handler: `checkHealth` (src/controllers/healthController.ts)
- **Purpose & Triggers:** This handler is invoked to check the health status of the service, typically triggered by a health check endpoint (e.g., `/health`). [ad7f6bcabc4e-0000]
- **Inputs/Validation:** No specific input parameters are required for this endpoint. [ad7f6bcabc4e-0000]
- **Control Flow:** The handler constructs a health check object containing service status, uptime, and memory usage, then sends it as a JSON response. [ad7f6bcabc4e-0000]
- **Side Effects:** None noted; primarily reads system metrics and responds. [ad7f6bcabc4e-0000]
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
- **Observability:** Logs the health status; no specific metrics or tracing mentioned. [ad7f6bcabc4e-0000]

### Handler: `ping` (src/controllers/healthController.ts)
- **Purpose & Triggers:** This handler is invoked to respond to a simple ping request, typically for testing connectivity. [ad7f6bcabc4e-0000]
- **Inputs/Validation:** No input parameters are required. [ad7f6bcabc4e-0000]
- **Control Flow:** Responds with a JSON object containing a message and timestamp. [ad7f6bcabc4e-0000]
- **Side Effects:** None noted; purely a response handler. [ad7f6bcabc4e-0000]
- **Responses:**
  - **200 OK** example
    ```json
    {
      "message": "pong",
      "timestamp": "2023-10-01T12:00:00Z"
    }
    ``` [ad7f6bcabc4e-0000]
  - **Errors** (status → when → example body)
    | Status | Condition | Example |
    |--------|-----------|---------|
    | None | No errors expected. | N/A |
- **Middleware/Guards:** None specified. [ad7f6bcabc4e-0000]
- **Observability:** Logs the ping response; no specific metrics or tracing mentioned. [ad7f6bcabc4e-0000]

### Handler: `getUserRepose` (src/controllers/githubController.ts)
- **Purpose & Triggers:** This handler is invoked to retrieve user repositories, typically triggered by a request to a specific endpoint. [3339a3abe4b6-0002]
- **Inputs/Validation:** No specific input parameters are required. [3339a3abe4b6-0002]
- **Control Flow:** Responds with a message indicating the endpoint is not implemented yet. [3339a3abe4b6-0002]
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
- **Observability:** Logs errors if they occur; no specific metrics or tracing mentioned. [3339a3abe4b6-0002]

### Handler: `handleWebhook` (src/controllers/githubController.ts)
- **Purpose & Triggers:** This handler processes incoming GitHub webhook events, triggered by GitHub's webhook system. [3339a3abe4b6-0002]
- **Inputs/Validation:** Expects headers for event type, signature, and delivery ID; validates the webhook signature. [3339a3abe4b6-0002]
- **Control Flow:** Validates the webhook signature, processes the event based on its type, and may trigger additional actions (e.g., queuing ingests). [3339a3abe4b6-0002]
- **Side Effects:** Logs events, may queue ingests based on the event type. [3339a3abe4b6-0002]
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
- **Middleware/Guards:** Signature verification for security. [3339a3abe4b6-0002]
- **Observability:** Logs event processing; no specific metrics or tracing mentioned. [3339a3abe4b6-0002]

### Handler: `getWebhookStatus` (src/controllers/githubController.ts)
- **Purpose & Triggers:** This handler retrieves the status of the webhook for debugging purposes, typically triggered by a specific endpoint request. [3339a3abe4b6-0002]
- **Inputs/Validation:** No specific input parameters are required. [3339a3abe4b6-0002]
- **Control Flow:** Compiles recent webhook events and returns their status. [3339a3abe4b6-0002]
- **Side Effects:** None noted; primarily reads from internal state. [3339a3abe4b6-0002]
- **Responses:**
  - **200 OK** example
    ```json
    {
      "status": "active",
      "endpoint": "http://example.com/api/github/webhook",
      "appId": "12345",
      "eventsConfigured": [ /* list of events */ ],
      "secretConfigured": true,
      "totalEventsReceived": 10,
      "recentEvents": [ /* recent events */ ],
      "newReposDetected": 5,
      "lastNewRepo": { /* last repo details */ }
    }
    ``` [3339a3abe4b6-0002]
  - **Errors** (status → when → example body)
    | Status | Condition | Example |
    |--------|-----------|---------|
    | 500 | unhandled | `{ "error": "Failed to get webhook status", "message": "Unknown error" }` [3339a3abe4b6-0002] |
- **Middleware/Guards:** None specified. [3339a3abe4b6-0002]
- **Observability:** Logs status retrieval; no specific metrics or tracing mentioned. [3339a3abe4b6-0002]

### Handler: `getNewRepositories` (src/controllers/githubController.ts)
- **Purpose & Triggers:** This handler retrieves a list of newly created repositories, typically triggered by a specific endpoint request. [3339a3abe4b6-0002]
- **Inputs/Validation:** No specific input parameters are required. [3339a3abe4b6-0002]
- **Control Flow:** Returns the count and details of new repositories detected since the server started. [333