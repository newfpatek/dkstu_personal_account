import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
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
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email уже используется');

    const plainPassword = dto.password ?? this.generatePassword();
    const hashed = await bcrypt.hash(plainPassword, 10);
    const user = this.userRepo.create({
      fullName: dto.name,
      email: dto.email,
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

    if (dto.email && dto.email !== user.email) {
      const exists = await this.userRepo.findOne({ where: { email: dto.email } });
      if (exists) throw new ConflictException('Email уже используется');
      user.email = dto.email;
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
      email: string;
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
      } else {
        throw new BadRequestException('Поддерживаются только JSON и XML файлы');
      }
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(`Ошибка разбора файла: ${e instanceof Error ? e.message : String(e)}`);
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const rec of records) {
      if (!rec.email || !rec.type || !rec.periodStart) {
        errors.push('Пропущена запись: обязательные поля email, type, periodStart');
        skipped++;
        continue;
      }

      const student = await this.userRepo.findOne({ where: { email: rec.email } });
      if (!student) {
        errors.push(`${rec.email}: пользователь не найден`);
        skipped++;
        continue;
      }

      if (student.isPaid) {
        errors.push(`${rec.email}: студент на платной основе, стипендия не назначается`);
        skipped++;
        continue;
      }

      const schType = Object.values(ScholarshipType).includes(rec.type as ScholarshipType)
        ? (rec.type as ScholarshipType)
        : null;
      if (!schType) {
        errors.push(`${rec.email}: неизвестный тип стипендии "${rec.type}"`);
        skipped++;
        continue;
      }

      const debtCount = await this.gradeRecordRepo.count({ where: { studentId: student.id, isDebt: true } });
      if (debtCount > 0 && schType !== ScholarshipType.SOCIAL) {
        errors.push(`${rec.email}: у студента есть задолженности — допускается только социальная стипендия`);
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
          errors.push(`${rec.email}: базовый размер для типа "${schType}"${direction ? ` (${direction})` : ''} не задан, укажите amount в файле`);
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
    email: string; type: string; amount?: number;
    periodStart: string; periodEnd?: string; direction?: string;
  }> {
    const records: Array<{
      email: string; type: string; amount?: number;
      periodStart: string; periodEnd?: string; direction?: string;
    }> = [];
    const blocks = xml.match(/<scholarship>([\s\S]*?)<\/scholarship>/g) ?? [];
    for (const block of blocks) {
      const get = (tag: string) => {
        const m = block.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
        return m ? m[1].trim() : undefined;
      };
      const email = get('email');
      const type = get('type');
      const periodStart = get('periodStart');
      if (!email || !type || !periodStart) continue;
      const amountStr = get('amount');
      records.push({
        email, type, periodStart,
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

  async getGradesForGroup(
    groupId: string,
    disciplineId: string,
    semester: number,
    academicYear: string,
  ) {
    const group = await this.groupRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.members', 'm')
      .where('g.id = :groupId', { groupId })
      .getOne();
    if (!group) throw new NotFoundException('Группа не найдена');

    const students = (group.members ?? []).filter((m) => m.role === Role.STUDENT);

    const grades = await this.gradeRecordRepo.find({
      where: { disciplineId, semester, academicYear },
    });
    const gradeMap = new Map(grades.map((g) => [g.studentId, g]));

    return students
      .sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'ru'))
      .map((s) => ({
        studentId: s.id,
        fullName: s.fullName,
        email: s.email,
        gradeRecordId: gradeMap.get(s.id)?.id ?? null,
        gradeValue: gradeMap.get(s.id)?.gradeValue ?? null,
      }));
  }

  async upsertGrades(dto: {
    disciplineId: string;
    semester: number;
    academicYear: string;
    grades: Array<{ studentId: string; gradeValue: string | null }>;
  }): Promise<{ saved: number; cleared: number }> {
    let saved = 0;
    let cleared = 0;

    for (const g of dto.grades) {
      const existing = await this.gradeRecordRepo.findOne({
        where: { studentId: g.studentId, disciplineId: dto.disciplineId, semester: dto.semester, academicYear: dto.academicYear },
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
            academicYear: dto.academicYear,
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
    type GradeEntry = { email: string; grade: string };
    type GradeSet = { groupName: string; disciplineName: string; disciplineType?: string; semester: number; academicYear: string; grades: GradeEntry[] };

    let items: GradeSet[];
    try {
      if (mimetype === 'application/json' || originalname.endsWith('.json')) {
        items = JSON.parse(buffer.toString('utf-8'));
        if (!Array.isArray(items)) throw new Error('JSON должен быть массивом');
      } else if (mimetype === 'application/xml' || mimetype === 'text/xml' || originalname.endsWith('.xml')) {
        items = this.parseGradesXml(buffer.toString('utf-8'));
      } else {
        throw new BadRequestException('Поддерживаются только JSON и XML файлы');
      }
    } catch (e: unknown) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(`Ошибка разбора файла: ${e instanceof Error ? e.message : String(e)}`);
    }

    const validGrades = new Set<string>(Object.values(GradeValue));
    let saved = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of items) {
      const group = await this.groupRepo
        .createQueryBuilder('g')
        .leftJoinAndSelect('g.members', 'm')
        .where('g.name = :name', { name: item.groupName })
        .getOne();
      if (!group) {
        errors.push(`Группа "${item.groupName}" не найдена`);
        skipped += (item.grades ?? []).length;
        continue;
      }

      let discipline = await this.disciplineRepo.findOne({ where: { name: item.disciplineName } });
      if (!discipline) {
        const discType = item.disciplineType === 'pass_fail' ? DisciplineType.PASS_FAIL : DisciplineType.EXAM;
        discipline = await this.disciplineRepo.save(
          this.disciplineRepo.create({ name: item.disciplineName, disciplineType: discType }),
        );
      }

      const studentMap = new Map<string, User>(
        (group.members ?? [])
          .filter((m) => m.role === Role.STUDENT)
          .map((m) => [m.email, m]),
      );

      for (const entry of item.grades ?? []) {
        const student = studentMap.get(entry.email);
        if (!student) {
          errors.push(`Студент "${entry.email}" не найден в группе "${item.groupName}"`);
          skipped++;
          continue;
        }
        if (!validGrades.has(entry.grade)) {
          errors.push(`Неверная оценка "${entry.grade}" для "${entry.email}"`);
          skipped++;
          continue;
        }

        const existing = await this.gradeRecordRepo.findOne({
          where: { studentId: student.id, disciplineId: discipline.id, semester: item.semester, academicYear: item.academicYear },
        });
        if (existing) {
          existing.gradeValue = entry.grade as GradeValue;
          await this.gradeRecordRepo.save(existing);
        } else {
          await this.gradeRecordRepo.save(
            this.gradeRecordRepo.create({
              studentId: student.id,
              disciplineId: discipline.id,
              semester: item.semester,
              academicYear: item.academicYear,
              gradeValue: entry.grade as GradeValue,
            }),
          );
        }
        saved++;
      }
    }

    return { saved, skipped, errors };
  }

  private parseGradesXml(xml: string): Array<{
    groupName: string; disciplineName: string; disciplineType?: string;
    semester: number; academicYear: string; grades: Array<{ email: string; grade: string }>;
  }> {
    const getString = (src: string, tag: string) => {
      const m = src.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
      return m ? m[1].trim() : undefined;
    };

    const items: ReturnType<typeof this.parseGradesXml> = [];
    const entryBlocks = xml.match(/<entry>([\s\S]*?)<\/entry>/g) ?? [];

    for (const block of entryBlocks) {
      const groupName = getString(block, 'groupName');
      const disciplineName = getString(block, 'disciplineName');
      const disciplineType = getString(block, 'disciplineType');
      const semStr = getString(block, 'semester');
      const academicYear = getString(block, 'academicYear');
      if (!groupName || !disciplineName || !semStr || !academicYear) continue;

      const gradeBlocks = block.match(/<grade>([\s\S]*?)<\/grade>/g) ?? [];
      const grades: Array<{ email: string; grade: string }> = [];
      for (const g of gradeBlocks) {
        const email = getString(g, 'email');
        const grade = getString(g, 'value');
        if (email && grade) grades.push({ email, grade });
      }

      items.push({ groupName, disciplineName, disciplineType, semester: Number(semStr), academicYear, grades });
    }
    return items;
  }

  // ─── Group semester disciplines ───────────────────────────────────────────

  async assignGroupDisciplines(dto: AssignGroupDisciplinesDto): Promise<{ assigned: number; skipped: number }> {
    const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
    if (!group) throw new NotFoundException('Группа не найдена');

    // Если для группы есть записи другого семестра/года — удаляем их (один активный семестр на группу)
    await this.groupSemDisciplineRepo
      .createQueryBuilder()
      .delete()
      .where('group_id = :groupId', { groupId: dto.groupId })
      .andWhere('(semester != :semester OR academic_year != :academicYear)', {
        semester: dto.semester,
        academicYear: dto.academicYear,
      })
      .execute();

    let assigned = 0;
    let skipped = 0;

    for (const disciplineId of dto.disciplineIds) {
      const discipline = await this.disciplineRepo.findOne({ where: { id: disciplineId } });
      if (!discipline) { skipped++; continue; }

      const exists = await this.groupSemDisciplineRepo.findOne({
        where: { groupId: dto.groupId, disciplineId, semester: dto.semester, academicYear: dto.academicYear },
      });
      if (exists) { skipped++; continue; }

      await this.groupSemDisciplineRepo.save(
        this.groupSemDisciplineRepo.create({
          groupId: dto.groupId, disciplineId,
          semester: dto.semester, academicYear: dto.academicYear,
        }),
      );
      assigned++;
    }

    return { assigned, skipped };
  }

  async getGroupSemesterDisciplines(groupId: string, semester?: number, academicYear?: string): Promise<GroupSemesterDiscipline[]> {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Группа не найдена');

    const qb = this.groupSemDisciplineRepo
      .createQueryBuilder('gsd')
      .leftJoinAndSelect('gsd.discipline', 'discipline')
      .where('gsd.groupId = :groupId', { groupId });

    if (semester !== undefined) qb.andWhere('gsd.semester = :semester', { semester });
    if (academicYear) qb.andWhere('gsd.academicYear = :academicYear', { academicYear });

    return qb.orderBy('gsd.academicYear', 'DESC').addOrderBy('gsd.semester', 'DESC').addOrderBy('discipline.name', 'ASC').getMany();
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
    type GroupItem = { groupName: string; disciplines: DisciplineEntry[]; semester: number; academicYear: string };

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
      } else {
        throw new BadRequestException('Поддерживаются только JSON и XML файлы');
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
          where: { groupId: group.id, disciplineId: discipline.id, semester: item.semester, academicYear: item.academicYear },
        });
        if (exists) { skipped++; continue; }

        await this.groupSemDisciplineRepo.save(
          this.groupSemDisciplineRepo.create({
            groupId: group.id, disciplineId: discipline.id,
            semester: item.semester, academicYear: item.academicYear,
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
  ): Promise<{ group: { id: string; name: string }; created: number; added: number; skipped: number; errors: string[]; generatedPasswords: Array<{ email: string; password: string }> }> {
    let groupData: {
      name: string;
      year: number;
      members?: Array<{ email: string; name?: string; password?: string; isPaid?: boolean; role?: string }>;
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
        throw new BadRequestException('Поддерживаются только JSON и XML файлы');
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

    let created = 0;
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];
    const members: User[] = [];
    const generatedPasswords: Array<{ email: string; password: string }> = [];

    for (const rec of groupData.members ?? []) {
      if (!rec.email) {
        errors.push('Пропущена запись: отсутствует email');
        skipped++;
        continue;
      }

      let user = await this.userRepo.findOne({ where: { email: rec.email } });
      if (!user) {
        if (!rec.name) {
          errors.push(`${rec.email}: пользователь не найден, нужно поле name для создания`);
          skipped++;
          continue;
        }
        const plainPassword = rec.password ?? this.generatePassword();
        const role = Object.values(Role).includes(rec.role as Role) ? (rec.role as Role) : Role.STUDENT;
        const hashed = await bcrypt.hash(plainPassword, 10);
        user = await this.userRepo.save(
          this.userRepo.create({
            fullName: rec.name,
            email: rec.email,
            password: hashed,
            role,
            isPaid: rec.isPaid ?? false,
          }),
        );
        if (!rec.password) generatedPasswords.push({ email: rec.email, password: plainPassword });
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
  ): Promise<{ created: number; skipped: number; errors: string[]; generatedPasswords: Array<{ email: string; password: string }> }> {
    let records: Array<{ name: string; email: string; password?: string; role?: string; isPaid?: boolean }>;

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
      } else {
        throw new BadRequestException('Поддерживаются только JSON и XML файлы');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(`Ошибка разбора файла: ${msg}`);
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    const generatedPasswords: Array<{ email: string; password: string }> = [];

    for (const rec of records) {
      if (!rec.name || !rec.email) {
        errors.push(`Пропущена запись: обязательные поля name/email отсутствуют`);
        skipped++;
        continue;
      }
      const exists = await this.userRepo.findOne({ where: { email: rec.email } });
      if (exists) {
        errors.push(`${rec.email}: email уже существует, пропущен`);
        skipped++;
        continue;
      }
      const plainPassword = rec.password ?? this.generatePassword();
      const role = Object.values(Role).includes(rec.role as Role) ? (rec.role as Role) : Role.STUDENT;
      const hashed = await bcrypt.hash(plainPassword, 10);
      const user = this.userRepo.create({
        fullName: rec.name,
        email: rec.email,
        password: hashed,
        role,
        isPaid: rec.isPaid ?? false,
      });
      await this.userRepo.save(user);
      if (!rec.password) generatedPasswords.push({ email: rec.email, password: plainPassword });
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
    const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
    const base = rand(upper) + rand(lower) + rand(digits) + rand(special);
    const rest = Array.from({ length: 6 }, () => rand(all)).join('');
    return (base + rest).split('').sort(() => Math.random() - 0.5).join('');
  }

  private sanitize(user: User): Omit<User, 'password'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user as User & Record<string, unknown>;
    return rest as Omit<User, 'password'>;
  }

  private parseGroupDisciplinesXml(xml: string): Array<{ groupName: string; disciplines: Array<{ name: string; type?: string }>; semester: number; academicYear: string }> {
    const getString = (src: string, tag: string) => {
      const m = src.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
      return m ? m[1].trim() : undefined;
    };

    const items: Array<{ groupName: string; disciplines: Array<{ name: string; type?: string }>; semester: number; academicYear: string }> = [];
    const groupBlocks = xml.match(/<group>([\s\S]*?)<\/group>/g) ?? [];

    for (const block of groupBlocks) {
      const groupName = getString(block, 'name');
      const semStr = getString(block, 'semester');
      const academicYear = getString(block, 'academicYear');
      if (!groupName || !semStr || !academicYear) continue;

      const discMatches = block.match(/<discipline(?:\s[^>]*)?>([\s\S]*?)<\/discipline>/g) ?? [];
      const disciplines: Array<{ name: string; type?: string }> = [];
      for (const d of discMatches) {
        const typeAttr = d.match(/type="([^"]+)"/)?.[1];
        const nameMatch = d.match(/<discipline(?:\s[^>]*)?>([^<]*)<\/discipline>/);
        const name = nameMatch ? nameMatch[1].trim() : '';
        if (name) disciplines.push({ name, type: typeAttr });
      }

      items.push({ groupName, disciplines, semester: Number(semStr), academicYear });
    }
    return items;
  }

  private parseGroupXml(xml: string): {
    name: string;
    year: number;
    members: Array<{ email: string; name?: string; password?: string; isPaid?: boolean; role?: string }>;
  } {
    const getString = (src: string, tag: string) => {
      const m = src.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
      return m ? m[1].trim() : undefined;
    };

    const name = getString(xml, 'name');
    const yearStr = getString(xml, 'year');
    if (!name || !yearStr) throw new Error('Обязательные теги: <name>, <year>');

    const members: Array<{ email: string; name?: string; password?: string; isPaid?: boolean; role?: string }> = [];
    const memberBlocks = xml.match(/<member>([\s\S]*?)<\/member>/g) ?? [];

    for (const block of memberBlocks) {
      const get = (tag: string) => getString(block, tag);
      const email = get('email');
      if (email) {
        members.push({
          email,
          name: get('name'),
          password: get('password'),
          role: get('role'),
          isPaid: get('isPaid') === 'true',
        });
      }
    }

    return { name, year: Number(yearStr), members };
  }

  private parseXml(xml: string): Array<{ name: string; email: string; password: string; role?: string }> {
    const users: Array<{ name: string; email: string; password: string; role?: string }> = [];
    const userBlocks = xml.match(/<user>([\s\S]*?)<\/user>/g) ?? [];

    for (const block of userBlocks) {
      const get = (tag: string) => {
        const m = block.match(new RegExp(`<${tag}>(.*?)<\\/${tag}>`));
        return m ? m[1].trim() : undefined;
      };
      const name = get('name');
      const email = get('email');
      const password = get('password');
      if (name && email && password) {
        users.push({ name, email, password, role: get('role') });
      }
    }
    return users;
  }
}
