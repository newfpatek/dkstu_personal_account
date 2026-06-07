import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Group } from '../groups/entities/group.entity';
import { Scholarship } from '../students/entities/scholarship.entity';
import { ScholarshipBaseAmount } from '../students/entities/scholarship-base-amount.entity';
import { UserGroupRole } from '../groups/entities/user-group-role.entity';
import { TeacherAssignment } from '../teacher/entities/teacher-assignment.entity';
import { Discipline } from '../students/entities/discipline.entity';
import { Role } from '../../auth/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { SetBaseAmountDto } from './dto/set-base-amount.dto';
import { AssignScholarshipDto } from './dto/assign-scholarship.dto';
import { UpdateScholarshipDto } from './dto/update-scholarship.dto';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
    @InjectRepository(Scholarship)
    private readonly scholarshipRepo: Repository<Scholarship>,
    @InjectRepository(ScholarshipBaseAmount)
    private readonly baseAmountRepo: Repository<ScholarshipBaseAmount>,
    @InjectRepository(UserGroupRole)
    private readonly userGroupRoleRepo: Repository<UserGroupRole>,
    @InjectRepository(TeacherAssignment)
    private readonly teacherAssignmentRepo: Repository<TeacherAssignment>,
    @InjectRepository(Discipline)
    private readonly disciplineRepo: Repository<Discipline>,
  ) {}

  // ─── Users ───────────────────────────────────────────────────────────────

  async createUser(dto: CreateUserDto): Promise<Omit<User, 'password'>> {
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email уже используется');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      fullName: dto.name,
      email: dto.email,
      password: hashed,
      role: dto.role ?? Role.STUDENT,
      isPaid: dto.isPaid ?? false,
    });
    await this.userRepo.save(user);
    return this.sanitize(user);
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

  async findAllGroups(): Promise<Group[]> {
    return this.groupRepo.find({
      relations: { members: true },
      order: { name: 'ASC' },
    });
  }

  async findGroupById(id: string): Promise<Group> {
    const group = await this.groupRepo.findOne({ where: { id }, relations: { members: true } });
    if (!group) throw new NotFoundException('Группа не найдена');
    return group;
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
    let record = await this.baseAmountRepo.findOne({ where: { type: dto.type } });
    if (record) {
      record.amount = dto.amount;
    } else {
      record = this.baseAmountRepo.create({ type: dto.type, amount: dto.amount });
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
    await this.requireUser(studentId);

    let amount = dto.amount;
    if (amount === undefined) {
      const base = await this.baseAmountRepo.findOne({ where: { type: dto.type } });
      if (!base) {
        throw new BadRequestException(
          `Базовый размер для типа "${dto.type}" не задан. Укажите amount или сначала задайте базовый размер.`,
        );
      }
      amount = Number(base.amount);
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

  async updateScholarship(id: string, dto: UpdateScholarshipDto): Promise<Scholarship> {
    const record = await this.scholarshipRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Запись о стипендии не найдена');

    if (dto.amount !== undefined) record.amount = dto.amount;
    if (dto.direction !== undefined) record.direction = dto.direction;
    if (dto.periodStart !== undefined) record.periodStart = dto.periodStart;
    if (dto.periodEnd !== undefined) record.periodEnd = dto.periodEnd;
    if (dto.isActive !== undefined) record.isActive = dto.isActive;

    return this.scholarshipRepo.save(record);
  }

  async deleteScholarship(id: string): Promise<{ message: string }> {
    const record = await this.scholarshipRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Запись о стипендии не найдена');
    await this.scholarshipRepo.remove(record);
    return { message: 'Запись о стипендии удалена' };
  }

  // ─── Teacher assignments ──────────────────────────────────────────────────

  async createTeacherAssignment(dto: CreateTeacherAssignmentDto): Promise<TeacherAssignment> {
    const teacher = await this.userRepo.findOne({ where: { id: dto.teacherId } });
    if (!teacher) throw new NotFoundException('Преподаватель не найден');
    if (teacher.role !== Role.TEACHER) {
      throw new BadRequestException('Пользователь не является преподавателем');
    }

    const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
    if (!group) throw new NotFoundException('Группа не найдена');

    const discipline = await this.disciplineRepo.findOne({ where: { id: dto.disciplineId } });
    if (!discipline) throw new NotFoundException('Дисциплина не найдена');

    const existing = await this.teacherAssignmentRepo.findOne({
      where: {
        teacherId: dto.teacherId,
        groupId: dto.groupId,
        disciplineId: dto.disciplineId,
        semester: dto.semester,
        academicYear: dto.academicYear,
      },
    });
    if (existing) throw new ConflictException('Такое назначение уже существует');

    const assignment = this.teacherAssignmentRepo.create({
      teacherId: dto.teacherId,
      groupId: dto.groupId,
      disciplineId: dto.disciplineId,
      semester: dto.semester,
      academicYear: dto.academicYear,
    });
    return this.teacherAssignmentRepo.save(assignment);
  }

  async getTeacherAssignments(teacherId?: string, groupId?: string): Promise<TeacherAssignment[]> {
    const where: Record<string, string> = {};
    if (teacherId) where.teacherId = teacherId;
    if (groupId) where.groupId = groupId;
    return this.teacherAssignmentRepo.find({
      where,
      relations: { teacher: true, group: true, discipline: true },
      order: { academicYear: 'DESC', semester: 'ASC' },
    });
  }

  async deleteTeacherAssignment(id: string): Promise<{ message: string }> {
    const record = await this.teacherAssignmentRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Назначение не найдено');
    await this.teacherAssignmentRepo.remove(record);
    return { message: 'Назначение удалено' };
  }

  async getDisciplines() {
    return this.disciplineRepo.find({ order: { name: 'ASC' } });
  }

  // ─── Import ───────────────────────────────────────────────────────────────

  async importUsers(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    let records: Array<{ name: string; email: string; password: string; role?: string; isPaid?: boolean }>;

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

    for (const rec of records) {
      if (!rec.name || !rec.email || !rec.password) {
        errors.push(`Пропущена запись: обязательные поля name/email/password отсутствуют`);
        skipped++;
        continue;
      }
      const exists = await this.userRepo.findOne({ where: { email: rec.email } });
      if (exists) {
        errors.push(`${rec.email}: email уже существует, пропущен`);
        skipped++;
        continue;
      }
      const role = Object.values(Role).includes(rec.role as Role) ? (rec.role as Role) : Role.STUDENT;
      const hashed = await bcrypt.hash(rec.password, 10);
      const user = this.userRepo.create({
        fullName: rec.name,
        email: rec.email,
        password: hashed,
        role,
        isPaid: rec.isPaid ?? false,
      });
      await this.userRepo.save(user);
      created++;
    }

    return { created, skipped, errors };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async requireUser(id: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');
  }

  private sanitize(user: User): Omit<User, 'password'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user as User & Record<string, unknown>;
    return rest as Omit<User, 'password'>;
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
