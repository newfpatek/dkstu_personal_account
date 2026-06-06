import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { GradeRecord } from './entities/grade-record.entity';
import { PortfolioItem } from './entities/portfolio-item.entity';
import { Scholarship } from './entities/scholarship.entity';
import { User } from '../users/entities/user.entity';
import { PortfolioCategory } from './enums/portfolio-category.enum';
import { GradeValue } from './enums/grade-value.enum';

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
}
