import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function getS3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || "auto";
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing S3 endpoint or credentials");
  }
  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function uploadToS3(params: {
  key: string;
  body: Buffer | string;
  contentType: string;
}) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("Missing S3_BUCKET");
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
  });
  await client.send(command);
  return { bucket, key: params.key };
}
