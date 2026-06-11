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
import { GroupSemesterDiscipline } from '../groups/entities/group-semester-discipline.entity';
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
    @InjectRepository(UserGroupRole)
    private userGroupRoleRepo: Repository<UserGroupRole>,
    @InjectRepository(GroupSemesterDiscipline)
    private groupSemDisciplineRepo: Repository<GroupSemesterDiscipline>,
  ) {}

  async getGrades(studentId: string, semester?: number) {
    const qb = this.gradeRepo
      .createQueryBuilder('gr')
      .leftJoinAndSelect('gr.discipline', 'discipline')
      .where('gr.studentId = :studentId', { studentId });

    if (semester) qb.andWhere('gr.semester = :semester', { semester });

    return qb.orderBy('discipline.name', 'ASC').getMany();
  }

  async getCurrentSemesterPlan(studentId: string, semester?: number) {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.groups', 'g')
      .where('u.id = :studentId', { studentId })
      .getOne();

    const groupIds = (user?.groups ?? []).map((g) => g.id);
    if (!groupIds.length) return { semester: null, entries: [] };

    const qb = this.groupSemDisciplineRepo
      .createQueryBuilder('gsd')
      .leftJoinAndSelect('gsd.discipline', 'd')
      .where('gsd.groupId IN (:...groupIds)', { groupIds });

    if (semester !== undefined) qb.andWhere('gsd.semester = :semester', { semester });
    qb.orderBy('gsd.semester', 'DESC');

    const all = await qb.getMany();
    if (!all.length) return { semester: null, entries: [] };

    const targetSemester = semester ?? all[0].semester;
    const planned = all.filter((p) => p.semester === targetSemester);

    const grades = await this.gradeRepo.find({
      where: { studentId, semester: targetSemester },
      relations: { discipline: true },
    });
    const gradeMap = new Map<string, GradeRecord>();
    for (const g of grades) {
      if (!gradeMap.has(g.disciplineId)) gradeMap.set(g.disciplineId, g);
    }

    const entries = planned.map((p) => {
      const grade = gradeMap.get(p.disciplineId);
      return {
        disciplineId: p.disciplineId,
        discipline: p.discipline,
        gradeRecordId: grade?.id ?? null,
        gradeValue: grade?.gradeValue ?? null,
        isDebt: grade?.isDebt ?? false,
      };
    }).sort((a, b) => a.discipline.name.localeCompare(b.discipline.name, 'ru'));

    return { semester: targetSemester, entries };
  }

  async getGradesHistory(studentId: string) {
    const records = await this.gradeRepo.find({
      where: { studentId },
      relations: { discipline: true },
      order: { semester: 'DESC' },
    });

    // Group by semester → records[]
    const grouped: Record<number, GradeRecord[]> = {};
    for (const record of records) {
      if (!grouped[record.semester]) grouped[record.semester] = [];
      grouped[record.semester].push(record);
    }
    return grouped;
  }

  // Одна запись на дисциплину — берётся из последнего семестра (academicYear DESC, semester DESC)
  async getLatestGradesPerDiscipline(studentId: string): Promise<GradeRecord[]> {
    const all = await this.gradeRepo.find({
      where: { studentId },
      relations: { discipline: true },
    });

    const latest = new Map<string, GradeRecord>();
    for (const r of all) {
      const prev = latest.get(r.disciplineId);
      if (!prev || this.isLaterSemester(r, prev)) {
        latest.set(r.disciplineId, r);
      }
    }

    return Array.from(latest.values()).sort((a, b) =>
      (a.discipline?.name ?? '').localeCompare(b.discipline?.name ?? '', 'ru'),
    );
  }

  private isLaterSemester(a: GradeRecord, b: GradeRecord): boolean {
    return a.semester > b.semester;
  }

  async calculateGpa(studentId: string): Promise<number | null> {
    const latest = await this.getLatestGradesPerDiscipline(studentId);
    const numericValues = latest
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
      order: { semester: 'DESC' },
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


  async servePortfolioFile(
    studentId: string,
    itemId: string,
    res: Response,
    inline: boolean,
  ): Promise<void> {
    const item = await this.portfolioRepo.findOne({ where: { id: itemId, studentId } });
    if (!item || !item.filePath)
      throw new NotFoundException('Файл не найден');
    if (!fs.existsSync(item.filePath))
      throw new NotFoundException('Файл не найден на диске');

    const fileName = item.fileName || path.basename(item.filePath);
    const disposition = inline
      ? `inline; filename="${encodeURIComponent(fileName)}"`
      : `attachment; filename="${encodeURIComponent(fileName)}"`;
    res.setHeader('Content-Disposition', disposition);
    res.sendFile(path.resolve(item.filePath));
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

  async searchStudents(q?: string, groupId?: string) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.groups', 'g')
      .where("u.role = 'student'");

    if (q) {
      qb.andWhere('(u.name ILIKE :q OR u.email ILIKE :q)', { q: `%${q}%` });
    }
    if (groupId) {
      qb.andWhere('g.id = :groupId', { groupId });
    }

    const users = await qb.orderBy('u.name', 'ASC').getMany();
    return users.map(({ password, ...safe }: any) => safe);
  }

  async getStudentProfileById(studentId: string) {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.groups', 'g')
      .where('u.id = :studentId', { studentId })
      .getOne();

    if (!user) throw new NotFoundException('Студент не найден');

    const groupIds = (user.groups ?? []).map((g) => g.id);
    const roleEntries = groupIds.length > 0
      ? await this.userGroupRoleRepo.find({ where: { userId: studentId } })
      : [];

    const { password, ...safe } = user as any;
    return {
      ...safe,
      groups: (user.groups ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        year: g.year,
        groupRole: roleEntries.find((r) => r.groupId === g.id)?.label ?? null,
      })),
    };
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

    const maxSemRows = groupIds.length > 0
      ? await this.groupSemDisciplineRepo
          .createQueryBuilder('gsd')
          .select('gsd.groupId', 'groupId')
          .addSelect('MAX(gsd.semester)', 'maxSem')
          .where('gsd.groupId IN (:...groupIds)', { groupIds })
          .groupBy('gsd.groupId')
          .getRawMany()
      : [];
    const maxSemMap = new Map<string, number | null>(
      maxSemRows.map((r) => [r.groupId, r.maxSem != null ? Number(r.maxSem) : null]),
    );

    return (user.groups ?? []).map((group) => ({
      id: group.id,
      name: group.name,
      year: group.year,
      maxSemester: maxSemMap.get(group.id) ?? null,
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
