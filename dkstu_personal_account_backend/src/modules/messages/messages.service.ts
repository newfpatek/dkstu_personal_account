import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { MessageUserStatus } from './entities/message-user-status.entity';
import { User } from '../users/entities/user.entity';
import { Group } from '../groups/entities/group.entity';
import { TeacherAssignment } from '../teacher/entities/teacher-assignment.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { Role } from '../../auth/enums/role.enum';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    @InjectRepository(MessageUserStatus) private statusRepo: Repository<MessageUserStatus>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(TeacherAssignment) private assignmentRepo: Repository<TeacherAssignment>,
  ) {}

  async send(senderId: string, dto: SendMessageDto): Promise<Message> {
    if (!dto.groupId && !dto.studentId) {
      throw new BadRequestException('Укажите groupId или studentId');
    }
    if (dto.groupId && dto.studentId) {
      throw new BadRequestException('Укажите либо groupId, либо studentId, но не оба');
    }

    const message = this.messageRepo.create({
      senderId,
      groupId: dto.groupId ?? null,
      recipientId: dto.studentId ?? null,
      text: dto.text,
    });
    return this.messageRepo.save(message);
  }

  async getInbox(userId: string): Promise<(Message & { isRelevant: boolean })[]> {
    const userWithGroups = await this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.groups', 'g')
      .where('u.id = :userId', { userId })
      .getOne();

    const groupIds = (userWithGroups?.groups ?? []).map((g) => g.id);

    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.group', 'group')
      .where('m.recipientId = :userId', { userId });

    if (groupIds.length > 0) {
      qb.orWhere('m.groupId IN (:...groupIds)', { groupIds });
    }

    const messages = await qb.orderBy('m.createdAt', 'DESC').getMany();

    if (messages.length === 0) return [];

    const messageIds = messages.map((m) => m.id);
    const statuses = await this.statusRepo
      .createQueryBuilder('s')
      .where('s.userId = :userId', { userId })
      .andWhere('s.messageId IN (:...messageIds)', { messageIds })
      .getMany();

    const statusMap = new Map(statuses.map((s) => [s.messageId, s.isRelevant]));

    return messages.map((m) => ({
      ...m,
      isRelevant: statusMap.has(m.id) ? statusMap.get(m.id)! : true,
    }));
  }

  async getSent(senderId: string): Promise<Message[]> {
    return this.messageRepo.find({
      where: { senderId },
      relations: { recipient: true, group: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getUsers(
    currentUserId: string,
    query?: string,
  ): Promise<{ id: string; fullName: string; role: string; email: string }[]> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.fullName', 'u.role', 'u.email'])
      .where('u.id != :currentUserId', { currentUserId });

    if (query?.trim()) {
      qb.andWhere(
        '(u.name ILIKE :q OR u.email ILIKE :q)',
        { q: `%${query.trim()}%` },
      );
    }

    return qb.orderBy('u.fullName', 'ASC').limit(10).getMany();
  }

  async getGroupsForUser(
    userId: string,
    role: Role,
    query?: string,
  ): Promise<{ id: string; name: string; year: number }[]> {
    let groups: { id: string; name: string; year: number }[];

    if (role === Role.STUDENT) {
      const user = await this.userRepo
        .createQueryBuilder('u')
        .leftJoinAndSelect('u.groups', 'g')
        .where('u.id = :userId', { userId })
        .getOne();
      groups = (user?.groups ?? []).map((g) => ({ id: g.id, name: g.name, year: g.year }));
    } else {
      const all = await this.groupRepo.find({ order: { name: 'ASC' } });
      groups = all.map((g) => ({ id: g.id, name: g.name, year: g.year }));
    }

    if (query?.trim()) {
      const q = query.trim().toLowerCase();
      groups = groups.filter((g) => g.name.toLowerCase().includes(q));
    }

    return groups.sort((a, b) => a.name.localeCompare(b.name, 'ru')).slice(0, 10);
  }

  async searchCombined(currentUserId: string, role: Role, query: string) {
    if (!query?.trim() || query.trim().length < 2) return [];

    const [users, groups] = await Promise.all([
      this.getUsers(currentUserId, query),
      role !== Role.STUDENT
        ? this.getGroupsForUser(currentUserId, role, query)
        : Promise.resolve([]),
    ]);

    return [
      ...users.map((u) => ({
        type: 'user' as const,
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
      })),
      ...groups.map((g) => ({
        type: 'group' as const,
        id: g.id,
        name: g.name,
        year: g.year,
      })),
    ];
  }

  async setMessageRelevance(userId: string, messageId: string, isRelevant: boolean) {
    const existing = await this.statusRepo.findOne({ where: { userId, messageId } });
    if (existing) {
      existing.isRelevant = isRelevant;
      await this.statusRepo.save(existing);
    } else {
      await this.statusRepo.save(
        this.statusRepo.create({ userId, messageId, isRelevant }),
      );
    }
    return { success: true };
  }
}
