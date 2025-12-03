// backend/src/storage.ts
import * as Minio from "minio";
import { config } from "./config";

const minioClient = new Minio.Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

export async function ensureBucketExists(bucket = config.minio.bucket) {
  return new Promise<void>((resolve, reject) => {
    minioClient.bucketExists(bucket, (err, exists) => {
      if (err) return reject(err);
      if (exists) return resolve();
      minioClient.makeBucket(bucket, "", (err2) => {
        if (err2) return reject(err2);
        resolve();
      });
    });
  });
}

export async function putJson(key: string, obj: any, bucket = config.minio.bucket) {
  await ensureBucketExists(bucket);
  const body = Buffer.from(JSON.stringify(obj));
  return new Promise<string>((resolve, reject) => {
    minioClient.putObject(bucket, key, body, (err, etag) => {
      if (err) return reject(err);
      resolve((etag as any)?.etag || "");
    });
  });
}

export async function getJson(key: string, bucket = config.minio.bucket) {
  return new Promise<any>((resolve, reject) => {
    minioClient.getObject(bucket, key, (err, stream) => {
      if (err) return reject(err);
      const parts: Buffer[] = [];
      stream.on("data", (c: Buffer) => parts.push(c));
      stream.on("end", () => {
        try {
          const buf = Buffer.concat(parts);
          resolve(JSON.parse(buf.toString()));
        } catch (e) {
          reject(e);
        }
      });
      stream.on("error", reject);
    });
  });
}
