import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Institute } from './entities/institute.entity';

@Injectable()
export class InstitutesService {
  constructor(
    @InjectRepository(Institute)
    private readonly instituteRepo: Repository<Institute>,
  ) {}

  create(data: Partial<Institute>): Promise<Institute> {
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

  async update(id: string, data: Partial<Institute>): Promise<Institute> {
    await this.findById(id); // 404s before attempting the update
    await this.instituteRepo.update(id, data);
    return this.findById(id);
  }

  // Soft delete only — docs/01 §1.3, §1.5: institutes carry financial/enrollment history.
  async archive(id: string): Promise<void> {
    await this.findById(id);
    await this.instituteRepo.softDelete(id);
  }
}
