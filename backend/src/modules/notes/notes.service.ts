import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { Document, DocumentFileType } from './entities/document.entity';
import {
  DocumentShare,
  ShareTargetType,
} from './entities/document-share.entity';
import {
  DocumentAccessLog,
  DocumentAccessAction,
} from './entities/document-access-log.entity';
import { Class } from '../classes/entities/class.entity';
import { Institute } from '../institutes/entities/institute.entity';
import {
  Enrollment,
  EnrollmentEntryStatus,
} from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from '../students/entities/student-teacher-assignment.entity';
import { User } from '../users/entities/user.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateDocumentShareDto } from './dto/create-document-share.dto';
import {
  STORAGE_ADAPTER,
  StorageAdapter,
} from '../../common/storage/storage.adapter';

export interface DocumentSummary {
  id: string;
  title: string;
  fileType: DocumentFileType;
  folderName?: string;
  expiryDate: Date | null;
  version: number;
  isExpired: boolean;
  createdAt: Date;
  // Only populated for fileType === 'link' — the whole point of a link share is the destination
  // URL, so exposing it directly here saves a client the redirect round-trip that
  // GET /documents/:id/file otherwise requires just to read it back.
  externalUrl?: string;
}

export interface FileContent {
  kind: 'redirect' | 'buffer';
  redirectUrl?: string;
  buffer?: Buffer;
}

type ShareTarget = { type: ShareTargetType; id: string };

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentShare)
    private readonly shareRepo: Repository<DocumentShare>,
    @InjectRepository(DocumentAccessLog)
    private readonly accessLogRepo: Repository<DocumentAccessLog>,
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(StudentProfile)
    private readonly studentRepo: Repository<StudentProfile>,
    @InjectRepository(StudentGuardianLink)
    private readonly guardianLinkRepo: Repository<StudentGuardianLink>,
    @InjectRepository(StudentTeacherAssignment)
    private readonly assignmentRepo: Repository<StudentTeacherAssignment>,
    private readonly teacherProfilesService: TeacherProfilesService,
    private readonly notificationsService: NotificationsService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async createUploadUrl(): Promise<{ uploadUrl: string; objectKey: string }> {
    return this.storage.createPresignedUpload('documents');
  }

  // docs/02 §2.6 — the local adapter's upload route lands here too (see notes.controller.ts);
  // this only checks the caller is authenticated (handled by the global guard), not that they
  // were the one who requested this specific objectKey — a real S3 presigned URL enforces that
  // implicitly (the signature itself is the authorization); this local stand-in doesn't model
  // that extra check, which is fine for a single-node dev/local deployment but is a real gap a
  // production local-disk deployment would want closed before going further than this pass.
  async writeUploadedBytes(objectKey: string, data: Buffer): Promise<void> {
    await this.storage.writeObject(objectKey, data);
  }

  async createDocument(
    requester: AuthenticatedUser,
    dto: CreateDocumentDto,
  ): Promise<Document> {
    if (dto.fileType === DocumentFileType.LINK) {
      if (!dto.externalUrl) {
        throw new BadRequestException({
          code: 'EXTERNAL_URL_REQUIRED',
          message: "fileType 'link' requires externalUrl",
        });
      }
    } else if (!dto.objectKey) {
      throw new BadRequestException({
        code: 'OBJECT_KEY_REQUIRED',
        message:
          'Non-link documents require objectKey from POST /documents/upload-url',
      });
    } else if (!(await this.storage.objectExists(dto.objectKey))) {
      throw new BadRequestException({
        code: 'UPLOAD_NOT_FOUND',
        message: 'No uploaded file found for this objectKey — upload it first',
      });
    }

    let previousVersion: Document | null = null;
    let version = 1;
    if (dto.previousVersionId) {
      previousVersion = await this.getRawById(dto.previousVersionId);
      if (previousVersion.uploadedBy.id !== requester.userId) {
        throw new ForbiddenException({
          code: 'NOT_AUTHORIZED_FOR_DOCUMENT',
          message: 'You can only version your own document',
        });
      }
      version = previousVersion.version + 1;
    }

    const document = this.documentRepo.create({
      uploadedBy: { id: requester.userId } as User,
      title: dto.title,
      fileType: dto.fileType,
      fileUrl:
        dto.fileType === DocumentFileType.LINK
          ? dto.externalUrl!
          : dto.objectKey!,
      folderName: dto.folderName,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      version,
      previousVersion,
      institute: requester.instituteId
        ? ({ id: requester.instituteId } as Institute)
        : null,
    });
    return this.documentRepo.save(document);
  }

  async createShare(
    documentId: string,
    requester: AuthenticatedUser,
    dto: CreateDocumentShareDto,
  ): Promise<DocumentShare> {
    const document = await this.getRawById(documentId);
    this.assertWriteAccess(document, requester);
    await this.assertShareTargetExists(dto.sharedWithType, dto.sharedWithId);

    const share = this.shareRepo.create({
      document,
      sharedWithType: dto.sharedWithType,
      sharedWithId: dto.sharedWithId,
      allowDownload: dto.allowDownload ?? true,
    });
    const saved = await this.shareRepo.save(share);

    // Only the STUDENT target resolves to a small, known set of recipients (the student + their
    // guardians) cheaply, in-request. CLASS/INSTITUTE shares can fan out to many people — real
    // fan-out for those belongs on a BullMQ worker per docs/04 §4.7's "bulk notification
    // fan-out is async," not a synchronous loop here — so those two are a documented deferral,
    // not silently skipped.
    if (dto.sharedWithType === ShareTargetType.STUDENT) {
      await this.notifyStudentOfShare(dto.sharedWithId, document);
    }
    return saved;
  }

  async listDocuments(
    requester: AuthenticatedUser,
    filters: { q?: string },
  ): Promise<DocumentSummary[]> {
    let where: FindOptionsWhere<Document> | FindOptionsWhere<Document>[];

    if (requester.activeRole === 'super_admin') {
      where = {};
    } else if (requester.activeRole === 'institute_admin') {
      if (!requester.instituteId) return [];
      where = { institute: { id: requester.instituteId } };
    } else {
      const targets = await this.getRelevantShareTargets(requester);
      const shares = targets.length
        ? await this.shareRepo.find({
            where: targets.map((t) => ({
              sharedWithType: t.type,
              sharedWithId: t.id,
            })),
            relations: { document: true },
          })
        : [];
      const sharedIds = shares.map((s) => s.document.id);

      const ownDocs = await this.documentRepo.find({
        where: { uploadedBy: { id: requester.userId } },
      });
      const allIds = Array.from(
        new Set([...ownDocs.map((d) => d.id), ...sharedIds]),
      );
      if (allIds.length === 0) return [];
      where = { id: In(allIds) };
    }

    if (filters.q) {
      where = Array.isArray(where)
        ? where.map((w) => ({ ...w, title: ILike(`%${filters.q}%`) }))
        : { ...where, title: ILike(`%${filters.q}%`) };
    }

    const documents = await this.documentRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
    return documents.map((d) => this.toSummary(d));
  }

  async getDocument(
    documentId: string,
    requester: AuthenticatedUser,
  ): Promise<DocumentSummary> {
    const document = await this.getRawById(documentId);
    if (!(await this.hasReadAccess(document, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_DOCUMENT',
        message: 'You do not have access to this document',
      });
    }
    return this.toSummary(document);
  }

  async getFileContent(
    documentId: string,
    requester: AuthenticatedUser,
  ): Promise<FileContent> {
    const document = await this.getRawById(documentId);
    if (!(await this.hasDownloadAccess(document, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_DOCUMENT',
        message: 'You do not have download access to this document',
      });
    }
    if (document.expiryDate && document.expiryDate.getTime() < Date.now()) {
      throw new GoneException({
        code: 'DOCUMENT_EXPIRED',
        message: 'This shared content has expired',
      });
    }

    await this.accessLogRepo.save(
      this.accessLogRepo.create({
        document,
        accessedBy: { id: requester.userId } as User,
        action: DocumentAccessAction.DOWNLOAD,
      }),
    );

    if (document.fileType === DocumentFileType.LINK) {
      return { kind: 'redirect', redirectUrl: document.fileUrl };
    }
    return {
      kind: 'buffer',
      buffer: await this.storage.readObject(document.fileUrl),
    };
  }

  // ---------------------------------------------------------------- Access control -----------

  private async getRawById(id: string): Promise<Document> {
    const document = await this.documentRepo.findOne({
      where: { id },
      relations: { uploadedBy: true, institute: true },
      select: {
        id: true,
        title: true,
        fileUrl: true,
        fileType: true,
        folderName: true,
        expiryDate: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: { id: true },
        institute: { id: true },
      },
    });
    if (!document) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: `Document ${id} not found`,
      });
    }
    return document;
  }

  private assertWriteAccess(
    document: Document,
    requester: AuthenticatedUser,
  ): void {
    if (requester.activeRole === 'super_admin') return;
    if (document.uploadedBy.id === requester.userId) return;
    if (
      requester.activeRole === 'institute_admin' &&
      document.institute?.id &&
      document.institute.id === requester.instituteId
    ) {
      return;
    }
    throw new ForbiddenException({
      code: 'NOT_AUTHORIZED_FOR_DOCUMENT',
      message: 'You do not have permission to manage this document',
    });
  }

  private async hasReadAccess(
    document: Document,
    requester: AuthenticatedUser,
  ): Promise<boolean> {
    if (requester.activeRole === 'super_admin') return true;
    if (document.uploadedBy.id === requester.userId) return true;
    if (
      requester.activeRole === 'institute_admin' &&
      document.institute?.id &&
      document.institute.id === requester.instituteId
    ) {
      return true;
    }
    const shares = await this.shareRepo.find({
      where: { document: { id: document.id } },
    });
    for (const share of shares) {
      if (await this.shareGrantsAccess(share, requester)) return true;
    }
    return false;
  }

  private async hasDownloadAccess(
    document: Document,
    requester: AuthenticatedUser,
  ): Promise<boolean> {
    if (requester.activeRole === 'super_admin') return true;
    if (document.uploadedBy.id === requester.userId) return true;
    if (
      requester.activeRole === 'institute_admin' &&
      document.institute?.id &&
      document.institute.id === requester.instituteId
    ) {
      return true;
    }
    const shares = await this.shareRepo.find({
      where: { document: { id: document.id } },
    });
    for (const share of shares) {
      if (
        share.allowDownload &&
        (await this.shareGrantsAccess(share, requester))
      )
        return true;
    }
    return false;
  }

  private async shareGrantsAccess(
    share: DocumentShare,
    requester: AuthenticatedUser,
  ): Promise<boolean> {
    if (share.sharedWithType === ShareTargetType.INSTITUTE) {
      return (
        !!requester.instituteId && requester.instituteId === share.sharedWithId
      );
    }
    if (share.sharedWithType === ShareTargetType.STUDENT) {
      return this.isStudentSelfGuardianOrTeacher(share.sharedWithId, requester);
    }
    if (share.sharedWithType === ShareTargetType.CLASS) {
      return this.hasAccessToClass(share.sharedWithId, requester);
    }
    return false;
  }

  private async isStudentSelfGuardianOrTeacher(
    studentId: string,
    requester: AuthenticatedUser,
  ): Promise<boolean> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: { user: true },
      select: { id: true, user: { id: true } },
    });
    if (!student) return false;
    if (student.user?.id === requester.userId) return true;

    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (teacherProfile) {
      const assignment = await this.assignmentRepo.findOne({
        where: {
          student: { id: studentId },
          teacherProfile: { id: teacherProfile.id },
        },
      });
      if (assignment) return true;
    }

    const guardianLink = await this.guardianLinkRepo.findOne({
      where: {
        student: { id: studentId },
        guardian: { user: { id: requester.userId } },
      },
    });
    return !!guardianLink;
  }

  private async hasAccessToClass(
    classId: string,
    requester: AuthenticatedUser,
  ): Promise<boolean> {
    const cls = await this.classRepo.findOne({
      where: { id: classId },
      relations: { teacherProfile: true },
    });
    if (!cls) return false;

    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (teacherProfile && teacherProfile.id === cls.teacherProfile.id)
      return true;

    const ownEnrollment = await this.enrollmentRepo.findOne({
      where: {
        class: { id: classId },
        student: { user: { id: requester.userId } },
        status: In([EnrollmentEntryStatus.ACTIVE, EnrollmentEntryStatus.TRIAL]),
      },
    });
    if (ownEnrollment) return true;

    const activeEnrollments = await this.enrollmentRepo.find({
      where: {
        class: { id: classId },
        status: In([EnrollmentEntryStatus.ACTIVE, EnrollmentEntryStatus.TRIAL]),
      },
      relations: { student: true },
    });
    for (const enrollment of activeEnrollments) {
      const link = await this.guardianLinkRepo.findOne({
        where: {
          student: { id: enrollment.student.id },
          guardian: { user: { id: requester.userId } },
        },
      });
      if (link) return true;
    }
    return false;
  }

  private async getRelevantShareTargets(
    requester: AuthenticatedUser,
  ): Promise<ShareTarget[]> {
    const targets: ShareTarget[] = [];
    if (requester.instituteId) {
      targets.push({
        type: ShareTargetType.INSTITUTE,
        id: requester.instituteId,
      });
    }

    const student = await this.studentRepo.findOne({
      where: { user: { id: requester.userId } },
    });
    if (student) {
      targets.push({ type: ShareTargetType.STUDENT, id: student.id });
      const ownEnrollments = await this.enrollmentRepo.find({
        where: {
          student: { id: student.id },
          status: In([
            EnrollmentEntryStatus.ACTIVE,
            EnrollmentEntryStatus.TRIAL,
          ]),
        },
        relations: { class: true },
      });
      for (const e of ownEnrollments)
        targets.push({ type: ShareTargetType.CLASS, id: e.class.id });
    }

    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (teacherProfile) {
      const assignments = await this.assignmentRepo.find({
        where: { teacherProfile: { id: teacherProfile.id } },
        relations: { student: true },
      });
      for (const a of assignments)
        targets.push({ type: ShareTargetType.STUDENT, id: a.student.id });

      const classes = await this.classRepo.find({
        where: { teacherProfile: { id: teacherProfile.id } },
      });
      for (const c of classes)
        targets.push({ type: ShareTargetType.CLASS, id: c.id });
    }

    const guardianLinks = await this.guardianLinkRepo.find({
      where: { guardian: { user: { id: requester.userId } } },
      relations: { student: true },
    });
    for (const link of guardianLinks) {
      targets.push({ type: ShareTargetType.STUDENT, id: link.student.id });
      const enrollments = await this.enrollmentRepo.find({
        where: {
          student: { id: link.student.id },
          status: In([
            EnrollmentEntryStatus.ACTIVE,
            EnrollmentEntryStatus.TRIAL,
          ]),
        },
        relations: { class: true },
      });
      for (const e of enrollments)
        targets.push({ type: ShareTargetType.CLASS, id: e.class.id });
    }

    return targets;
  }

  private async assertShareTargetExists(
    type: ShareTargetType,
    id: string,
  ): Promise<void> {
    let exists = false;
    if (type === ShareTargetType.STUDENT) {
      exists = !!(await this.studentRepo.findOne({ where: { id } }));
    } else if (type === ShareTargetType.CLASS) {
      exists = !!(await this.classRepo.findOne({ where: { id } }));
    } else if (type === ShareTargetType.INSTITUTE) {
      exists = true; // institute existence isn't cross-checked here — same tolerance as elsewhere
    }
    if (!exists) {
      throw new BadRequestException({
        code: 'SHARE_TARGET_NOT_FOUND',
        message: `No ${type} found with id ${id}`,
      });
    }
  }

  // docs/01 §1.3 notification digesting example — a shared document is informational, so this
  // defaults to a daily digest, not an immediate push (notifications.constants.ts's
  // DEFAULT_CHANNEL_BY_CATEGORY). Notifies the student's own login (if any, docs/03 §3.4 — a
  // minor may not have one) and every linked guardian's login (if that guardian has one) —
  // duplicated from FeesService.getNotifiableUserIds/notifyStudentParty rather than shared,
  // matching this codebase's established "each module owns its own access/notify resolution"
  // convention (see attendance.service.ts's comment on hasStudentFinanceAccess for the same
  // rationale applied to read-access checks).
  private async notifyStudentOfShare(
    studentId: string,
    document: Document,
  ): Promise<void> {
    const ids = new Set<string>();

    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: { user: true },
      select: { id: true, user: { id: true } },
    });
    if (student?.user?.id) ids.add(student.user.id);

    const guardianLinks = await this.guardianLinkRepo.find({
      where: { student: { id: studentId } },
      relations: { guardian: { user: true } },
      select: { id: true, guardian: { id: true, user: { id: true } } },
    });
    for (const link of guardianLinks) {
      if (link.guardian.user?.id) ids.add(link.guardian.user.id);
    }

    await Promise.all(
      Array.from(ids).map((userId) =>
        this.notificationsService.notify({
          userId,
          type: 'document_shared',
          title: 'New document shared',
          body: document.title,
          data: { documentId: document.id },
        }),
      ),
    );
  }

  private toSummary(document: Document): DocumentSummary {
    return {
      id: document.id,
      title: document.title,
      fileType: document.fileType,
      folderName: document.folderName,
      expiryDate: document.expiryDate ?? null,
      version: document.version,
      isExpired:
        !!document.expiryDate && document.expiryDate.getTime() < Date.now(),
      createdAt: document.createdAt,
      externalUrl:
        document.fileType === DocumentFileType.LINK
          ? document.fileUrl
          : undefined,
    };
  }
}
