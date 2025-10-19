### Handler: `checkHealth` (src/controllers/healthController.ts)
- **Purpose & Triggers:** This handler is invoked to check the health status of the service, typically triggered by a health check endpoint. [ad7f6bcabc4e-0000]
- **Inputs/Validation:** No specific input parameters are required for this endpoint. [ad7f6bcabc4e-0000]
- **Control Flow:** The handler constructs a health check object containing the service status, uptime, and memory usage, and sends it as a JSON response. [ad7f6bcabc4e-0000]
- **Side Effects:** None; it only reads system metrics and responds with the health status. [ad7f6bcabc4e-0000]
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
          "usage": {
            "rss": 12345678,
            "heapTotal": 12345678,
            "heapUsed": 12345678,
            "external": 12345678
          },
          "percentage": 50.0
        }
      }
    }
    ``` [ad7f6bcabc4e-0000]
  - **Errors** (status → when → example body)
    | Status | Condition | Example |
    |--------|-----------|---------|
    | 503 | service is unhealthy | `{ "status": "unhealthy", "timestamp": "2023-10-01T12:00:00Z", "error": "Unknown error" }` [ad7f6bcabc4e-0000] |
- **Middleware/Guards:** None specified. [ad7f6bcabc4e-0000]
- **Observability:** Logs the health status and any errors encountered during the check. [ad7f6bcabc4e-0000]

### Handler: `ping` (src/controllers/healthController.ts)
- **Purpose & Triggers:** This handler is invoked to respond to a simple ping request, typically for testing connectivity. [ad7f6bcabc4e-0000]
- **Inputs/Validation:** No specific input parameters are required for this endpoint. [ad7f6bcabc4e-0000]
- **Control Flow:** The handler sends a JSON response with a "pong" message and the current timestamp. [ad7f6bcabc4e-0000]
- **Side Effects:** None; it simply responds to the request. [ad7f6bcabc4e-0000]
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
- **Observability:** Logs the ping request and response. [ad7f6bcabc4e-0000]

### Handler: `getUserRepose` (src/controllers/githubController.ts)
- **Purpose & Triggers:** This handler is invoked to fetch user repositories, typically triggered by a request to a specific endpoint. [3339a3abe4b6-0001]
- **Inputs/Validation:** No specific input parameters are required for this endpoint. [3339a3abe4b6-0001]
- **Control Flow:** The handler attempts to respond with a message indicating that the endpoint is not implemented yet. [3339a3abe4b6-0001]
- **Side Effects:** None; it does not interact with any services or databases. [3339a3abe4b6-0001]
- **Responses:**
  - **200 OK** example
    ```json
    {
      "message": "Get user repos endpoint",
      "status": "Not implemented yet"
    }
    ``` [3339a3abe4b6-0001]
  - **Errors** (status → when → example body)
    | Status | Condition | Example |
    |--------|-----------|---------|
    | 500 | unhandled error | `{ "error": "Failed to fetch repositories", "message": "Unknown error" }` [3339a3abe4b6-0001] |
- **Middleware/Guards:** None specified. [3339a3abe4b6-0001]
- **Observability:** Logs any errors encountered during the request. [3339a3abe4b6-0001]

### Handler: `handleWebhook` (src/controllers/githubController.ts)
- **Purpose & Triggers:** This handler is invoked to process incoming GitHub webhook events. [3339a3abe4b6-0001]
- **Inputs/Validation:** Expects headers for event type, signature, and delivery ID, as well as the request body containing the event payload. [3339a3abe4b6-0001]
- **Control Flow:** Validates the webhook signature, logs the event, and processes it based on the event type. [3339a3abe4b6-0001]
- **Side Effects:** Logs the event details and stores the webhook event in memory. [3339a3abe4b6-0001]
- **Responses:**
  - **200 OK** example
    ```json
    {
      "message": "Webhook processed successfully"
    }
    ``` [3339a3abe4b6-0001]
  - **Errors** (status → when → example body)
    | Status | Condition | Example |
    |--------|-----------|---------|
    | 401 | invalid signature | `{ "error": "Invalid signature" }` [3339a3abe4b6-0001] |
    | 500 | unhandled error | `{ "error": "Failed to process webhook", "message": "Unknown error" }` [3339a3abe4b6-0001] |
- **Middleware/Guards:** Signature verification is performed to ensure the request is from GitHub. [3339a3abe4b6-0001]
- **Observability:** Logs the received webhook event and any errors encountered during processing. [3339a3abe4b6-0001]

### Handler: `generateRepoDocsLocal` (src/controllers/docsController.ts)
- **Purpose & Triggers:** This handler is invoked to generate documentation for a repository, typically triggered by a request to a specific endpoint. [52bc3f9e678e-0000]
- **Inputs/Validation:** Expects parameters for owner, repo, and commit in the request URL, and checks for the presence of the `OPENAI_API_KEY`. [52bc3f9e678e-0000]
- **Control Flow:** Calls the `generateDocsLocal` service with the provided parameters and returns the generated documentation. [52bc3f9e678e-0000]
- **Side Effects:** Interacts with the documentation generation service and may read from S3 if configured. [52bc3f9e678e-0000]
- **Responses:**
  - **200 OK** example
    ```json
    {
      "ok": true,
      "documentation": "Generated documentation content here."
    }
    ``` [52bc3f9e678e-0000]
  - **Errors** (status → when → example body)
    | Status | Condition | Example |
    |--------|-----------|---------|
    | 400 | missing API key | `{ "error": "OPENAI_API_KEY missing" }` [52bc3f9e678e-0000] |
    | 500 | unhandled error | `{ "error": "Internal error" }` [52bc3f9e678e-0000] |
- **Middleware/Guards:** None specified. [52bc3f9e678e-0000]
- **Observability:** Logs any errors encountered during the documentation generation process. [52bc3f9e678e-0000]