import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import type { Response } from 'express';
import { GradeRecord } from './entities/grade-record.entity';
import { PortfolioItem } from './entities/portfolio-item.entity';
import { Scholarship } from './entities/scholarship.entity';
import { User } from '../users/entities/user.entity';
import { UserGroupRole } from '../groups/entities/user-group-role.entity';
import { PortfolioCategory } from './enums/portfolio-category.enum';
import { GradeValue } from './enums/grade-value.enum';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver') as any;

const NUMERIC_GRADES: Partial<Record<GradeValue, number>> = {
  [GradeValue.EXCELLENT]: 5,
  [GradeValue.GOOD]: 4,
  [GradeValue.SATISFACTORY]: 3,
  [GradeValue.UNSATISFACTORY]: 2,
  [GradeValue.ABSENT_EXAM]: 2,
};

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(GradeRecord)
    private gradeRepo: Repository<GradeRecord>,
    @InjectRepository(PortfolioItem)
    private portfolioRepo: Repository<PortfolioItem>,
    @InjectRepository(Scholarship)
    private scholarshipRepo: Repository<Scholarship>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(UserGroupRole)
    private userGroupRoleRepo: Repository<UserGroupRole>,
  ) {}

  async getGrades(
    studentId: string,
    semester?: number,
    academicYear?: string,
  ) {
    const qb = this.gradeRepo
      .createQueryBuilder('gr')
      .leftJoinAndSelect('gr.discipline', 'discipline')
      .where('gr.studentId = :studentId', { studentId });

    if (semester) qb.andWhere('gr.semester = :semester', { semester });
    if (academicYear)
      qb.andWhere('gr.academicYear = :academicYear', { academicYear });

    return qb.orderBy('discipline.name', 'ASC').getMany();
  }

  async getGradesHistory(studentId: string) {
    const records = await this.gradeRepo.find({
      where: { studentId },
      relations: { discipline: true },
      order: { academicYear: 'DESC' },
    });

    // Group by academicYear → semester → records[]
    const grouped: Record<string, Record<number, GradeRecord[]>> = {};
    for (const record of records) {
      if (!grouped[record.academicYear]) grouped[record.academicYear] = {};
      if (!grouped[record.academicYear][record.semester])
        grouped[record.academicYear][record.semester] = [];
      grouped[record.academicYear][record.semester].push(record);
    }
    return grouped;
  }

  async calculateGpa(studentId: string): Promise<number | null> {
    const records = await this.gradeRepo.find({ where: { studentId } });
    const numericValues = records
      .map((r) => NUMERIC_GRADES[r.gradeValue])
      .filter((v): v is number => v !== undefined);

    if (numericValues.length === 0) return null;
    const sum = numericValues.reduce((a, b) => a + b, 0);
    return parseFloat((sum / numericValues.length).toFixed(2));
  }

  async getDebts(studentId: string) {
    return this.gradeRepo.find({
      where: { studentId, isDebt: true },
      relations: { discipline: true },
      order: { academicYear: 'DESC' },
    });
  }

  async getScholarship(studentId: string) {
    const user = await this.userRepo.findOne({ where: { id: studentId } });
    if (!user) throw new NotFoundException('Студент не найден');

    if (user.isPaid) return { isPaid: true, scholarships: [] };

    const scholarships = await this.scholarshipRepo.find({
      where: { studentId, isActive: true },
      order: { createdAt: 'DESC' },
    });
    return { isPaid: false, scholarships };
  }

  async getPortfolio(studentId: string, category?: PortfolioCategory) {
    return this.portfolioRepo.find({
      where: category ? { studentId, category } : { studentId },
      order: { createdAt: 'DESC' },
    });
  }

  async addPortfolioItem(
    studentId: string,
    dto: { title: string; category: PortfolioCategory; description?: string },
    file?: Express.Multer.File,
  ) {
    const item = this.portfolioRepo.create({
      studentId,
      title: dto.title,
      category: dto.category,
      description: dto.description ?? null,
      filePath: file ? file.path.replace(/\\/g, '/') : null,
      fileName: file ? file.originalname : null,
      fileSize: file ? file.size : null,
    });
    return this.portfolioRepo.save(item);
  }

  async downloadPortfolio(
    studentId: string,
    res: Response,
    category?: PortfolioCategory,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<void> {
    const qb = this.portfolioRepo
      .createQueryBuilder('p')
      .where('p.studentId = :studentId', { studentId })
      .andWhere('p.filePath IS NOT NULL');

    if (category) qb.andWhere('p.category = :category', { category });

    if (dateFrom) {
      qb.andWhere('p.createdAt >= :dateFrom', { dateFrom: new Date(dateFrom) });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      qb.andWhere('p.createdAt <= :dateTo', { dateTo: to });
    }

    const items = await qb.orderBy('p.createdAt', 'ASC').getMany();
    const existing = items.filter((i) => i.filePath && fs.existsSync(i.filePath));

    if (existing.length === 0) {
      throw new NotFoundException('Нет файлов по указанным фильтрам');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="portfolio.zip"');

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    // Если несколько файлов с одинаковым именем — добавляем порядковый номер
    const usedNames = new Map<string, number>();
    for (const item of existing) {
      const base = item.fileName || path.basename(item.filePath!);
      const count = usedNames.get(base) ?? 0;
      usedNames.set(base, count + 1);
      const archiveName = count === 0 ? base : `${count + 1}_${base}`;
      archive.file(item.filePath!, { name: archiveName });
    }

    await archive.finalize();
  }

  async deletePortfolioItem(studentId: string, itemId: string) {
    const item = await this.portfolioRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Элемент портфолио не найден');
    if (item.studentId !== studentId) throw new ForbiddenException('Нет доступа');

    if (item.filePath && fs.existsSync(item.filePath)) {
      fs.unlinkSync(item.filePath);
    }
    await this.portfolioRepo.remove(item);
    return { message: 'Удалено' };
  }

  async getProfile(userId: string) {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.groups', 'g')
      .where('u.id = :userId', { userId })
      .getOne();

    if (!user) throw new NotFoundException('Пользователь не найден');

    const { password, ...safe } = user as any;
    return safe;
  }

  async getMyGroup(userId: string) {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.groups', 'g')
      .leftJoinAndSelect('g.members', 'm')
      .where('u.id = :userId', { userId })
      .getOne();

    if (!user) throw new NotFoundException('Пользователь не найден');

    const groupIds = (user.groups ?? []).map((g) => g.id);

    const roleEntries = groupIds.length > 0
      ? await this.userGroupRoleRepo.find({ where: { groupId: In(groupIds) } })
      : [];

    return (user.groups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      year: group.year,
      members: (group.members ?? [])
        .map((member) => {
          const entry = roleEntries.find(
            (r) => r.userId === member.id && r.groupId === group.id,
          );
          return {
            id: member.id,
            fullName: member.fullName,
            groupRole: entry?.label ?? null,
          };
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru')),
    }));
  }
}
