import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as XLSX from 'xlsx';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Group } from '../groups/entities/group.entity';
import { Scholarship } from '../students/entities/scholarship.entity';
import { ScholarshipBaseAmount } from '../students/entities/scholarship-base-amount.entity';
import { GradeRecord } from '../students/entities/grade-record.entity';
import { ScholarshipType } from '../students/enums/scholarship-type.enum';
import { EnhancedDirection } from '../students/enums/enhanced-direction.enum';
import { UserGroupRole } from '../groups/entities/user-group-role.entity';
import { GroupSemesterDiscipline } from '../groups/entities/group-semester-discipline.entity';
import { Discipline } from '../students/entities/discipline.entity';
import { DisciplineType } from '../students/enums/discipline-type.enum';
import { GradeValue } from '../students/enums/grade-value.enum';
import { AssignGroupDisciplinesDto } from './dto/assign-group-disciplines.dto';
import { Role } from '../../auth/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { SetBaseAmountDto } from './dto/set-base-amount.dto';
import { AssignScholarshipDto } from './dto/assign-scholarship.dto';
import { UpdateScholarshipDto } from './dto/update-scholarship.dto';

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
    @InjectRepository(Scholarship)
    private readonly scholarshipRepo: Repository<Scholarship>,
    @InjectRepository(ScholarshipBaseAmount)
    private readonly baseAmountRepo: Repository<ScholarshipBaseAmount>,
    @InjectRepository(GradeRecord)
    private readonly gradeRecordRepo: Repository<GradeRecord>,
    @InjectRepository(UserGroupRole)
    private readonly userGroupRoleRepo: Repository<UserGroupRole>,
    @InjectRepository(Discipline)
    private readonly disciplineRepo: Repository<Discipline>,
    @InjectRepository(GroupSemesterDiscipline)
    private readonly groupSemDisciplineRepo: Repository<GroupSemesterDiscipline>,
  ) {}

  async onModuleInit() {
    const academic = await this.baseAmountRepo.findOne({
      where: { type: ScholarshipType.ACADEMIC, direction: IsNull() },
    });
    if (academic) {
      const amount = Number(academic.amount);
      await this.upsertBaseAmount(ScholarshipType.ACADEMIC_COEFF_14, null, Math.round(amount * 1.4 * 100) / 100);
      await this.upsertBaseAmount(ScholarshipType.ACADEMIC_COEFF_15, null, Math.round(amount * 1.5 * 100) / 100);
    }
  }

  // ─── Users ───────────────────────────────────────────────────────────────

  async createUser(dto: CreateUserDto): Promise<Omit<User, 'password'> & { generatedPassword?: string }> {
    // Проверяем уникальность телефона — он является логином
    const phoneExists = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (phoneExists) throw new ConflictException('Номер телефона уже используется');

    if (dto.email) {
      const emailExists = await this.userRepo.findOne({ where: { email: dto.email } });
      if (emailExists) throw new ConflictException('Email уже используется');
    }

    const plainPassword = dto.password ?? this.generatePassword();
    const hashed = await bcrypt.hash(plainPassword, 10);
    const user = this.userRepo.create({
      fullName: dto.name,
      phone: dto.phone,
      email: dto.email ?? null,
      gradeBook: dto.gradeBook ?? null,
      password: hashed,
      role: dto.role ?? Role.STUDENT,
      isPaid: dto.isPaid ?? false,
    });
    await this.userRepo.save(user);
    const result: Omit<User, 'password'> & { generatedPassword?: string } = this.sanitize(user);
    if (!dto.password) result.generatedPassword = plainPassword;
    return result;
  }

  async findAllUsers(role?: Role): Promise<Omit<User, 'password'>[]> {
    const where = role ? { role } : {};
    const users = await this.userRepo.find({ where, order: { createdAt: 'DESC' } });
    return users.map(this.sanitize);
  }

  async findUserById(id: string): Promise<Omit<User, 'password'>> {
    const user = await this.userRepo.findOne({ where: { id }, relations: { groups: true } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return this.sanitize(user);
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<Omit<User, 'password'>> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    if (dto.phone && dto.phone !== user.phone) {
      const exists = await this.userRepo.findOne({ where: { phone: dto.phone } });
      if (exists) throw new ConflictException('Номер телефона уже используется');
      user.phone = dto.phone;
    }
    if (dto.email && dto.email !== user.email) {
      const exists = await this.userRepo.findOne({ where: { email: dto.email } });
      if (exists) throw new ConflictException('Email уже используется');
      user.email = dto.email;
    }
    if (dto.gradeBook !== undefined) {
      if (dto.gradeBook) {
        const exists = await this.userRepo.findOne({ where: { gradeBook: dto.gradeBook } });
        if (exists && exists.id !== id) throw new ConflictException('Номер зачётной книжки уже занят');
      }
      user.gradeBook = dto.gradeBook || null;
    }
    if (dto.name !== undefined) user.fullName = dto.name;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isPaid !== undefined) user.isPaid = dto.isPaid;
    if (dto.password !== undefined) user.password = await bcrypt.hash(dto.password, 10);

    await this.userRepo.save(user);
    return this.sanitize(user);
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    await this.userRepo.remove(user);
    return { message: 'Пользователь удалён' };
  }

  // ─── Groups ──────────────────────────────────────────────────────────────

  async createGroup(dto: CreateGroupDto): Promise<Group> {
    const exists = await this.groupRepo.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Группа с таким названием уже существует');

    const group = this.groupRepo.create({ name: dto.name, year: dto.year });
    return this.groupRepo.save(group);
  }

  async findAllGroups(): Promise<any[]> {
    const groups = await this.groupRepo.find({
      relations: { members: true },
      order: { name: 'ASC' },
    });
    return this.attachGroupRoles(groups);
  }

  async findGroupById(id: string): Promise<any> {
    const group = await this.groupRepo.findOne({ where: { id }, relations: { members: true } });
    if (!group) throw new NotFoundException('Группа не найдена');
    const [enriched] = await this.attachGroupRoles([group]);
    return enriched;
  }

  private async attachGroupRoles(groups: Group[]): Promise<any[]> {
    if (!groups.length) return groups;

    const groupIds = groups.map((g) => g.id);
    const roles = await this.userGroupRoleRepo
      .createQueryBuilder('ugr')
      .where('ugr.groupId IN (:...groupIds)', { groupIds })
      .getMany();

    const roleMap = new Map<string, Map<string, string>>();
    for (const r of roles) {
      if (!roleMap.has(r.groupId)) roleMap.set(r.groupId, new Map());
      roleMap.get(r.groupId)!.set(r.userId, r.label);
    }

    return groups.map((g) => ({
      ...g,
      members: (g.members || []).map((m) => ({
        ...m,
        groupRole: roleMap.get(g.id)?.get(m.id) ?? null,
      })),
    }));
  }

  async deleteGroup(id: string): Promise<{ message: string }> {
    const group = await this.groupRepo.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Группа не найдена');
    await this.groupRepo.remove(group);
    return { message: 'Группа удалена' };
  }

  async addUserToGroup(groupId: string, userId: string): Promise<{ message: string }> {
    const group = await this.groupRepo.findOne({ where: { id: groupId }, relations: { members: true } });
    if (!group) throw new NotFoundException('Группа не найдена');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const alreadyIn = group.members.some((m) => m.id === userId);
    if (alreadyIn) throw new ConflictException('Пользователь уже в группе');

    group.members.push(user);
    await this.groupRepo.save(group);
    return { message: 'Пользователь добавлен в группу' };
  }

  async removeUserFromGroup(groupId: string, userId: string): Promise<{ message: string }> {
    const group = await this.groupRepo.findOne({ where: { id: groupId }, relations: { members: true } });
    if (!group) throw new NotFoundException('Группа не найдена');

    const idx = group.members.findIndex((m) => m.id === userId);
    if (idx === -1) throw new NotFoundException('Пользователь не состоит в этой группе');

    group.members.splice(idx, 1);
    await this.groupRepo.save(group);
    // Убираем роль в группе, если была
    await this.userGroupRoleRepo.delete({ userId, groupId });
    return { message: 'Пользователь удалён из группы' };
  }

  async setGroupRole(groupId: string, userId: string, label: string): Promise<UserGroupRole> {
    const group = await this.groupRepo.findOne({ where: { id: groupId }, relations: { members: true } });
    if (!group) throw new NotFoundException('Группа не найдена');
    if (!group.members.some((m) => m.id === userId)) {
      throw new BadRequestException('Пользователь не состоит в этой группе');
    }

    let entry = await this.userGroupRoleRepo.findOne({ where: { userId, groupId } });
    if (entry) {
      entry.label = label;
    } else {
      entry = this.userGroupRoleRepo.create({ userId, groupId, label });
    }
    return this.userGroupRoleRepo.save(entry);
  }

  async removeGroupRole(groupId: string, userId: string): Promise<{ message: string }> {
    await this.userGroupRoleRepo.delete({ userId, groupId });
    return { message: 'Роль в группе снята' };
  }

  // ─── Scholarship base amounts ─────────────────────────────────────────────

  async getBaseAmounts(): Promise<ScholarshipBaseAmount[]> {
    return this.baseAmountRepo.find({ order: { type: 'ASC' } });
  }

  async setBaseAmount(dto: SetBaseAmountDto): Promise<ScholarshipBaseAmount> {
    const direction = dto.direction ?? null;
    const saved = await this.upsertBaseAmount(dto.type, direction, dto.amount);

    if (dto.type === ScholarshipType.ACADEMIC && direction === null) {
      const coeff14 = Math.round(dto.amount * 1.4 * 100) / 100;
      const coeff15 = Math.round(dto.amount * 1.5 * 100) / 100;
      await this.upsertBaseAmount(ScholarshipType.ACADEMIC_COEFF_14, null, coeff14);
      await this.upsertBaseAmount(ScholarshipType.ACADEMIC_COEFF_15, null, coeff15);
    }

    return saved;
  }

  private async upsertBaseAmount(
    type: ScholarshipType,
    direction: string | null,
    amount: number,
  ): Promise<ScholarshipBaseAmount> {
    let record = await this.baseAmountRepo.findOne({
      where: { type, direction: direction === null ? IsNull() : direction },
    });
    if (record) {
      record.amount = amount;
    } else {
      record = this.baseAmountRepo.create({ type, amount, direction });
    }
    return this.baseAmountRepo.save(record);
  }

  // ─── Student scholarships ─────────────────────────────────────────────────

  async getStudentScholarships(studentId: string): Promise<Scholarship[]> {
    await this.requireUser(studentId);
    return this.scholarshipRepo.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
    });
  }

  async assignScholarship(studentId: string, dto: AssignScholarshipDto): Promise<Scholarship> {
    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Студент не найден');

    if (student.isPaid) {
      throw new BadRequestException(
        'Студент обучается на платной основе — назначение стипендии недоступно',
      );
    }

    const debtCount = await this.gradeRecordRepo.count({ where: { studentId, isDebt: true } });
    if (debtCount > 0 && dto.type !== ScholarshipType.SOCIAL) {
      throw new BadRequestException(
        'У студента есть академические задолженности — допускается только социальная стипендия',
      );
    }

    let amount = dto.amount;
    if (amount === undefined) {
      amount = await this.resolveBaseAmount(dto.type, dto.direction ?? null);
    }

    const record = this.scholarshipRepo.create({
      studentId,
      type: dto.type,
      direction: dto.direction ?? null,
      amount,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd ?? null,
      isActive: true,
    });
    return this.scholarshipRepo.save(record);
  }

  async updateScholarship(studentId: string, id: string, dto: UpdateScholarshipDto): Promise<Scholarship> {
    const record = await this.scholarshipRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Запись о стипендии не найдена');
    if (record.studentId !== studentId) throw new NotFoundException('Запись о стипендии не найдена');

    if (dto.amount !== undefined) record.amount = dto.amount;
    if (dto.direction !== undefined) record.direction = dto.direction;
    if (dto.periodStart !== undefined) record.periodStart = dto.periodStart;
    if (dto.periodEnd !== undefined) record.periodEnd = dto.periodEnd;
    if (dto.isActive !== undefined) record.isActive = dto.isActive;

    return this.scholarshipRepo.save(record);
  }

  async deleteScholarship(studentId: string, id: string): Promise<{ message: string }> {
    const record = await this.scholarshipRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Запись о стипендии не найдена');
    if (record.studentId !== studentId) throw new NotFoundException('Запись о стипендии не найдена');
    await this.scholarshipRepo.remove(record);
    return { message: 'Запись о стипендии удалена' };
  }

  async importScholarships(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    let records: Array<{
      email?: string;
      phone?: string;
      gradeBook?: string;
      type: string;
      amount?: number;
      periodStart: string;
      periodEnd?: string;
      direction?: string;
    }>;

    try {
      if (mimetype === 'application/json' || originalname.endsWith('.json')) {
        records = JSON.parse(buffer.toString('utf-8'));
        if (!Array.isArray(records)) throw new Error('JSON должен быть массивом');
      } else if (mimetype === 'application/xml' || mimetype === 'text/xml' || originalname.endsWith('.xml')) {
        records = this.parseScholarshipsXml(buffer.toString('utf-8'));
      } else if (this.isExcel(mimetype, originalname)) {
        // Excel: ФИО | Номер телефона | Тип | Сумма | Дата начала | Дата конца | Направление
        const rows = this.readExcelSheet(buffer, 0);
        records = rows
          .map((row) => ({
            phone: this.excelStr(row, 'Номер телефона', 'Телефон', 'phone') || undefined,
            type: this.excelStr(row, 'Тип', 'type'),
            amount: this.excelStr(row, 'Сумма', 'amount') ? Number(this.excelStr(row, 'Сумма', 'amount')) : undefined,
            periodStart: this.excelDate(row, 'Дата начала', 'periodStart'),
            periodEnd: this.excelDate(row, 'Дата конца', 'periodEnd') || undefined,
            direction: this.excelStr(row, 'Направление', 'direction') || undefined,
          }))
          .filter((r) => r.type && r.periodStart);
      } else {
        throw new BadRequestException('Поддерживаются только JSON, XML и Excel (.xlsx) файлы');
      }
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(`Ошибка разбора файла: ${e instanceof Error ? e.message : String(e)}`);
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const rec of records) {
      const identifier = rec.gradeBook ?? rec.phone ?? rec.email ?? '';
      if ((!rec.email && !rec.phone && !rec.gradeBook) || !rec.type || !rec.periodStart) {
        errors.push('Пропущена запись: обязательны тип, дата начала и хотя бы один из: email, телефон, зачётная книжка');
        skipped++;
        continue;
      }

      const student = rec.gradeBook
        ? await this.userRepo.findOne({ where: { gradeBook: rec.gradeBook } })
        : rec.phone
          ? await this.userRepo.findOne({ where: { phone: rec.phone } })
          : await this.userRepo.findOne({ where: { email: rec.email } });
      if (!student) {
        errors.push(`${identifier}: пользователь не найден`);
        skipped++;
        continue;
      }

      if (student.isPaid) {
        errors.push(`${identifier}: студент на платной основе, стипендия не назначается`);
        skipped++;
        continue;
      }

      const schType = Object.values(ScholarshipType).includes(rec.type as ScholarshipType)
        ? (rec.type as ScholarshipType)
        : null;
      if (!schType) {
        errors.push(`${identifier}: неизвестный тип стипендии "${rec.type}"`);
        skipped++;
        continue;
      }

      const debtCount = await this.gradeRecordRepo.count({ where: { studentId: student.id, isDebt: true } });
      if (debtCount > 0 && schType !== ScholarshipType.SOCIAL) {
        errors.push(`${identifier}: у студента есть задолженности — допускается только социальная стипендия`);
        skipped++;
        continue;
      }

      const direction =
        rec.direction && Object.values(EnhancedDirection).includes(rec.direction as EnhancedDirection)
          ? (rec.direction as EnhancedDirection)
          : null;

      let amount = rec.amount !== undefined ? Number(rec.amount) : undefined;
      if (amount === undefined) {
        try {
          amount = await this.resolveBaseAmount(schType, direction);
        } catch {
          errors.push(`${identifier}: базовый размер для типа "${schType}"${direction ? ` (${direction})` : ''} не задан, либо укажите базовое значение степндии, либо укажите сумму в файле`);
          skipped++;
          continue;
        }
      }

      await this.scholarshipRepo.save(
        this.scholarshipRepo.create({
          studentId: student.id,
          type: schType,
          direction,
          amount,
          periodStart: rec.periodStart,
          periodEnd: rec.periodEnd ?? null,
          isActive: true,
        }),
      );
      created++;
    }

    return { created, skipped, errors };
  }

  private parseScholarshipsXml(xml: string): Array<{
    email?: string; phone?: string; gradeBook?: string; type: string; amount?: number;
    periodStart: string; periodEnd?: string; direction?: string;
  }> {
    const records: Array<{
      email?: string; phone?: string; gradeBook?: string; type: string; amount?: number;
      periodStart: string; periodEnd?: string; direction?: string;
    }> = [];
    const blocks = xml.match(/<scholarship>([\s\S]*?)<\/scholarship>/g) ?? [];
    for (const block of blocks) {
      const get = (tag: string) => {
        const m = block.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
        return m ? m[1].trim() : undefined;
      };
      const email = get('email');
      const phone = get('phone');
      const gradeBook = get('gradeBook') ?? get('grade_book');
      const type = get('type');
      const periodStart = get('periodStart');
      if ((!email && !phone && !gradeBook) || !type || !periodStart) continue;
      const amountStr = get('amount');
      records.push({
        email, phone, gradeBook, type, periodStart,
        periodEnd: get('periodEnd'),
        direction: get('direction'),
        amount: amountStr !== undefined ? Number(amountStr) : undefined,
      });
    }
    return records;
  }

  async getDisciplines() {
    return this.disciplineRepo.find({ order: { name: 'ASC' } });
  }

  async createDiscipline(name: string, disciplineType: DisciplineType): Promise<Discipline> {
    const existing = await this.disciplineRepo.findOne({ where: { name } });
    if (existing) throw new ConflictException(`Дисциплина "${name}" уже существует`);
    return this.disciplineRepo.save(this.disciplineRepo.create({ name, disciplineType }));
  }

  // ─── Grades ──────────────────────────────────────────────────────────────

  async getGradesForGroup(groupId: string, disciplineId: string, semester: number) {
    const group = await this.groupRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.members', 'm')
      .where('g.id = :groupId', { groupId })
      .getOne();
    if (!group) throw new NotFoundException('Группа не найдена');

    const students = (group.members ?? []).filter((m) => m.role === Role.STUDENT);

    const grades = await this.gradeRecordRepo.find({ where: { disciplineId, semester } });
    const gradeMap = new Map(grades.map((g) => [g.studentId, g]));

    return students
      .sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'ru'))
      .map((s) => ({
        studentId: s.id,
        fullName: s.fullName,
        gradeBook: s.gradeBook,
        gradeRecordId: gradeMap.get(s.id)?.id ?? null,
        gradeValue: gradeMap.get(s.id)?.gradeValue ?? null,
      }));
  }

  async upsertGrades(dto: {
    disciplineId: string;
    semester: number;
    grades: Array<{ studentId: string; gradeValue: string | null }>;
  }): Promise<{ saved: number; cleared: number }> {
    let saved = 0;
    let cleared = 0;

    for (const g of dto.grades) {
      const existing = await this.gradeRecordRepo.findOne({
        where: { studentId: g.studentId, disciplineId: dto.disciplineId, semester: dto.semester },
      });

      if (!g.gradeValue) {
        if (existing) { await this.gradeRecordRepo.remove(existing); cleared++; }
        continue;
      }

      if (existing) {
        existing.gradeValue = g.gradeValue as GradeValue;
        await this.gradeRecordRepo.save(existing);
      } else {
        await this.gradeRecordRepo.save(
          this.gradeRecordRepo.create({
            studentId: g.studentId,
            disciplineId: dto.disciplineId,
            semester: dto.semester,
            gradeValue: g.gradeValue as GradeValue,
          }),
        );
      }
      saved++;
    }

    return { saved, cleared };
  }

  async importGrades(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
  ): Promise<{ saved: number; skipped: number; errors: string[] }> {
    // Формат записи: зачётная книжка идентифицирует студента (как в выгрузке 1С)
    type GradeRow = { gradeBook: string; fullName: string; semester: number; disciplineName: string; disciplineType?: string; grade: string };

    let rows: GradeRow[];
    try {
      if (this.isExcel(mimetype, originalname)) {
        // Excel (xlsx): заголовки: ФИО | Зачётная книжка | Семестр | Дисциплина | Тип | Оценка
        const rawRows = this.readExcelSheet(buffer, 0);
        rows = rawRows
          .map((row) => ({
            fullName: this.excelStr(row, 'ФИО', 'fullName', 'name'),
            gradeBook: this.excelStr(row, 'Зачётная книжка', 'gradeBook', 'grade_book'),
            semester: Number(this.excelStr(row, 'Семестр', 'semester')),
            disciplineName: this.excelStr(row, 'Дисциплина', 'disciplineName'),
            disciplineType: this.excelStr(row, 'Тип', 'disciplineType') || undefined,
            grade: this.excelStr(row, 'Оценка', 'grade', 'value'),
          }))
          .filter((r) => r.gradeBook && r.semester && r.disciplineName && r.grade);
      } else if (mimetype === 'application/json' || originalname.endsWith('.json')) {
        // JSON-формат: [{gradeBook, fullName?, semester, disciplineName, disciplineType?, grade}]
        rows = JSON.parse(buffer.toString('utf-8'));
        if (!Array.isArray(rows)) throw new Error('JSON должен быть массивом');
      } else if (mimetype === 'application/xml' || mimetype === 'text/xml' || originalname.endsWith('.xml')) {
        rows = this.parseGradesXml(buffer.toString('utf-8'));
      } else {
        throw new BadRequestException('Поддерживаются только JSON, XML и Excel (.xlsx) файлы');
      }
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(`Ошибка разбора файла: ${e instanceof Error ? e.message : String(e)}`);
    }

    const validGrades = new Set<string>(Object.values(GradeValue));
    let saved = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.gradeBook || !row.semester || !row.disciplineName || !row.grade) {
        errors.push('Пропущена строка: не хватает обязательных полей (gradeBook, semester, disciplineName, grade)');
        skipped++;
        continue;
      }

      const student = await this.userRepo.findOne({ where: { gradeBook: row.gradeBook } });
      if (!student) {
        errors.push(`Зачётная книжка "${row.gradeBook}" не найдена`);
        skipped++;
        continue;
      }

      if (!validGrades.has(row.grade)) {
        errors.push(`Неверная оценка "${row.grade}" для зачётной книжки "${row.gradeBook}"`);
        skipped++;
        continue;
      }

      const discType = row.disciplineType === 'pass_fail' ? DisciplineType.PASS_FAIL : DisciplineType.EXAM;
      let discipline = await this.disciplineRepo.findOne({ where: { name: row.disciplineName } });
      if (!discipline) {
        discipline = await this.disciplineRepo.save(
          this.disciplineRepo.create({ name: row.disciplineName, disciplineType: discType }),
        );
      }

      const existing = await this.gradeRecordRepo.findOne({
        where: { studentId: student.id, disciplineId: discipline.id, semester: row.semester },
      });
      if (existing) {
        existing.gradeValue = row.grade as GradeValue;
        await this.gradeRecordRepo.save(existing);
      } else {
        await this.gradeRecordRepo.save(
          this.gradeRecordRepo.create({
            studentId: student.id,
            disciplineId: discipline.id,
            semester: row.semester,
            gradeValue: row.grade as GradeValue,
          }),
        );
      }
      saved++;
    }

    return { saved, skipped, errors };
  }

  private parseGradesXml(xml: string): Array<{
    gradeBook: string; fullName: string; semester: number;
    disciplineName: string; disciplineType?: string; grade: string;
  }> {
    // XML-формат: <gradesList><row><gradeBook>...</gradeBook><fullName>...</fullName>
    //   <semester>N</semester><disciplineName>...</disciplineName>
    //   <disciplineType>exam|pass_fail</disciplineType><grade>...</grade></row></gradesList>
    const getString = (src: string, tag: string) => {
      const m = src.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
      return m ? m[1].trim() : undefined;
    };

    const rows: ReturnType<typeof this.parseGradesXml> = [];
    const rowBlocks = xml.match(/<row>([\s\S]*?)<\/row>/g) ?? [];

    for (const block of rowBlocks) {
      const gradeBook = getString(block, 'gradeBook');
      const fullName = getString(block, 'fullName') ?? '';
      const semStr = getString(block, 'semester');
      const disciplineName = getString(block, 'disciplineName');
      const grade = getString(block, 'grade');
      if (!gradeBook || !semStr || !disciplineName || !grade) continue;
      rows.push({
        gradeBook,
        fullName,
        semester: Number(semStr),
        disciplineName,
        disciplineType: getString(block, 'disciplineType'),
        grade,
      });
    }
    return rows;
  }

  // ─── Group semester disciplines ───────────────────────────────────────────

  async assignGroupDisciplines(dto: AssignGroupDisciplinesDto): Promise<{ assigned: number; skipped: number }> {
    const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
    if (!group) throw new NotFoundException('Группа не найдена');

    // Удаляем записи других семестров — один активный семестр на группу
    await this.groupSemDisciplineRepo
      .createQueryBuilder()
      .delete()
      .where('group_id = :groupId', { groupId: dto.groupId })
      .andWhere('semester != :semester', { semester: dto.semester })
      .execute();

    let assigned = 0;
    let skipped = 0;

    for (const disciplineId of dto.disciplineIds) {
      const discipline = await this.disciplineRepo.findOne({ where: { id: disciplineId } });
      if (!discipline) { skipped++; continue; }

      const exists = await this.groupSemDisciplineRepo.findOne({
        where: { groupId: dto.groupId, disciplineId, semester: dto.semester },
      });
      if (exists) { skipped++; continue; }

      await this.groupSemDisciplineRepo.save(
        this.groupSemDisciplineRepo.create({ groupId: dto.groupId, disciplineId, semester: dto.semester }),
      );
      assigned++;
    }

    return { assigned, skipped };
  }

  async getGroupSemesterDisciplines(groupId: string, semester?: number): Promise<GroupSemesterDiscipline[]> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Группа не найдена');

    const qb = this.groupSemDisciplineRepo
      .createQueryBuilder('gsd')
      .leftJoinAndSelect('gsd.discipline', 'discipline')
      .where('gsd.groupId = :groupId', { groupId });

    if (semester !== undefined) qb.andWhere('gsd.semester = :semester', { semester });

    return qb.orderBy('gsd.semester', 'DESC').addOrderBy('discipline.name', 'ASC').getMany();
  }

  async removeGroupSemesterDiscipline(id: string): Promise<{ message: string }> {
    const entry = await this.groupSemDisciplineRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Запись не найдена');
    await this.groupSemDisciplineRepo.remove(entry);
    return { message: 'Дисциплина удалена из плана' };
  }

  async importGroupDisciplines(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
  ): Promise<{ assigned: number; skipped: number; errors: string[] }> {
    type DisciplineEntry = { name: string; type?: string };
    type GroupItem = { groupName: string; disciplines: DisciplineEntry[]; semester: number };

    let items: GroupItem[];

    try {
      if (mimetype === 'application/json' || originalname.endsWith('.json')) {
        const raw = JSON.parse(buffer.toString('utf-8'));
        if (!Array.isArray(raw)) throw new Error('JSON должен быть массивом');
        items = raw.map((item: any) => ({
          ...item,
          disciplines: (item.disciplines ?? []).map((d: any) =>
            typeof d === 'string' ? { name: d } : { name: d.name, type: d.type },
          ),
        }));
      } else if (mimetype === 'application/xml' || mimetype === 'text/xml' || originalname.endsWith('.xml')) {
        items = this.parseGroupDisciplinesXml(buffer.toString('utf-8'));
      } else if (this.isExcel(mimetype, originalname)) {
        // Excel: плоская таблица, заголовки: Группа | Дисциплина | Тип | Семестр
        const rows = this.readExcelSheet(buffer, 0);
        const map = new Map<string, GroupItem>();
        for (const row of rows) {
          const groupName = this.excelStr(row, 'Группа', 'groupName');
          const discName = this.excelStr(row, 'Дисциплина', 'discipline', 'disciplineName');
          const discType = this.excelStr(row, 'Тип', 'type', 'disciplineType');
          const semester = Number(this.excelStr(row, 'Семестр', 'semester'));
          if (!groupName || !discName || !semester) continue;
          const key = `${groupName}::${semester}`;
          if (!map.has(key)) map.set(key, { groupName, disciplines: [], semester });
          map.get(key)!.disciplines.push({ name: discName, type: discType || undefined });
        }
        items = Array.from(map.values());
      } else {
        throw new BadRequestException('Поддерживаются только JSON, XML и Excel (.xlsx) файлы');
      }
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(`Ошибка разбора файла: ${e instanceof Error ? e.message : String(e)}`);
    }

    let assigned = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of items) {
      const group = await this.groupRepo.findOne({ where: { name: item.groupName } });
      if (!group) {
        errors.push(`Группа "${item.groupName}" не найдена`);
      }

      for (const disc of item.disciplines ?? []) {
        const discName = disc.name?.trim();
        if (!discName) continue;

        const discType = disc.type === 'pass_fail' ? DisciplineType.PASS_FAIL : DisciplineType.EXAM;

        let discipline = await this.disciplineRepo.findOne({ where: { name: discName } });
        if (!discipline) {
          discipline = await this.disciplineRepo.save(
            this.disciplineRepo.create({ name: discName, disciplineType: discType }),
          );
        }

        if (!group) { skipped++; continue; }

        const exists = await this.groupSemDisciplineRepo.findOne({
          where: { groupId: group.id, disciplineId: discipline.id, semester: item.semester },
        });
        if (exists) { skipped++; continue; }

        await this.groupSemDisciplineRepo.save(
          this.groupSemDisciplineRepo.create({
            groupId: group.id, disciplineId: discipline.id, semester: item.semester,
          }),
        );
        assigned++;
      }
    }

    return { assigned, skipped, errors };
  }

  // ─── Import ───────────────────────────────────────────────────────────────

  async importGroup(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
  ): Promise<object> {
    // Excel — плоский формат с колонкой «Группа», может создавать несколько групп сразу
    if (this.isExcel(mimetype, originalname)) {
      return this.importGroupsFromExcel(buffer);
    }

    let groupData: {
      name: string;
      year: number;
      members?: Array<{ phone: string; email?: string; gradeBook?: string; name?: string; password?: string; isPaid?: boolean; role?: string }>;
    };

    try {
      if (mimetype === 'application/json' || originalname.endsWith('.json')) {
        groupData = JSON.parse(buffer.toString('utf-8'));
        if (!groupData.name || !groupData.year) throw new Error('Обязательные поля: name, year');
      } else if (
        mimetype === 'application/xml' ||
        mimetype === 'text/xml' ||
        originalname.endsWith('.xml')
      ) {
        groupData = this.parseGroupXml(buffer.toString('utf-8'));
      } else {
        throw new BadRequestException('Поддерживаются только JSON, XML и Excel (.xlsx) файлы');
      }
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Ошибка разбора файла: ${msg}`);
    }

    const existingGroup = await this.groupRepo.findOne({ where: { name: groupData.name } });
    if (existingGroup) throw new ConflictException(`Группа "${groupData.name}" уже существует`);

    const group = await this.groupRepo.save(
      this.groupRepo.create({ name: groupData.name, year: Number(groupData.year) }),
    );

    const PHONE_E164_REGEX = /^\+[1-9]\d{6,14}$/;

    let created = 0;
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];
    const members: User[] = [];
    const generatedPasswords: Array<{ phone: string; password: string }> = [];

    for (const rec of groupData.members ?? []) {
      if (!rec.phone) {
        errors.push('Пропущена запись: отсутствует phone');
        skipped++;
        continue;
      }
      if (!PHONE_E164_REGEX.test(rec.phone)) {
        errors.push(`${rec.phone}: номер не соответствует E.164`);
        skipped++;
        continue;
      }

      // Ищем по телефону — он является логином
      let user = await this.userRepo.findOne({ where: { phone: rec.phone } });
      if (!user) {
        if (!rec.name) {
          errors.push(`${rec.phone}: пользователь не найден, нужно поле name для создания`);
          skipped++;
          continue;
        }
        const plainPassword = rec.password ?? this.generatePassword();
        const role = Object.values(Role).includes(rec.role as Role) ? (rec.role as Role) : Role.STUDENT;
        const hashed = await bcrypt.hash(plainPassword, 10);
        user = await this.userRepo.save(
          this.userRepo.create({
            fullName: rec.name,
            phone: rec.phone,
            email: rec.email ?? null,
            gradeBook: rec.gradeBook ?? null,
            password: hashed,
            role,
            isPaid: rec.isPaid ?? false,
          }),
        );
        if (!rec.password) generatedPasswords.push({ phone: rec.phone, password: plainPassword });
        created++;
      }

      members.push(user);
      added++;
    }

    if (members.length > 0) {
      group.members = members;
      await this.groupRepo.save(group);
    }

    return { group: { id: group.id, name: group.name }, created, added, skipped, errors, generatedPasswords };
  }

  async importUsers(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
  ): Promise<{ created: number; skipped: number; errors: string[]; generatedPasswords: Array<{ phone: string; password: string }> }> {
    let records: Array<{ name: string; phone: string; email?: string; gradeBook?: string; password?: string; role?: string; isPaid?: boolean }>;

    try {
      if (mimetype === 'application/json' || originalname.endsWith('.json')) {
        records = JSON.parse(buffer.toString('utf-8'));
        if (!Array.isArray(records)) throw new Error('JSON должен быть массивом объектов');
      } else if (
        mimetype === 'application/xml' ||
        mimetype === 'text/xml' ||
        originalname.endsWith('.xml')
      ) {
        records = this.parseXml(buffer.toString('utf-8'));
      } else if (this.isExcel(mimetype, originalname)) {
        // Excel (xlsx): заголовки: ФИО | Номер телефона | Email | Зачётная книжка | Роль | Платное
        // Пароль намеренно не включён — для Excel всегда генерируется автоматически
        const rows = this.readExcelSheet(buffer, 0);
        records = rows
          .map((row) => ({
            name: this.excelStr(row, 'ФИО', 'Имя', 'fullName', 'name'),
            phone: this.excelStr(row, 'Номер телефона', 'Телефон', 'phone'),
            email: this.excelStr(row, 'Email', 'email') || undefined,
            gradeBook: this.excelStr(row, 'Зачётная книжка', 'gradeBook', 'grade_book') || undefined,
            role: this.excelStr(row, 'Роль', 'role') || undefined,
            isPaid: this.excelBool(row, 'Форма обучения', 'Платное', 'isPaid') || undefined,
          }))
          .filter((r) => r.name || r.phone);
      } else {
        throw new BadRequestException('Поддерживаются только JSON, XML и Excel (.xlsx) файлы');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Ошибка разбора файла: ${msg}`);
    }

    // E.164 — тот же формат, что проверяется в DTO при ручном создании
    const PHONE_E164_REGEX = /^\+[1-9]\d{6,14}$/;

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const generatedPasswords: Array<{ phone: string; password: string }> = [];

    for (const rec of records) {
      if (!rec.name || !rec.phone) {
        errors.push(`Пропущена запись: обязательные поля name/phone отсутствуют`);
        skipped++;
        continue;
      }
      if (!PHONE_E164_REGEX.test(rec.phone)) {
        errors.push(`${rec.phone}: номер телефона не соответствует формату E.164 (+71234567890)`);
        skipped++;
        continue;
      }
      const exists = await this.userRepo.findOne({ where: { phone: rec.phone } });
      if (exists) {
        errors.push(`${rec.phone}: номер уже существует, пропущен`);
        skipped++;
        continue;
      }
      const plainPassword = rec.password ?? this.generatePassword();
      const role = Object.values(Role).includes(rec.role as Role) ? (rec.role as Role) : Role.STUDENT;
      const hashed = await bcrypt.hash(plainPassword, 10);
      const user = this.userRepo.create({
        fullName: rec.name,
        phone: rec.phone,
        email: rec.email ?? null,
        gradeBook: rec.gradeBook ?? null,
        password: hashed,
        role,
        isPaid: rec.isPaid ?? false,
      });
      await this.userRepo.save(user);
      if (!rec.password) generatedPasswords.push({ phone: rec.phone, password: plainPassword });
      created++;
    }

    return { created, skipped, errors, generatedPasswords };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async resolveBaseAmount(type: ScholarshipType, direction: string | null): Promise<number> {
    if (type === ScholarshipType.ACADEMIC_COEFF_14 || type === ScholarshipType.ACADEMIC_COEFF_15) {
      const base = await this.baseAmountRepo.findOne({
        where: { type: ScholarshipType.ACADEMIC, direction: IsNull() },
      });
      if (!base) throw new BadRequestException('Базовый размер академической стипендии не задан');
      const coeff = type === ScholarshipType.ACADEMIC_COEFF_14 ? 1.4 : 1.5;
      return Math.round(Number(base.amount) * coeff * 100) / 100;
    }
    const base = await this.baseAmountRepo.findOne({
      where: { type, direction: direction === null ? IsNull() : direction },
    });
    if (!base) {
      throw new BadRequestException(
        `Базовый размер для типа "${type}"${direction ? ` (направление: ${direction})` : ''} не задан. Укажите amount или задайте базовый размер.`,
      );
    }
    return Number(base.amount);
  }

  private async requireUser(id: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');
  }

  private generatePassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '#@$%&';
    const all = upper + lower + digits + special;

    // crypto.randomBytes — криптографически стойкий ГПСЧ (в отличие от Math.random).
    // Берём один случайный байт на каждый символ и применяем modulo-rejection sampling:
    // отбрасываем байты >= floor(256/len)*len, чтобы избежать bias при взятии остатка.
    const pickChar = (charset: string): string => {
      const len = charset.length;
      const limit = Math.floor(256 / len) * len;
      let byte: number;
      do {
        byte = randomBytes(1)[0];
      } while (byte >= limit);
      return charset[byte % len];
    };

    // Гарантируем минимум по одному символу каждого класса
    const base = pickChar(upper) + pickChar(lower) + pickChar(digits) + pickChar(special);
    const rest = Array.from({ length: 6 }, () => pickChar(all)).join('');

    // Перемешиваем криптографически стойко (Fisher-Yates через randomBytes)
    const chars = (base + rest).split('');
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomBytes(1)[0] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  private sanitize(user: User): Omit<User, 'password'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user as User & Record<string, unknown>;
    return rest as Omit<User, 'password'>;
  }

  private parseGroupDisciplinesXml(xml: string): Array<{ groupName: string; disciplines: Array<{ name: string; type?: string }>; semester: number }> {
    const getString = (src: string, tag: string) => {
      const m = src.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
      return m ? m[1].trim() : undefined;
    };

    const items: Array<{ groupName: string; disciplines: Array<{ name: string; type?: string }>; semester: number }> = [];
    const groupBlocks = xml.match(/<group>([\s\S]*?)<\/group>/g) ?? [];

    for (const block of groupBlocks) {
      const groupName = getString(block, 'name');
      const semStr = getString(block, 'semester');
      if (!groupName || !semStr) continue;

      const discMatches = block.match(/<discipline(?:\s[^>]*)?>([\s\S]*?)<\/discipline>/g) ?? [];
      const disciplines: Array<{ name: string; type?: string }> = [];
      for (const d of discMatches) {
        const typeAttr = d.match(/type="([^"]+)"/)?.[1];
        const nameMatch = d.match(/<discipline(?:\s[^>]*)?>([^<]*)<\/discipline>/);
        const name = nameMatch ? nameMatch[1].trim() : '';
        if (name) disciplines.push({ name, type: typeAttr });
      }

      items.push({ groupName, disciplines, semester: Number(semStr) });
    }
    return items;
  }

  private parseGroupXml(xml: string): {
    name: string;
    year: number;
    members: Array<{ phone: string; email?: string; gradeBook?: string; name?: string; password?: string; isPaid?: boolean; role?: string }>;
  } {
    // XML-формат: <group><name>ИВТ-21-1</name><year>2021</year><members>
    //   <member><phone>+71234567890</phone><name>Иванов Иван</name>
    //           <email>ivanov@uni.ru</email><gradeBook>12345</gradeBook><password>pass</password></member>
    // </members></group>
    // phone обязателен (логин), email и gradeBook опциональные
    const getString = (src: string, tag: string) => {
      const m = src.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
      return m ? m[1].trim() : undefined;
    };

    const name = getString(xml, 'name');
    const yearStr = getString(xml, 'year');
    if (!name || !yearStr) throw new Error('Обязательные теги: <name>, <year>');

    const members: Array<{ phone: string; email?: string; gradeBook?: string; name?: string; password?: string; isPaid?: boolean; role?: string }> = [];
    const memberBlocks = xml.match(/<member>([\s\S]*?)<\/member>/g) ?? [];

    for (const block of memberBlocks) {
      const get = (tag: string) => getString(block, tag);
      const phone = get('phone');
      if (phone) {
        members.push({
          phone,
          email: get('email'),
          gradeBook: get('gradeBook') ?? get('grade_book'),
          name: get('name'),
          password: get('password'),
          role: get('role'),
          isPaid: get('isPaid') === 'true',
        });
      }
    }

    return { name, year: Number(yearStr), members };
  }

  // ─── Excel import: groups (flat multi-group format) ──────────────────────

  private async importGroupsFromExcel(buffer: Buffer): Promise<{
    groups: Array<{ id: string; name: string; isNew: boolean }>;
    usersCreated: number;
    usersAdded: number;
    skipped: number;
    errors: string[];
    generatedPasswords: Array<{ phone: string; password: string }>;
  }> {
    // Формат: ФИО | Номер телефона | Зачётная книжка | Email | Группа | Форма обучения (платная/бесплатная)
    const rows = this.readExcelSheet(buffer, 0);
    const PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

    const groupCache = new Map<string, { entity: Group; isNew: boolean }>();
    let usersCreated = 0;
    let usersAdded = 0;
    let skipped = 0;
    const errors: string[] = [];
    const generatedPasswords: Array<{ phone: string; password: string }> = [];

    for (const row of rows) {
      const fullName  = this.excelStr(row, 'ФИО', 'Имя', 'name');
      const phone     = this.excelStr(row, 'Номер телефона', 'Телефон', 'phone');
      const gradeBook = this.excelStr(row, 'Зачётная книжка', 'gradeBook', 'grade_book') || null;
      const email     = this.excelStr(row, 'Email', 'email') || undefined;
      const groupName = this.excelStr(row, 'Группа', 'group', 'groupName');
      const formStr   = this.excelStr(row, 'Форма обучения', 'isPaid').toLowerCase();
      const isPaid    = formStr === 'платная' || formStr === 'платное' || formStr === 'true' || formStr === '1';

      if (!fullName || !phone || !groupName) {
        errors.push('Пропущена строка: нужны ФИО, Номер телефона и Группа');
        skipped++;
        continue;
      }
      if (!PHONE_REGEX.test(phone)) {
        errors.push(`${phone}: не соответствует формату E.164 (+71234567890)`);
        skipped++;
        continue;
      }
      if (!gradeBook) {
        errors.push(`${phone}: не указан номер зачётной книжки (обязателен для студентов)`);
        skipped++;
        continue;
      }

      // Найти или создать группу
      if (!groupCache.has(groupName)) {
        let entity = await this.groupRepo.findOne({ where: { name: groupName } });
        let isNew = false;
        if (!entity) {
          const suffix = groupName.replace(/\s/g, '').slice(-2);
          const parsed = parseInt('20' + suffix, 10);
          const year = isNaN(parsed) || parsed < 2000 || parsed > 2100
            ? new Date().getFullYear()
            : parsed;
          entity = await this.groupRepo.save(
            this.groupRepo.create({ name: groupName, year }),
          );
          isNew = true;
        }
        groupCache.set(groupName, { entity, isNew });
      }
      const { entity: group } = groupCache.get(groupName)!;

      // Найти или создать пользователя
      let user = await this.userRepo.findOne({ where: { phone } });
      if (!user) {
        // Проверить уникальность зачётной книжки
        const gbExists = await this.userRepo.findOne({ where: { gradeBook } });
        if (gbExists) {
          errors.push(`${phone}: зачётная книжка "${gradeBook}" уже занята пользователем ${gbExists.phone}`);
          skipped++;
          continue;
        }
        const plainPassword = this.generatePassword();
        const hashed = await bcrypt.hash(plainPassword, 10);
        user = await this.userRepo.save(
          this.userRepo.create({
            fullName,
            phone,
            email: email ?? null,
            gradeBook,
            password: hashed,
            role: Role.STUDENT,
            isPaid,
          }),
        );
        generatedPasswords.push({ phone, password: plainPassword });
        usersCreated++;
      }

      // Добавить в группу если ещё не состоит
      const count = await this.groupRepo
        .createQueryBuilder('g')
        .innerJoin('g.members', 'm', 'm.id = :uid', { uid: user.id })
        .where('g.id = :gid', { gid: group.id })
        .getCount();

      if (count === 0) {
        await this.groupRepo
          .createQueryBuilder()
          .relation(Group, 'members')
          .of(group.id)
          .add(user.id);
        usersAdded++;
      }
    }

    return {
      groups: Array.from(groupCache.values()).map((v) => ({
        id: v.entity.id,
        name: v.entity.name,
        isNew: v.isNew,
      })),
      usersCreated,
      usersAdded,
      skipped,
      errors,
      generatedPasswords,
    };
  }

  // ─── Excel helpers ────────────────────────────────────────────────────────

  private isExcel(mimetype: string, originalname: string): boolean {
    return (
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      originalname.endsWith('.xlsx')
    );
  }

  private readExcelSheet(buffer: Buffer, sheetIndex = 0): Record<string, unknown>[] {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = wb.SheetNames[sheetIndex];
    if (!sheetName) return [];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: '' });
  }

  private excelStr(row: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
      const v = row[key];
      if (v !== undefined && v !== null && v !== '') return String(v).trim();
    }
    return '';
  }

  private excelBool(row: Record<string, unknown>, ...keys: string[]): boolean {
    const v = this.excelStr(row, ...keys).toLowerCase();
    return v === 'true' || v === '1' || v === 'да' || v === 'yes';
  }

  private excelDate(row: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
      const v = row[key];
      if (!v && v !== 0) continue;
      if (v instanceof Date) return v.toISOString().split('T')[0];
      return String(v).trim();
    }
    return '';
  }

  private parseXml(xml: string): Array<{ name: string; phone: string; email?: string; gradeBook?: string; password?: string; role?: string; isPaid?: boolean }> {
    // Формат XML для импорта пользователей:
    // <users><user><name>...</name><phone>+71234567890</phone><email>...</email>
    //   <gradeBook>12345</gradeBook><password>...</password><role>student</role></user></users>
    const users: Array<{ name: string; phone: string; email?: string; gradeBook?: string; password?: string; role?: string; isPaid?: boolean }> = [];
    const userBlocks = xml.match(/<user>([\s\S]*?)<\/user>/g) ?? [];

    for (const block of userBlocks) {
      const get = (tag: string) => {
        const m = block.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
        return m ? m[1].trim() : undefined;
      };
      const name = get('name');
      const phone = get('phone');
      // phone обязателен — без него запись пропускается
      if (name && phone) {
        users.push({
          name,
          phone,
          email: get('email'),
          gradeBook: get('gradeBook') ?? get('grade_book'),
          password: get('password'),
          role: get('role'),
          isPaid: get('isPaid') === 'true',
        });
      }
    }
    return users;
  }
}
