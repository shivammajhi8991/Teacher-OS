import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  GoneException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotesService } from './notes.service';
import { Document, DocumentFileType } from './entities/document.entity';
import {
  DocumentShare,
  ShareTargetType,
} from './entities/document-share.entity';
import { DocumentAccessLog } from './entities/document-access-log.entity';
import { Class } from '../classes/entities/class.entity';
import { Enrollment } from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from '../students/entities/student-teacher-assignment.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { NotificationsService } from '../notifications/notifications.service';
import { STORAGE_ADAPTER } from './storage/storage.adapter';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/03 §3.8 (notes half) — the access-resolution matrix is the interesting logic here: a
// document is readable/downloadable through ownership, institute-admin scope, or one of three
// share-target kinds (student/class/institute), each with its own resolution path, plus the
// allowDownload gate and expiry check that sit in front of the actual file bytes.
describe('NotesService', () => {
  let service: NotesService;
  const documentRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'doc-1', ...d })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
  const shareRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'share-1', ...d })),
    find: jest.fn().mockResolvedValue([]),
  };
  const accessLogRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve(d)),
  };
  const classRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
  const enrollmentRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const studentRepo = { findOne: jest.fn().mockResolvedValue(null) };
  const guardianLinkRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const assignmentRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const teacherProfilesService = {
    findByUserId: jest.fn().mockResolvedValue(null),
  };
  const notificationsService = {
    notify: jest.fn().mockResolvedValue(undefined),
  };
  const storage = {
    createPresignedUpload: jest.fn(),
    objectExists: jest.fn(),
    readObject: jest.fn(),
    writeObject: jest.fn(),
    deleteObject: jest.fn(),
  };

  const owner: AuthenticatedUser = {
    userId: 'user-owner',
    activeRole: 'teacher',
    instituteId: null,
  };
  const stranger: AuthenticatedUser = {
    userId: 'user-stranger',
    activeRole: 'student',
    instituteId: null,
  };

  const baseDocument = {
    id: 'doc-1',
    title: 'Lesson notes',
    fileUrl: 'obj-key-1',
    fileType: DocumentFileType.PDF,
    version: 1,
    uploadedBy: { id: owner.userId },
    institute: null,
    expiryDate: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: getRepositoryToken(Document), useValue: documentRepo },
        { provide: getRepositoryToken(DocumentShare), useValue: shareRepo },
        {
          provide: getRepositoryToken(DocumentAccessLog),
          useValue: accessLogRepo,
        },
        { provide: getRepositoryToken(Class), useValue: classRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(StudentProfile), useValue: studentRepo },
        {
          provide: getRepositoryToken(StudentGuardianLink),
          useValue: guardianLinkRepo,
        },
        {
          provide: getRepositoryToken(StudentTeacherAssignment),
          useValue: assignmentRepo,
        },
        { provide: TeacherProfilesService, useValue: teacherProfilesService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: STORAGE_ADAPTER, useValue: storage },
      ],
    }).compile();

    service = module.get(NotesService);

    // Safe defaults — jest.clearAllMocks() drops call history but not a mock's last-set
    // resolved value, so every test below only overrides what it actually needs.
    documentRepo.findOne.mockResolvedValue(baseDocument);
    shareRepo.find.mockResolvedValue([]);
    studentRepo.findOne.mockResolvedValue(null);
    guardianLinkRepo.findOne.mockResolvedValue(null);
    assignmentRepo.findOne.mockResolvedValue(null);
    enrollmentRepo.findOne.mockResolvedValue(null);
    teacherProfilesService.findByUserId.mockResolvedValue(null);
    storage.objectExists.mockResolvedValue(true);
  });

  describe('createDocument', () => {
    it("rejects fileType 'link' with no externalUrl", async () => {
      await expect(
        service.createDocument(owner, {
          title: 'x',
          fileType: DocumentFileType.LINK,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(documentRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a non-link document with no objectKey', async () => {
      await expect(
        service.createDocument(owner, {
          title: 'x',
          fileType: DocumentFileType.PDF,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an objectKey that was never actually uploaded', async () => {
      storage.objectExists.mockResolvedValue(false);
      await expect(
        service.createDocument(owner, {
          title: 'x',
          fileType: DocumentFileType.PDF,
          objectKey: 'never-uploaded',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects versioning a document you do not own', async () => {
      documentRepo.findOne.mockResolvedValue({
        ...baseDocument,
        uploadedBy: { id: 'someone-else' },
      });

      await expect(
        service.createDocument(owner, {
          title: 'v2',
          fileType: DocumentFileType.PDF,
          objectKey: 'obj-key-2',
          previousVersionId: 'doc-1',
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(documentRepo.save).not.toHaveBeenCalled();
    });

    it('increments the version when versioning your own document', async () => {
      documentRepo.findOne.mockResolvedValue({
        ...baseDocument,
        version: 2,
        uploadedBy: { id: owner.userId },
      });

      await service.createDocument(owner, {
        title: 'v3',
        fileType: DocumentFileType.PDF,
        objectKey: 'obj-key-3',
        previousVersionId: 'doc-1',
      } as any);

      expect(documentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ version: 3 }),
      );
    });
  });

  describe('getDocument — access resolution', () => {
    it('grants access to the uploader', async () => {
      await expect(service.getDocument('doc-1', owner)).resolves.toBeDefined();
    });

    it('denies a stranger with no matching share', async () => {
      await expect(
        service.getDocument('doc-1', stranger),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('grants access via an INSTITUTE share matching the requester institute', async () => {
      shareRepo.find.mockResolvedValue([
        {
          sharedWithType: ShareTargetType.INSTITUTE,
          sharedWithId: 'inst-1',
          allowDownload: true,
        },
      ]);
      const requester = { ...stranger, instituteId: 'inst-1' };

      await expect(
        service.getDocument('doc-1', requester),
      ).resolves.toBeDefined();
    });

    it('grants access via a STUDENT share when the requester is that student', async () => {
      shareRepo.find.mockResolvedValue([
        {
          sharedWithType: ShareTargetType.STUDENT,
          sharedWithId: 'student-1',
          allowDownload: true,
        },
      ]);
      studentRepo.findOne.mockResolvedValue({
        id: 'student-1',
        user: { id: stranger.userId },
      });

      await expect(
        service.getDocument('doc-1', stranger),
      ).resolves.toBeDefined();
    });

    it('grants access via a STUDENT share when the requester is a linked guardian', async () => {
      shareRepo.find.mockResolvedValue([
        {
          sharedWithType: ShareTargetType.STUDENT,
          sharedWithId: 'student-1',
          allowDownload: true,
        },
      ]);
      studentRepo.findOne.mockResolvedValue({
        id: 'student-1',
        user: { id: 'the-student' },
      });
      guardianLinkRepo.findOne.mockResolvedValue({ id: 'link-1' });

      await expect(
        service.getDocument('doc-1', stranger),
      ).resolves.toBeDefined();
    });

    it('grants access via a CLASS share when the requester is enrolled', async () => {
      shareRepo.find.mockResolvedValue([
        {
          sharedWithType: ShareTargetType.CLASS,
          sharedWithId: 'class-1',
          allowDownload: true,
        },
      ]);
      classRepo.findOne.mockResolvedValue({
        id: 'class-1',
        teacherProfile: { id: 'someone-elses-teacher-profile' },
      });
      enrollmentRepo.findOne.mockResolvedValue({ id: 'enr-1' });

      await expect(
        service.getDocument('doc-1', stranger),
      ).resolves.toBeDefined();
    });

    it('grants access via a CLASS share when the requester is the assigned teacher', async () => {
      shareRepo.find.mockResolvedValue([
        {
          sharedWithType: ShareTargetType.CLASS,
          sharedWithId: 'class-1',
          allowDownload: true,
        },
      ]);
      classRepo.findOne.mockResolvedValue({
        id: 'class-1',
        teacherProfile: { id: 'teacher-profile-1' },
      });
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });

      await expect(
        service.getDocument('doc-1', stranger),
      ).resolves.toBeDefined();
    });
  });

  describe('getFileContent — download gating', () => {
    it('denies download when the only share sets allowDownload=false, even though read is granted', async () => {
      shareRepo.find.mockResolvedValue([
        {
          sharedWithType: ShareTargetType.STUDENT,
          sharedWithId: 'student-1',
          allowDownload: false,
        },
      ]);
      studentRepo.findOne.mockResolvedValue({
        id: 'student-1',
        user: { id: stranger.userId },
      });

      // Read access is granted (a share of any kind is enough) ...
      await expect(
        service.getDocument('doc-1', stranger),
      ).resolves.toBeDefined();
      // ... but download access is not, because this specific share disallows it.
      await expect(
        service.getFileContent('doc-1', stranger),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.readObject).not.toHaveBeenCalled();
    });

    it('rejects an expired document with GoneException', async () => {
      documentRepo.findOne.mockResolvedValue({
        ...baseDocument,
        expiryDate: new Date('2000-01-01'),
      });

      await expect(
        service.getFileContent('doc-1', owner),
      ).rejects.toBeInstanceOf(GoneException);
      expect(accessLogRepo.save).not.toHaveBeenCalled();
    });

    it('logs the access and returns the stored bytes for a non-expired, downloadable document', async () => {
      storage.readObject.mockResolvedValue(Buffer.from('file bytes'));

      const result = await service.getFileContent('doc-1', owner);

      expect(result).toEqual({
        kind: 'buffer',
        buffer: Buffer.from('file bytes'),
      });
      expect(accessLogRepo.save).toHaveBeenCalled();
    });

    it('redirects instead of reading storage for a LINK document', async () => {
      documentRepo.findOne.mockResolvedValue({
        ...baseDocument,
        fileType: DocumentFileType.LINK,
        fileUrl: 'https://example.com/resource',
      });

      const result = await service.getFileContent('doc-1', owner);

      expect(result).toEqual({
        kind: 'redirect',
        redirectUrl: 'https://example.com/resource',
      });
      expect(storage.readObject).not.toHaveBeenCalled();
    });
  });

  describe('createShare', () => {
    it('rejects a share request from someone without write access to the document', async () => {
      await expect(
        service.createShare('doc-1', stranger, {
          sharedWithType: ShareTargetType.INSTITUTE,
          sharedWithId: 'inst-1',
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(shareRepo.save).not.toHaveBeenCalled();
    });

    it('rejects sharing to a student id that does not exist', async () => {
      studentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createShare('doc-1', owner, {
          sharedWithType: ShareTargetType.STUDENT,
          sharedWithId: 'no-such-student',
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
