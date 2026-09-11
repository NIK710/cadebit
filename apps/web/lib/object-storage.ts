import "server-only";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { serverEnvironment } from "./environment";

const storage = serverEnvironment.objectStorage;

const globalStorage = globalThis as typeof globalThis & {
  cadebitS3Client?: S3Client;
};

const client =
  globalStorage.cadebitS3Client ??
  new S3Client({
    endpoint: storage.endpoint,
    region: storage.region,
    forcePathStyle: storage.forcePathStyle,
    credentials: {
      accessKeyId: storage.accessKey,
      secretAccessKey: storage.secretKey,
    },
  });

if (process.env.NODE_ENV !== "production")
  globalStorage.cadebitS3Client = client;

export async function putPrivateObject({
  body,
  contentType,
  key,
}: {
  body: Uint8Array;
  contentType: string;
  key: string;
}): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Body: body,
      ContentLength: body.byteLength,
      ContentType: contentType,
    }),
  );
}

export async function deletePrivateObject(key: string): Promise<void> {
  await client.send(
    new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }),
  );
}
