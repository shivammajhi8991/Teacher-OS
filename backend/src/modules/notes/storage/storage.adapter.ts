// docs/02 §2.6 "presigned-URL flow" — this interface is the real integration seam; swapping in
// S3/R2 later means writing one adapter against this contract, not touching NotesService or the
// controller. No cloud storage account exists for this project, so LocalDiskStorageAdapter (the
// only registered implementation) is what's actually used — see that file for exactly what it
// does for real (it genuinely writes/reads/deletes files) versus what a cloud adapter would do
// differently (the client PUTs directly to the cloud, bypassing this API entirely; here it PUTs
// to one more of this API's own routes, since there's nowhere else for the bytes to go).
export interface PresignedUpload {
  uploadUrl: string;
  objectKey: string;
}

export interface StorageAdapter {
  createPresignedUpload(): Promise<PresignedUpload>;
  objectExists(objectKey: string): Promise<boolean>;
  readObject(objectKey: string): Promise<Buffer>;
  writeObject(objectKey: string, data: Buffer): Promise<void>;
  deleteObject(objectKey: string): Promise<void>;
}

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');
