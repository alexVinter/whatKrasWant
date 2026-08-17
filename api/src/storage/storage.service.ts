import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export interface StorageObject {
  body: Readable;
  contentType: string;
  contentLength?: number;
}

/**
 * Thin infrastructure wrapper around an S3-compatible object storage
 * (MinIO in development, real S3 in production). Holds no initiative
 * business logic — only object put/get/delete and bucket bootstrap.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly isDevelopment: boolean;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY') ?? '';
    const secretAccessKey = this.config.get<string>('S3_SECRET_KEY') ?? '';
    const forcePathStyle =
      String(this.config.get('S3_FORCE_PATH_STYLE') ?? 'true') === 'true';

    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'wkw-media';
    this.isDevelopment =
      (this.config.get<string>('NODE_ENV') ?? 'development') === 'development';

    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  /**
   * In development the target bucket is created once at startup if missing.
   * Production never provisions infrastructure automatically.
   */
  async onModuleInit(): Promise<void> {
    if (!this.isDevelopment) {
      return;
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created development bucket "${this.bucket}".`);
      } catch (createError) {
        this.logger.warn(
          `Could not ensure development bucket "${this.bucket}": ${
            (createError as Error).message
          }`,
        );
      }
    }
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<StorageObject> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return {
      body: result.Body as Readable,
      contentType: result.ContentType ?? 'application/octet-stream',
      contentLength: result.ContentLength,
    };
  }

  /** Best-effort delete of several objects; never throws. */
  async deleteObjects(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        try {
          await this.client.send(
            new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
          );
        } catch (error) {
          this.logger.warn(
            `Failed to delete object "${key}": ${(error as Error).message}`,
          );
        }
      }),
    );
  }
}
