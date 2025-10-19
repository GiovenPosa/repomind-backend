# External APIs Documentation

## Overview
This documentation covers the usage of external APIs, specifically focusing on authentication, rate limits, and error handling. The examples provided utilize AWS S3 as an external API.

## How it Works
External APIs allow applications to interact with services outside their own environment. In this case, we are using AWS S3 for object storage. The following steps outline the process:

1. **Authentication**: Use environment variables to manage credentials securely.
2. **API Interaction**: Send requests to the external API (e.g., uploading files to S3).
3. **Error Handling**: Implement middleware to manage errors effectively.

## Key Components

### Authentication
- **Environment Variables**: Store sensitive information like AWS credentials and bucket names in environment variables.
  - Example:
    ```javascript
    const REGION = process.env.AWS_REGION;
    const BUCKET = process.env.S3_BUCKET_NAME;
    ```

### API Interaction
- **AWS SDK**: Utilize the AWS SDK for JavaScript to interact with S3.
- **PutObjectCommand**: Use this command to upload files to the specified S3 bucket.
  - Example:
    ```javascript
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: 'text/plain; charset=utf-8',
      })
    );
    ```

### Error Handling
- **Middleware**: Implement middleware functions to log requests and handle errors.
  - Example:
    ```javascript
    export const logger = (req: Request, res: Response, next: NextFunction) => {
        console.log(`${req.method} ${req.url}`);
        next();
    };

    export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
        console.error(err.stack);
        res.status(500).send('Something broke!');
    };
    ```

## Gotchas
- **Missing Environment Variables**: Ensure that all required environment variables are set. For instance, if `S3_BUCKET_NAME` is not defined, the application will throw an error.
- **Rate Limits**: Be aware of the rate limits imposed by the external API. AWS S3 has specific limits on requests that should be monitored to avoid throttling.
- **Error Handling**: Always implement robust error handling to manage unexpected failures gracefully.

## Conclusion
This documentation provides a foundational understanding of how to interact with external APIs, specifically AWS S3. For further details on specific APIs, refer to their official documentation.