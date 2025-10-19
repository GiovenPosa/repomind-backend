# Routes & Endpoints Documentation

## Overview
This documentation provides an overview of the routes and endpoints exposed by the Express application. It details the request/response contracts for each endpoint, allowing developers to understand how to interact with the API effectively.

## How it Works
The application uses Express.js to define various routes that handle incoming HTTP requests. Each route is associated with a specific controller that contains the logic for processing the request and generating a response. The routes are organized under a main router, which is mounted on the `/api` path.

### Main Router Structure
The main router is defined in `src/routes/index.ts` and includes the following sub-routes:

- `/test`: Handled by `testRoutes`
- `/docs`: Handled by `docRoutes`
- `/health`: Handled by `healthRoutes`
- `/github`: Handled by `githubRoutes`
- `/qa`: Handled by `qaRoutes` [86068f311586-0000].

## Key Components

### 1. Health Routes
- **GET `/api/health`**: Checks the health of the application.
- **GET `/api/health/ping`**: A simple ping endpoint for quick checks.

**Controller**: `HealthController`

### 2. GitHub Routes
- **GET `/api/github/user-repos`**: Retrieves user repositories.
- **POST `/api/github/webhook`**: Handles GitHub webhooks.
- **GET `/api/github/webhook/status`**: Checks the status of the webhook.
- **GET `/api/github/new-repos`**: Retrieves new repositories.

**Controller**: `GitHubController`

### 3. Documentation Routes
- **POST `/api/docs/:owner/:repo/:commit`**: Generates documentation for a specific repository.

**Controller**: `docsController`

### 4. QA Routes
- **POST `/api/qa/:owner/:repo`**: Asks a question about a specific repository.

**Controller**: `qaController`

### 5. Test Routes
- **POST `/api/test/ingest`**: Ingests a repository for testing purposes.

**Request Body**:
```json
{
  "owner": "string",
  "repo": "string",
  "ref": "string",
  "include": ["string"],
  "exclude": ["string"],
  "maxFileKB": "number"
}
```

**Response**: Summary of the ingested repository.

**Controller**: `ingestService`

## Gotchas
- **Webhook Configuration**: The GitHub webhook route requires a larger payload limit and raw body parsing. This configuration must be set before mounting the `/api` routes [bcc09dcb20ca-0000].
- **Error Handling**: Ensure to implement proper error handling for all routes to manage unexpected issues gracefully [dedaf00e393f-0000].

## Conclusion
This documentation serves as a guide for developers to understand the routes and endpoints available in the Express application. For further details on the implementation of controllers or middleware, refer to the respective files in the `src/controllers` and `src/middleware` directories.