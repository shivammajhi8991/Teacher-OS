import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnnouncementsService } from './announcements.service';
import {
  Announcement,
  AnnouncementTargetType,
} from './entities/announcement.entity';
import { Class } from '../classes/entities/class.entity';
import { Enrollment } from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/03 §3.8 / docs/06 §6.2 "Announcements" — each role's own "send" scope (teacher: a class
// they teach, institute_admin: their own institute, super_admin: platform-wide) plus the shared
// "read" resolution every non-super_admin role goes through (getRelevantTargets).
describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  const announcementRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) =>
      Promise.resolve({ id: 'announcement-1', createdAt: new Date(), ...d }),
    ),
    find: jest.fn().mockResolvedValue([]),
  };
  const classRepo = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };
  const enrollmentRepo = { find: jest.fn().mockResolvedValue([]) };
  const studentRepo = { findOne: jest.fn() };
  const guardianLinkRepo = { find: jest.fn().mockResolvedValue([]) };
  const teacherProfilesService = { findByUserId: jest.fn() };

  const superAdmin: AuthenticatedUser = {
    userId: 'user-super',
    activeRole: 'super_admin',
    instituteId: null,
  };
  const instituteAdmin: AuthenticatedUser = {
    userId: 'user-admin',
    activeRole: 'institute_admin',
    instituteId: 'institute-1',
  };
  const teacherUser: AuthenticatedUser = {
    userId: 'user-teacher',
    activeRole: 'teacher',
    instituteId: null,
  };
  const studentUser: AuthenticatedUser = {
    userId: 'user-student',
    activeRole: 'student',
    instituteId: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    announcementRepo.find.mockResolvedValue([]);
    classRepo.find.mockResolvedValue([]);
    enrollmentRepo.find.mockResolvedValue([]);
    guardianLinkRepo.find.mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        {
          provide: getRepositoryToken(Announcement),
          useValue: announcementRepo,
        },
        { provide: getRepositoryToken(Class), useValue: classRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(StudentProfile), useValue: studentRepo },
        {
          provide: getRepositoryToken(StudentGuardianLink),
          useValue: guardianLinkRepo,
        },
        { provide: TeacherProfilesService, useValue: teacherProfilesService },
      ],
    }).compile();
    service = module.get(AnnouncementsService);
  });

  describe('createAnnouncement', () => {
    it('rejects a super_admin trying to send a non-platform announcement', async () => {
      await expect(
        service.createAnnouncement(superAdmin, {
          targetType: AnnouncementTargetType.INSTITUTE,
          title: 'Hi',
          body: 'Body',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a super_admin to send a platform-wide announcement', async () => {
      const summary = await service.createAnnouncement(superAdmin, {
        targetType: AnnouncementTargetType.PLATFORM,
        title: 'Maintenance',
        body: 'Scheduled downtime tonight',
      });
      expect(announcementRepo.save).toHaveBeenCalled();
      expect(summary.targetType).toBe(AnnouncementTargetType.PLATFORM);
    });

    it('rejects an institute_admin sending to a different institute', async () => {
      await expect(
        service.createAnnouncement(instituteAdmin, {
          targetType: AnnouncementTargetType.INSTITUTE,
          targetId: 'institute-2',
          title: 'Hi',
          body: 'Body',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an institute_admin to send to their own institute', async () => {
      const summary = await service.createAnnouncement(instituteAdmin, {
        targetType: AnnouncementTargetType.INSTITUTE,
        title: 'Holiday notice',
        body: 'Closed Friday',
      });
      expect(summary.targetId).toBe('institute-1');
    });

    it("requires a targetId for a teacher's class-targeted announcement", async () => {
      await expect(
        service.createAnnouncement(teacherUser, {
          targetType: AnnouncementTargetType.CLASS,
          title: 'Hi',
          body: 'Body',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a teacher sending to a class they don't teach", async () => {
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      classRepo.findOne.mockResolvedValue({
        id: 'class-1',
        teacherProfile: { id: 'teacher-profile-other' },
      });
      await expect(
        service.createAnnouncement(teacherUser, {
          targetType: AnnouncementTargetType.CLASS,
          targetId: 'class-1',
          title: 'Hi',
          body: 'Body',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a teacher to announce to a class they teach', async () => {
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'teacher-profile-1',
      });
      classRepo.findOne.mockResolvedValue({
        id: 'class-1',
        teacherProfile: { id: 'teacher-profile-1' },
      });
      const summary = await service.createAnnouncement(teacherUser, {
        targetType: AnnouncementTargetType.CLASS,
        targetId: 'class-1',
        title: 'Homework',
        body: 'Chapter 4 due Monday',
      });
      expect(summary.targetId).toBe('class-1');
    });

    it('rejects a student — read-only role', async () => {
      await expect(
        service.createAnnouncement(studentUser, {
          targetType: AnnouncementTargetType.CLASS,
          targetId: 'class-1',
          title: 'Hi',
          body: 'Body',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listAnnouncements', () => {
    it('lists everything for a super_admin, unscoped', async () => {
      await service.listAnnouncements(superAdmin);
      expect(announcementRepo.find).toHaveBeenCalledWith(
        expect.not.objectContaining({ where: expect.anything() }),
      );
    });

    it("scopes an institute_admin's listing to platform + their institute + their classes", async () => {
      classRepo.find.mockResolvedValue([{ id: 'class-1' }, { id: 'class-2' }]);
      await service.listAnnouncements(instituteAdmin);
      const call = announcementRepo.find.mock.calls[0][0];
      expect(call.where).toEqual(
        expect.arrayContaining([
          {
            targetType: AnnouncementTargetType.INSTITUTE,
            targetId: 'institute-1',
          },
          { targetType: AnnouncementTargetType.CLASS, targetId: 'class-1' },
          { targetType: AnnouncementTargetType.CLASS, targetId: 'class-2' },
        ]),
      );
    });
  });
});
