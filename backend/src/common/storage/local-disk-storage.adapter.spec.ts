import { randomUUID } from 'crypto';
import { rm } from 'fs/promises';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { LocalDiskStorageAdapter } from './local-disk-storage.adapter';

// Real filesystem I/O against a throwaway uploads/ directory — matching this codebase's general
// preference for exercising real behavior over mocking fs, given how small the surface is here.
describe('LocalDiskStorageAdapter', () => {
  const adapter = new LocalDiskStorageAdapter();
  const uploadDir = join(process.cwd(), 'uploads');

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('writes and reads back real bytes', async () => {
    const objectKey = randomUUID();
    await adapter.writeObject(
      objectKey,
      Buffer.from('%PDF-1.4 fake but harmless'),
    );
    expect(await adapter.objectExists(objectKey)).toBe(true);
    expect((await adapter.readObject(objectKey)).toString()).toContain(
      '%PDF-1.4',
    );
  });

  // Phase 6 security review — docs/04 §4.8. The one enforcement point every upload (Notes,
  // Assignments) passes through.
  it('rejects a Windows executable payload', async () => {
    await expect(
      adapter.writeObject(randomUUID(), Buffer.from([0x4d, 0x5a, 0x90, 0x00])),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an HTML/script payload', async () => {
    await expect(
      adapter.writeObject(
        randomUUID(),
        Buffer.from('<script>document.cookie</script>'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('never writes the rejected file to disk', async () => {
    const objectKey = randomUUID();
    await expect(
      adapter.writeObject(objectKey, Buffer.from([0x4d, 0x5a])),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await adapter.objectExists(objectKey)).toBe(false);
  });
});
