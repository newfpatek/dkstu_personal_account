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
import { Role } from '../../auth/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,
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
    return { message: 'Пользователь удалён из группы' };
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
