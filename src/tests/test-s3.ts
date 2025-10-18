import 'dotenv/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fromEnv } from '@aws-sdk/credential-providers';

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.S3_BUCKET_NAME;

if (!BUCKET) {
  throw new Error('Missing S3_BUCKET in env');
}

const s3 = new S3Client({
  region: REGION,
  credentials: fromEnv(),
});

async function main() {
  const key = 'test/hello.txt';
  const body = 'Hello S3 from RepoMind!';

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: 'text/plain; charset=utf-8',
    })
  );

  console.log(`✅ Uploaded s3://${BUCKET}/${key}`);
}

main().catch((err) => {
  console.error('❌ Upload failed:', err);
  process.exit(1);
});