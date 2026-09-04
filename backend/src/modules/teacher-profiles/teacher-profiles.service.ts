import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherCategory } from './entities/teacher-category.entity';
import { TeacherProfile } from './entities/teacher-profile.entity';
import {
  VerificationRequest,
  VerificationRequestStatus,
} from './entities/verification-request.entity';
import { VerificationStatus } from './entities/teacher-profile.entity';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class TeacherProfilesService {
  constructor(
    @InjectRepository(TeacherCategory)
    private readonly categoryRepo: Repository<TeacherCategory>,
    @InjectRepository(TeacherProfile)
    private readonly profileRepo: Repository<TeacherProfile>,
    @InjectRepository(VerificationRequest)
    private readonly verificationRepo: Repository<VerificationRequest>,
  ) {}

  // Public (docs/04 §4.4 "GET /teacher-categories — public, drives onboarding UI").
  listCategories(): Promise<TeacherCategory[]> {
    return this.categoryRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async createProfile(
    userId: string,
    dto: CreateTeacherProfileDto,
  ): Promise<TeacherProfile> {
    const existing = await this.profileRepo.findOne({
      where: { user: { id: userId } },
    });
    if (existing) {
      throw new ConflictException({
        code: 'TEACHER_PROFILE_ALREADY_EXISTS',
        message: 'This account already has a teacher profile',
      });
    }

    const category = await this.findActiveCategoryOrThrow(
      dto.teacherCategoryId,
    );

    const profile = this.profileRepo.create({
      user: { id: userId } as User,
      teacherCategory: category,
      headline: dto.headline,
      bio: dto.bio,
      experienceYears: dto.experienceYears,
      serviceArea: dto.serviceArea,
      teachingMode: dto.teachingMode,
      subjectsOrSkills: dto.subjectsOrSkills ?? [],
      classDurationMinutesDefault: dto.classDurationMinutesDefault,
    });
    return this.profileRepo.save(profile);
  }

  async findById(id: string): Promise<TeacherProfile> {
    // docs/04 §4.8 — this profile is returned straight to the client by the controller (GET,
    // PATCH, and verification-request all funnel through this method), so the `user` relation is
    // select-restricted to just `id` here. Loading the full related User (and therefore its
    // passwordHash) would mean it rides along in the JSON response the moment TypeORM's default
    // serialization stringifies whatever `assertOwnership` needed loaded — a nested `select`
    // means passwordHash is never fetched at all, not just "trusted not to be serialized."
    const profile = await this.profileRepo.findOne({
      where: { id },
      relations: { user: true },
      select: {
        id: true,
        headline: true,
        bio: true,
        experienceYears: true,
        qualifications: true,
        serviceArea: true,
        teachingMode: true,
        subjectsOrSkills: true,
        classDurationMinutesDefault: true,
        verificationStatus: true,
        ratingAvg: true,
        ratingCount: true,
        createdAt: true,
        updatedAt: true,
        user: { id: true },
      },
    });
    if (!profile) {
      throw new NotFoundException({
        code: 'TEACHER_PROFILE_NOT_FOUND',
        message: `Teacher profile ${id} not found`,
      });
    }
    return profile;
  }

  async findByUserId(userId: string): Promise<TeacherProfile | null> {
    return this.profileRepo.findOne({ where: { user: { id: userId } } });
  }

  async update(
    id: string,
    requesterId: string,
    dto: UpdateTeacherProfileDto,
  ): Promise<TeacherProfile> {
    const profile = await this.findById(id);
    this.assertOwnership(profile, requesterId);

    if (dto.teacherCategoryId) {
      profile.teacherCategory = await this.findActiveCategoryOrThrow(
        dto.teacherCategoryId,
      );
    }
    Object.assign(profile, {
      headline: dto.headline ?? profile.headline,
      bio: dto.bio ?? profile.bio,
      experienceYears: dto.experienceYears ?? profile.experienceYears,
      serviceArea: dto.serviceArea ?? profile.serviceArea,
      teachingMode: dto.teachingMode ?? profile.teachingMode,
      subjectsOrSkills: dto.subjectsOrSkills ?? profile.subjectsOrSkills,
      classDurationMinutesDefault:
        dto.classDurationMinutesDefault ?? profile.classDurationMinutesDefault,
    });
    return this.profileRepo.save(profile);
  }

  async submitVerificationRequest(
    id: string,
    requesterId: string,
    dto: SubmitVerificationDto,
  ): Promise<VerificationRequest> {
    const profile = await this.findById(id);
    this.assertOwnership(profile, requesterId);

    const request = this.verificationRepo.create({
      teacherProfile: profile,
      documentUrls: dto.documentUrls,
      status: VerificationRequestStatus.PENDING,
    });
    await this.verificationRepo.save(request);

    // docs/01 §1.2 point 6 — verification status flips to 'pending' immediately; an admin
    // review (docs/07 Phase 5/6) later moves it to 'verified'/back to 'unverified' on rejection.
    profile.verificationStatus = VerificationStatus.PENDING;
    await this.profileRepo.save(profile);

    return request;
  }

  private async findActiveCategoryOrThrow(
    categoryId: string,
  ): Promise<TeacherCategory> {
    const category = await this.categoryRepo.findOne({
      where: { id: categoryId, isActive: true },
    });
    if (!category) {
      throw new NotFoundException({
        code: 'TEACHER_CATEGORY_NOT_FOUND',
        message: `Teacher category ${categoryId} not found or inactive`,
      });
    }
    return category;
  }

  // docs/04 §4.5 — resource-level scoping on top of the role-level PermissionsGuard check.
  // TODO(docs/06 §6.3-style exception): once institutes can manage their teachers' profiles,
  // this also needs to allow an institute_admin whose institute matches profile.institute.
  private assertOwnership(profile: TeacherProfile, requesterId: string): void {
    if (profile.user.id !== requesterId) {
      throw new ForbiddenException({
        code: 'NOT_PROFILE_OWNER',
        message: 'You can only manage your own teacher profile',
      });
    }
  }
}
