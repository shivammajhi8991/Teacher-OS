import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { PresignedUpload, StorageAdapter } from './storage.adapter';

// The only registered StorageAdapter in this pass — see storage.adapter.ts for why. Object keys
// are ALWAYS server-generated (`randomUUID()`, never derived from a client-supplied file name),
// which is what keeps `join(UPLOAD_DIR, objectKey)` safe from path traversal — there's no
// user-controlled path segment for a client to smuggle a `../` into.
//
// Important behavioral difference from a real S3/R2 adapter: `uploadUrl` here points back at
// this same API (`documents/storage/upload/:objectKey`, docs/02 §2.6's presigned-URL flow
// adapted for local disk), and that route DOES require the caller's normal JWT — a real
// presigned URL lets the client PUT anonymously straight to the cloud provider. Mobile's upload
// step must attach its own Authorization header when calling this adapter's `uploadUrl`; it
// would not need to for a real cloud adapter.
@Injectable()
export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly uploadDir = join(process.cwd(), 'uploads');

  async createPresignedUpload(): Promise<PresignedUpload> {
    const objectKey = randomUUID();
    return { uploadUrl: `documents/storage/upload/${objectKey}`, objectKey };
  }

  async objectExists(objectKey: string): Promise<boolean> {
    try {
      await readFile(this.pathFor(objectKey));
      return true;
    } catch {
      return false;
    }
  }

  async readObject(objectKey: string): Promise<Buffer> {
    return readFile(this.pathFor(objectKey));
  }

  async writeObject(objectKey: string, data: Buffer): Promise<void> {
    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(this.pathFor(objectKey), data);
  }

  async deleteObject(objectKey: string): Promise<void> {
    await rm(this.pathFor(objectKey), { force: true });
  }

  private pathFor(objectKey: string): string {
    return join(this.uploadDir, objectKey);
  }
}
