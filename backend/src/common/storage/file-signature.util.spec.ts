import {
  detectFileKind,
  isDangerousUpload,
  matchesDeclaredFileType,
} from './file-signature.util';

describe('detectFileKind', () => {
  it('recognizes a PDF by its %PDF magic bytes', () => {
    expect(detectFileKind(Buffer.from('%PDF-1.4 rest of file'))).toBe('pdf');
  });

  it('recognizes a PNG by its magic bytes', () => {
    expect(
      detectFileKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])),
    ).toBe('png');
  });

  it('recognizes a JPEG by its magic bytes', () => {
    expect(detectFileKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
  });

  it('recognizes a WEBP by its RIFF/WEBP container', () => {
    const buf = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WEBP'),
    ]);
    expect(detectFileKind(buf)).toBe('webp');
  });

  it('recognizes a Windows PE executable by its MZ header', () => {
    expect(detectFileKind(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBe(
      'executable',
    );
  });

  it('recognizes an ELF executable', () => {
    expect(detectFileKind(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))).toBe(
      'executable',
    );
  });

  it('recognizes an HTML payload by its leading tag, case-insensitively', () => {
    expect(
      detectFileKind(Buffer.from('<!DOCTYPE html><script>alert(1)</script>')),
    ).toBe('script');
  });

  it('recognizes a shebang script', () => {
    expect(detectFileKind(Buffer.from('#!/bin/sh\nrm -rf /'))).toBe('script');
  });

  it('returns "unknown" for plain unrecognized bytes', () => {
    expect(detectFileKind(Buffer.from('just some plain text notes'))).toBe(
      'unknown',
    );
  });
});

describe('isDangerousUpload', () => {
  it('flags an executable as dangerous', () => {
    expect(isDangerousUpload(Buffer.from([0x4d, 0x5a]))).toBe(true);
  });

  it('flags an HTML/script payload as dangerous', () => {
    expect(
      isDangerousUpload(Buffer.from('<script>document.cookie</script>')),
    ).toBe(true);
  });

  it('does not flag a real PDF', () => {
    expect(isDangerousUpload(Buffer.from('%PDF-1.4'))).toBe(false);
  });

  it('does not flag a real PNG', () => {
    expect(isDangerousUpload(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(
      false,
    );
  });
});

describe('matchesDeclaredFileType', () => {
  it('accepts a real PDF declared as pdf', () => {
    expect(matchesDeclaredFileType(Buffer.from('%PDF-1.4'), 'pdf')).toBe(true);
  });

  it('rejects an HTML payload declared as pdf', () => {
    expect(
      matchesDeclaredFileType(
        Buffer.from('<html><body>fake</body></html>'),
        'pdf',
      ),
    ).toBe(false);
  });

  it('accepts any of the image signature family declared as image', () => {
    expect(
      matchesDeclaredFileType(Buffer.from([0xff, 0xd8, 0xff]), 'image'),
    ).toBe(true);
    expect(
      matchesDeclaredFileType(Buffer.from([0x47, 0x49, 0x46, 0x38]), 'image'),
    ).toBe(true);
  });

  it('rejects a PDF declared as image', () => {
    expect(matchesDeclaredFileType(Buffer.from('%PDF-1.4'), 'image')).toBe(
      false,
    );
  });

  it('has no positive check for a declared type outside the checkable family (e.g. video)', () => {
    expect(
      matchesDeclaredFileType(Buffer.from('anything at all'), 'video'),
    ).toBe(true);
  });
});
