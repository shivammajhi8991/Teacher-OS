import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Institute } from './entities/institute.entity';
import { Branch } from './entities/branch.entity';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class InstitutesService {
  constructor(
    @InjectRepository(Institute)
    private readonly instituteRepo: Repository<Institute>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
  ) {}

  // docs/06 §6.2 "Institution management | – | – | – | F (own institute) | F" — only
  // super_admin creates a brand-new institute; an institute_admin managing their own institute
  // is a separate, narrower grant (update/archive below), not "create more institutes."
  // Previously this was gated by role-level 'institute.manage' alone (both institute_admin and
  // super_admin hold it), which meant an institute_admin could call this too — fixed here rather
  // than left as the "documented follow-up" this controller's own comment used to flag.
  create(
    requester: AuthenticatedUser,
    data: Partial<Institute>,
  ): Promise<Institute> {
    if (requester.activeRole !== 'super_admin') {
      throw new ForbiddenException({
        code: 'SUPER_ADMIN_ONLY',
        message: 'Only a super_admin can create a new institute',
      });
    }
    return this.instituteRepo.save(this.instituteRepo.create(data));
  }

  findAll(): Promise<Institute[]> {
    return this.instituteRepo.find();
  }

  async findById(id: string): Promise<Institute> {
    const institute = await this.instituteRepo.findOne({ where: { id } });
    if (!institute) {
      throw new NotFoundException({
        code: 'INSTITUTE_NOT_FOUND',
        message: `Institute ${id} not found`,
      });
    }
    return institute;
  }

  async update(
    id: string,
    requester: AuthenticatedUser,
    data: Partial<Institute>,
  ): Promise<Institute> {
    await this.findById(id); // 404s before attempting the update
    this.assertWriteAccess(id, requester);
    await this.instituteRepo.update(id, data);
    return this.findById(id);
  }

  // Soft delete only — docs/01 §1.3, §1.5: institutes carry financial/enrollment history.
  async archive(id: string, requester: AuthenticatedUser): Promise<void> {
    await this.findById(id);
    this.assertWriteAccess(id, requester);
    await this.instituteRepo.softDelete(id);
  }

  private assertWriteAccess(
    instituteId: string,
    requester: AuthenticatedUser,
  ): void {
    if (requester.activeRole === 'super_admin') return;
    if (
      requester.activeRole === 'institute_admin' &&
      requester.instituteId === instituteId
    ) {
      return;
    }
    throw new ForbiddenException({
      code: 'NOT_AUTHORIZED_FOR_INSTITUTE',
      message: 'You do not have permission to manage this institute',
    });
  }

  // ---------------------------------------------------------------- Branches -------------------

  // docs/01 §1.3 "multi-tenant hierarchy (Institute → Branch → Teacher)." The Branch entity and
  // its migration existed since Phase 4 step 1; this is the first pass to actually expose CRUD
  // for it. Nothing else in this codebase references a branch yet (Class/TeacherProfile scope by
  // institute only) — real, but intentionally not retrofitted into every other module's
  // scoping in this pass, a documented scope boundary rather than an oversight.
  async createBranch(
    instituteId: string,
    requester: AuthenticatedUser,
    dto: CreateBranchDto,
  ): Promise<Branch> {
    const institute = await this.findById(instituteId);
    this.assertWriteAccess(instituteId, requester);
    return this.branchRepo.save(
      this.branchRepo.create({
        institute,
        name: dto.name,
        address: dto.address,
        timezone: dto.timezone ?? 'UTC',
      }),
    );
  }

  async listBranches(
    instituteId: string,
    requester: AuthenticatedUser,
  ): Promise<Branch[]> {
    await this.findById(instituteId);
    this.assertReadAccess(instituteId, requester);
    return this.branchRepo.find({
      where: { institute: { id: instituteId } },
      order: { name: 'ASC' },
    });
  }

  async updateBranch(
    branchId: string,
    requester: AuthenticatedUser,
    dto: UpdateBranchDto,
  ): Promise<Branch> {
    const branch = await this.getBranchOrThrow(branchId);
    this.assertWriteAccess(branch.institute.id, requester);
    await this.branchRepo.update(branchId, dto);
    return this.getBranchOrThrow(branchId);
  }

  async archiveBranch(
    branchId: string,
    requester: AuthenticatedUser,
  ): Promise<void> {
    const branch = await this.getBranchOrThrow(branchId);
    this.assertWriteAccess(branch.institute.id, requester);
    await this.branchRepo.softDelete(branchId);
  }

  private async getBranchOrThrow(branchId: string): Promise<Branch> {
    const branch = await this.branchRepo.findOne({
      where: { id: branchId },
      relations: { institute: true },
    });
    if (!branch) {
      throw new NotFoundException({
        code: 'BRANCH_NOT_FOUND',
        message: `Branch ${branchId} not found`,
      });
    }
    return branch;
  }

  private assertReadAccess(
    instituteId: string,
    requester: AuthenticatedUser,
  ): void {
    if (requester.activeRole === 'super_admin') return;
    if (
      requester.activeRole === 'institute_admin' &&
      requester.instituteId === instituteId
    ) {
      return;
    }
    throw new ForbiddenException({
      code: 'NOT_AUTHORIZED_FOR_INSTITUTE',
      message: 'You do not have permission to view this institute',
    });
  }
}
