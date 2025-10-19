# Routes & Endpoints Documentation

## Overview
This document provides an overview of the routes and endpoints exposed by the Express application. It details the request/response contracts for each endpoint, allowing developers to understand how to interact with the API effectively.

## How it Works
The application uses Express.js to define various routes that handle incoming requests. Each route corresponds to a specific functionality, such as health checks, GitHub interactions, and documentation generation. The routes are organized into separate modules for better maintainability.

### Route Structure
- **Base URL**: `/api`
- **Health Check**: `/api/health`
- **GitHub**: `/api/github`
- **Documentation**: `/api/docs`
- **Quality Assurance**: `/api/qa`
- **Testing**: `/api/test`

## Key Components

### Main Router
The main router is defined in `src/routes/index.ts` and aggregates all the individual route modules:
```javascript
const router = Router();
router.use('/test', testRoutes);
router.use('/docs', docRoutes);
router.use('/health', healthRoutes);
router.use('/github', githubRoutes);
router.use('/qa', qaRoutes);
```

### Individual Route Modules

| Route Module     | Endpoint                          | Method | Description                                      |
|------------------|-----------------------------------|--------|--------------------------------------------------|
| **Health Routes**| `/api/health`                     | GET    | Basic health check                               |
|                  | `/api/health/ping`               | GET    | Simple ping endpoint for quick checks            |
| **GitHub Routes**| `/api/github/user-repos`         | GET    | Fetch user repositories                           |
|                  | `/api/github/webhook`            | POST   | Handle GitHub webhook events                      |
|                  | `/api/github/webhook/status`     | GET    | Get the status of the webhook                    |
| **Docs Routes**  | `/api/docs/:owner/:repo/:commit` | POST   | Generate documentation for a specific repo       |
| **QA Routes**    | `/api/qa/:owner/:repo`           | POST   | Ask questions related to a specific repo         |
| **Test Routes**  | `/api/test/ingest`               | POST   | Ingest repository data for testing                |

### Request/Response Contracts

#### Health Check
- **Request**: `GET /api/health`
- **Response**: 
  ```json
  {
    "status": "healthy"
  }
  ```

#### GitHub User Repos
- **Request**: `GET /api/github/user-repos`
- **Response**: 
  ```json
  {
    "repos": [ /* array of repositories */ ]
  }
  ```

#### Ingest Test
- **Request**: `POST /api/test/ingest`
  - **Body**: 
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
- **Response**: 
  ```json
  {
    "owner": "string",
    "repo": "string",
    "commit": "string",
    "stats": { /* stats object */ },
    "keptSample": [{ "path": "string", "size": "number", "lang": "string" }]
  }
  ```

## Gotchas
- **Webhook Handling**: The GitHub webhook route requires a larger payload limit and raw body parsing. Ensure this is configured before mounting the API routes [bcc09dcb20ca-0000].
- **Error Handling**: A global error handler is implemented to catch and log errors, returning a 500 status code for unexpected issues [dedaf00e393f-0000].
- **404 Handling**: Any unmatched routes will return a 404 error with a message indicating the request method and URL [bcc09dcb20ca-0000].

## Conclusion
This documentation outlines the structure and functionality of the API routes. For further details on specific implementations, refer to the respective route modules in the source code. If additional information is needed, please consult the controllers associated with each route.