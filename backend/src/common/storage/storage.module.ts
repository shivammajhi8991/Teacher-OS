import { Module } from '@nestjs/common';
import { STORAGE_ADAPTER } from './storage.adapter';
import { LocalDiskStorageAdapter } from './local-disk-storage.adapter';

// Shared by every module needing file storage (Notes, Assignments, ...) — see
// storage.adapter.ts's header comment for why this lives in common/ rather than under one
// module. Importing this module from more than one place is safe and intended: Nest treats a
// module class as a singleton node in the dependency graph, so every importer gets the exact
// same LocalDiskStorageAdapter instance (one shared `uploads/` directory), not a new one each.
@Module({
  providers: [
    // No cloud storage account exists for this project — see storage.adapter.ts. Swapping in a
    // real S3/R2 adapter later is a one-line change here, shared by every module at once.
    { provide: STORAGE_ADAPTER, useClass: LocalDiskStorageAdapter },
  ],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
