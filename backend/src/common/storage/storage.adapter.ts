// docs/02 §2.6 "presigned-URL flow" — this interface is the real integration seam; swapping in
// S3/R2 later means writing one adapter against this contract, not touching any calling service
// or controller. No cloud storage account exists for this project, so LocalDiskStorageAdapter
// (the only registered implementation) is what's actually used — see that file for exactly what
// it does for real (it genuinely writes/reads/deletes files) versus what a cloud adapter would
// do differently (the client PUTs directly to the cloud, bypassing this API entirely; here it
// PUTs to one more of this API's own routes, since there's nowhere else for the bytes to go).
//
// Promoted here from modules/notes/storage/ (docs/07 roadmap Phase 5 "Assignments" — attachments
// need the exact same upload/read/write/delete capability Notes already built; sharing one
// registered adapter instance across both modules avoids duplicating this interface and class,
// and keeps every uploaded file — document or assignment attachment — under one `uploads/`
// object-key namespace). No behavior changed by the move itself.
export interface PresignedUpload {
  uploadUrl: string;
  objectKey: string;
}

export interface StorageAdapter {
  /**
   * @param uploadPathPrefix the calling module's own resource path (e.g. 'documents',
   * 'assignments') — folded into `uploadUrl` so each module's upload-bytes route stays under its
   * own controller rather than a shared one, while every module still writes through the same
   * underlying adapter instance/object-key space.
   */
  createPresignedUpload(uploadPathPrefix: string): Promise<PresignedUpload>;
  objectExists(objectKey: string): Promise<boolean>;
  readObject(objectKey: string): Promise<Buffer>;
  /**
   * docs/04 §4.8 (Phase 6 security review): implementations must reject an executable or
   * script/markup payload by its actual bytes (see file-signature.util.ts), regardless of
   * anything the caller declares — this is the one choke point every upload (Notes, Assignments)
   * passes through, so the check belongs here rather than duplicated per calling service.
   */
  writeObject(objectKey: string, data: Buffer): Promise<void>;
  deleteObject(objectKey: string): Promise<void>;
}

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');
