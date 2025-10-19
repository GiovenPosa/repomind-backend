### `GET /api/health`
- **Description:** Basic health check endpoint. [f84f168d86e0-0000]
- **Auth:** `Unknown` [f84f168d86e0-0000]
- **Path Params:** None
- **Query Params:** None
- **Body Schema:** None
- **Request Example:**
  ```bash
  curl -X GET https://host/api/health
  ```
- **Responses:**
  - **200 OK** (schema + example)
    ```json
    { "status": "healthy" }
    ``` [f84f168d86e0-0000]
  - **4xx/5xx** (list likely errors seen in snippets: 400, 401, 403, 404, 409, 429, 500)
    | Status | When | Example Payload |
    |--------|------|------------------|
    | 404 | endpoint not found | `{ "error": "Not Found", "message": "Cannot GET /api/health", "timestamp": "..." }` [b] |

### `GET /api/health/ping`
- **Description:** Simple ping endpoint for quick checks. [f84f168d86e0-0000]
- **Auth:** `Unknown` [f84f168d86e0-0000]
- **Path Params:** None
- **Query Params:** None
- **Body Schema:** None
- **Request Example:**
  ```bash
  curl -X GET https://host/api/health/ping
  ```
- **Responses:**
  - **200 OK** (schema + example)
    ```json
    { "status": "pong" }
    ``` [f84f168d86e0-0000]
  - **4xx/5xx** (list likely errors seen in snippets: 400, 401, 403, 404, 409, 429, 500)
    | Status | When | Example Payload |
    |--------|------|------------------|
    | 404 | endpoint not found | `{ "error": "Not Found", "message": "Cannot GET /api/health/ping", "timestamp": "..." }` [b] |

### `GET /api/github/user-repos`
- **Description:** User repositories endpoint. [ca4923d8910f-0000]
- **Auth:** `Unknown` [ca4923d8910f-0000]
- **Path Params:** None
- **Query Params:** None
- **Body Schema:** None
- **Request Example:**
  ```bash
  curl -X GET https://host/api/github/user-repos
  ```
- **Responses:**
  - **200 OK** (schema + example)
    ```json
    [ { "repo": "example-repo", "owner": "user" } ]
    ``` [ca4923d8910f-0000]
  - **4xx/5xx** (list likely errors seen in snippets: 400, 401, 403, 404, 409, 429, 500)
    | Status | When | Example Payload |
    |--------|------|------------------|
    | 404 | endpoint not found | `{ "error": "Not Found", "message": "Cannot GET /api/github/user-repos", "timestamp": "..." }` [b] |

### `POST /api/github/webhook`
- **Description:** Webhook endpoint to handle GitHub events. [ca4923d8910f-0000]
- **Auth:** `Unknown` [ca4923d8910f-0000]
- **Path Params:** None
- **Query Params:** None
- **Body Schema:**
  ```json
  { /* Unknown fields */ }
  ``` [ca4923d8910f-0000]
- **Request Example:**
  ```bash
  curl -X POST https://host/api/github/webhook \
    -H 'content-type: application/json' \
    -d '{ /* Unknown payload */ }'
  ```
- **Responses:**
  - **200 OK** (schema + example)
    ```json
    { "status": "success" }
    ``` [ca4923d8910f-0000]
  - **4xx/5xx** (list likely errors seen in snippets: 400, 401, 403, 404, 409, 429, 500)
    | Status | When | Example Payload |
    |--------|------|------------------|
    | 400 | invalid input | `{ "error": "Invalid payload" }` [b] |
    | 404 | endpoint not found | `{ "error": "Not Found", "message": "Cannot POST /api/github/webhook", "timestamp": "..." }` [b] |

### `GET /api/github/webhook/status`
- **Description:** Get the status of the webhook. [ca4923d8910f-0000]
- **Auth:** `Unknown` [ca4923d8910f-0000]
- **Path Params:** None
- **Query Params:** None
- **Body Schema:** None
- **Request Example:**
  ```bash
  curl -X GET https://host/api/github/webhook/status
  ```
- **Responses:**
  - **200 OK** (schema + example)
    ```json
    { "status": "active" }
    ``` [ca4923d8910f-0000]
  - **4xx/5xx** (list likely errors seen in snippets: 400, 401, 403, 404, 409, 429, 500)
    | Status | When | Example Payload |
    |--------|------|------------------|
    | 404 | endpoint not found | `{ "error": "Not Found", "message": "Cannot GET /api/github/webhook/status", "timestamp": "..." }` [b] |

### `POST /api/docs/:owner/:repo/:commit`
- **Description:** Generate documentation for a repository. [e39856ac14a5-0000]
- **Auth:** `Unknown` [e39856ac14a5-0000]
- **Path Params:**
  | Name   | Type   | Required | Description                     |
  |--------|--------|----------|---------------------------------|
  | owner  | string | yes      | The owner of the repository.    |
  | repo   | string | yes      | The name of the repository.     |
  | commit | string | yes      | The commit SHA or branch name.  |
- **Query Params:** None
- **Body Schema:** None
- **Request Example:**
  ```bash
  curl -X POST https://host/api/docs/owner/repo/commit
  ```
- **Responses:**
  - **200 OK** (schema + example)
    ```json
    { "status": "documentation generated" }
    ``` [e39856ac14a5-0000]
  - **4xx/5xx** (list likely errors seen in snippets: 400, 401, 403, 404, 409, 429, 500)
    | Status | When | Example Payload |
    |--------|------|------------------|
    | 400 | invalid input | `{ "error": "Invalid parameters" }` [b] |
    | 404 | endpoint not found | `{ "error": "Not Found", "message": "Cannot POST /api/docs/owner/repo/commit", "timestamp": "..." }` [b] |

### `POST /api/qa/:owner/:repo`
- **Description:** Ask a question about a repository. [6d81e4ddbdf9-0000]
- **Auth:** `Unknown` [6d81e4ddbdf9-0000]
- **Path Params:**
  | Name   | Type   | Required | Description                     |
  |--------|--------|----------|---------------------------------|
  | owner  | string | yes      | The owner of the repository.    |
  | repo   | string | yes      | The name of the repository.     |
- **Query Params:** None
- **Body Schema:** None
- **Request Example:**
  ```bash
  curl -X POST https://host/api/qa/owner/repo
  ```
- **Responses:**
  - **200 OK** (schema + example)
    ```json
    { "response": "Here is the answer to your question." }
    ``` [6d81e4ddbdf9-0000]
  - **4xx/5xx** (list likely errors seen in snippets: 400, 401, 403, 404, 409, 429, 500)
    | Status | When | Example Payload |
    |--------|------|------------------|
    | 400 | invalid input | `{ "error": "Invalid parameters" }` [b] |
    | 404 | endpoint not found | `{ "error": "Not Found", "message": "Cannot POST /api/qa/owner/repo", "timestamp": "..." }` [b] |

### `POST /api/ingest`
- **Description:** Ingest repository data for processing. [c2b57ff31c79-0000]
- **Auth:** `Unknown` [c2b57ff31c79-0000