### `GET /api/health`
- **Description:** Basic health check endpoint. [f84f168d86e0-0000]
- **Auth:** `Unknown` [f84f168d86e0-0000]
- **Path Params:**
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | None | N/A  | No       | N/A [f84f168d86e0-0000] |
- **Query Params:**
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | None | N/A  | No       | N/A [f84f168d86e0-0000] |
- **Body Schema:**
  ```json
  {}
  ``` [f84f168d86e0-0000]
- **Request Example:**
  ```bash
  curl -X GET https://host/api/health \
    -H 'content-type: application/json'
  ```
- **Responses:**
  - **200 OK** (schema + example)
    ```json
    { "status": "healthy" }
    ``` [f84f168d86e0-0000]
  - **4xx/5xx** (list likely errors seen in snippets: 400, 401, 403, 404, 409, 429, 500)
    | Status | When | Example Payload |
    |--------|------|------------------|
    | 404 | endpoint not found | `{ "error": "Not Found", "message": "Cannot GET /api/health", "timestamp": "..." }` [b84f168d86e0-0000] |

### `GET /api/health/ping`
- **Description:** Simple ping endpoint for quick checks. [f84f168d86e0-0000]
- **Auth:** `Unknown` [f84f168d86e0-0000]
- **Path Params:**
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | None | N/A  | No       | N/A [f84f168d86e0-0000] |
- **Query Params:**
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | None | N/A  | No       | N/A [f84f168d86e0-0000] |
- **Body Schema:**
  ```json
  {}
  ``` [f84f168d86e0-0000]
- **Request Example:**
  ```bash
  curl -X GET https://host/api/health/ping \
    -H 'content-type: application/json'
  ```
- **Responses:**
  - **200 OK** (schema + example)
    ```json
    { "status": "pong" }
    ``` [f84f168d86e0-0000]
  - **4xx/5xx** (list likely errors seen in snippets: 400, 401, 403, 404, 409, 429, 500)
    | Status | When | Example Payload |
    |--------|------|------------------|
    | 404 | endpoint not found | `{ "error": "Not Found", "message": "Cannot GET /api/health/ping", "timestamp": "..." }` [b84f168d86e0-0000] |

### `GET /api/github/user-repos`
- **Description:** User repositories endpoint. [ca4923d8910f-0000]
- **Auth:** `Unknown` [ca4923d8910f-0000]
- **Path Params:**
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | None | N/A  | No       | N/A [ca4923d8910f-0000] |
- **Query Params:**
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | None | N/A  | No       | N/A [ca4923d8910f-0000] |
- **Body Schema:**
  ```json
  {}
  ``` [ca4923d8910f-0000]
- **Request Example:**
  ```bash
  curl -X GET https://host/api/github/user-repos \
    -H 'content-type: application/json'
  ```
- **Responses:**
  - **200 OK** (schema + example)
    ```json
    [ { "repoName": "example-repo", "owner": "user" } ]
    ``` [ca4923d8910f-0000]
  - **4xx/5xx** (list likely errors seen in snippets: 400, 401, 403, 404, 409, 429, 500)
    | Status | When | Example Payload |
    |--------|------|------------------|
    | 404 | endpoint not found | `{ "error": "Not Found", "message": "Cannot GET /api/github/user-repos", "timestamp": "..." }` [ca4923d8910f-0000] |

### `POST /api/github/webhook`
- **Description:** Webhook endpoint to handle GitHub events. [ca4923d8910f-0000]
- **Auth:** `Unknown` [ca4923d8910f-0000]
- **Path Params:**
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | None | N/A  | No       | N/A [ca4923d8910f-0000] |
- **Query Params:**
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | None | N/A  | No       | N/A [ca4923d8910f-0000] |
- **Body Schema:**
  ```json
  { /* Unknown fields */ }
  ``` [ca4923d8910f-0000]
- **Request Example:**
  ```bash
  curl -X POST https://host/api/github/webhook \
    -H 'content-type: application/json' \
    -d '{ ... }'
  ```
- **Responses:**
  - **200 OK** (schema + example)
    ```json
    { "status": "success" }
    ``` [ca4923d8910f-0000]
  - **4xx/5xx** (list likely errors seen in snippets: 400, 401, 403, 404, 409, 429, 500)
    | Status | When | Example Payload |
    |--------|------|------------------|
    | 400 | invalid input | `{ "error": "Invalid payload" }` [ca4923d8910f-0000] |
    | 404 | endpoint not found | `{ "error": "Not Found", "message": "Cannot POST /api/github/webhook", "timestamp": "..." }` [ca4923d8910f-0000] |

### `GET /api/github/webhook/status`
- **Description:** Get the status of the webhook. [ca4923d8910f-0000]
- **Auth:** `Unknown` [ca4923d8910f-0000]
- **Path Params:**
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | None | N/A  | No       | N/A [ca4923d8910f-0000] |
- **Query Params:**
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | None | N/A  | No       | N/A [ca4923d8910f-0000] |
- **Body Schema:**
  ```json
  {}
  ``` [ca4923d8910f-0000]
- **Request Example:**
  ```bash
  curl -X GET https://host/api/github/webhook/status \
    -H 'content-type: application/json'
  ```
- **Responses:**
  - **200 OK** (schema + example)
    ```json
    { "status": "active" }
    ``` [ca4923d8910f-0000]
  - **4xx/5xx** (list likely errors seen in snippets: 400, 401, 403, 404, 409, 429, 500)
    | Status | When | Example Payload |
    |--------|------|------------------|
    | 404 | endpoint not found | `{ "error": "Not Found", "message": "Cannot GET /api/github/webhook/status", "timestamp": "..." }` [ca4923d8910f-0000] |

### `POST /api/docs/:owner/:repo/:commit`
- **Description:** Generate documentation for a repository. [e39856ac14a5-0000]
- **Auth:** `Unknown` [e39856ac14a5-0000]
- **Path Params:**
  | Name   | Type   | Required | Description                       |
  |--------|--------|----------|-----------------------------------|
  | owner  | string | Yes      | The owner of the repository. [e39856ac14a5