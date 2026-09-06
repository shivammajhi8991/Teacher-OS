// docs/04 §4.8 security baseline: "File uploads validated by content-type + magic-byte sniffing
// server-side (never trust client-declared MIME)". Implemented as a Phase 6 security-review fix —
// see docs/07-roadmap.md's Phase 6 entry. This inspects the actual uploaded bytes rather than any
// client-supplied Content-Type header or filename extension, which this codebase's upload flow
// (a raw-bytes PUT-equivalent, see storage.adapter.ts) never even captures in the first place.

export type DetectedFileKind =
  'pdf' | 'png' | 'jpeg' | 'gif' | 'webp' | 'executable' | 'script' | 'unknown';

// Signatures deliberately kept to what this app's own upload flows actually claim to accept
// (pdf/image, per DocumentFileType) plus the two dangerous binary formats worth blocking
// unconditionally regardless of what's ever declared. This is not a general-purpose file-type
// sniffing library — just enough to close the "arbitrary executable/script upload" hole.
const MAGIC_BYTE_SIGNATURES: ReadonlyArray<{
  kind: DetectedFileKind;
  bytes: readonly number[];
}> = [
  { kind: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { kind: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { kind: 'jpeg', bytes: [0xff, 0xd8, 0xff] },
  { kind: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { kind: 'executable', bytes: [0x4d, 0x5a] }, // MZ — Windows PE (.exe/.dll)
  { kind: 'executable', bytes: [0x7f, 0x45, 0x4c, 0x46] }, // ELF — Linux binaries
];

// A leading-slice text sniff for script/markup content, mirroring (loosely) the class of check
// browsers themselves run before deciding whether to render a same-origin response as HTML —
// exactly the risk "served from a separate cookie-less domain" (docs/04 §4.8) exists to contain.
// This app serves every download as `application/octet-stream` regardless (notes.controller.ts,
// assignments.controller.ts) which already blocks a browser from rendering it inline; this check
// is the write-side half of the same defense — reject the content outright rather than rely on
// the read-side header alone.
const SCRIPT_LIKE_PREFIXES = ['<!doctype html', '<html', '<script', '#!'];

export function detectFileKind(buffer: Buffer): DetectedFileKind {
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  for (const signature of MAGIC_BYTE_SIGNATURES) {
    if (
      buffer.length >= signature.bytes.length &&
      signature.bytes.every((byte, index) => buffer[index] === byte)
    ) {
      return signature.kind;
    }
  }
  const head = buffer
    .subarray(0, 512)
    .toString('utf8')
    .trimStart()
    .toLowerCase();
  if (SCRIPT_LIKE_PREFIXES.some((prefix) => head.startsWith(prefix))) {
    return 'script';
  }
  return 'unknown';
}

const DANGEROUS_KINDS: ReadonlySet<DetectedFileKind> = new Set([
  'executable',
  'script',
]);

/** Blanket check applied to every upload through `StorageAdapter.writeObject`, regardless of the
 * (if any) declared type — an executable or an HTML/script payload is never a legitimate upload
 * anywhere in this app. */
export function isDangerousUpload(buffer: Buffer): boolean {
  return DANGEROUS_KINDS.has(detectFileKind(buffer));
}

// Only Notes' `DocumentFileType` ('pdf' | 'image' | ...) is a real declared-type field checkable
// against a magic-byte family — Assignments' attachments have no per-entry type discriminator at
// all (assignment.entity.ts's own header comment explains why), so there is nothing to
// cross-check there beyond the blanket dangerous-kind reject above. 'video'/'audio'/'other' have
// no single checkable signature family worth enumerating for this pass, so they get no positive
// check either — the dangerous-kind reject is still the real backstop for those.
const DECLARED_TYPE_SIGNATURES: Readonly<
  Record<string, readonly DetectedFileKind[]>
> = {
  pdf: ['pdf'],
  image: ['png', 'jpeg', 'gif', 'webp'],
};

export function matchesDeclaredFileType(
  buffer: Buffer,
  declaredType: string,
): boolean {
  const allowedKinds = DECLARED_TYPE_SIGNATURES[declaredType];
  if (!allowedKinds) return true; // no positive signature family defined for this type — see above
  return allowedKinds.includes(detectFileKind(buffer));
}
