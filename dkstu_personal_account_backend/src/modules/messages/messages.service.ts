import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { MessageUserStatus } from './entities/message-user-status.entity';
import { User } from '../users/entities/user.entity';
import { Group } from '../groups/entities/group.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { Role } from '../../auth/enums/role.enum';

@Injectable()
export class MessagesService implements OnModuleInit {
  constructor(
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    @InjectRepository(MessageUserStatus) private statusRepo: Repository<MessageUserStatus>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
  ) {}

  async onModuleInit() {
    await this.cleanupOldMessages();
    setInterval(() => this.cleanupOldMessages(), 24 * 60 * 60 * 1000);
  }

  private async cleanupOldMessages(): Promise<void> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    await this.messageRepo.delete({ createdAt: LessThan(cutoff) });
  }

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

  private async getUserGroupIds(userId: string): Promise<string[]> {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.groups', 'g')
      .where('u.id = :userId', { userId })
      .getOne();
    return (user?.groups ?? []).map((g) => g.id);
  }

  private buildInboxQb(userId: string, groupIds: string[]) {
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.group', 'group');

    if (groupIds.length > 0) {
      qb.where('(m.recipientId = :userId OR m.groupId IN (:...groupIds))', { userId, groupIds });
    } else {
      qb.where('m.recipientId = :userId', { userId });
    }
    return qb;
  }

  async getInbox(userId: string): Promise<(Message & { isRelevant: boolean })[]> {
    const groupIds = await this.getUserGroupIds(userId);
    const messages = await this.buildInboxQb(userId, groupIds)
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM message_user_statuses mus
          WHERE mus.message_id = m.id
            AND mus.user_id = :userId
            AND mus.is_relevant = false
        )`,
        { userId },
      )
      .orderBy('m.createdAt', 'DESC')
      .getMany();
    return messages.map((m) => ({ ...m, isRelevant: true }));
  }

  async getIrrelevantInbox(userId: string, page: number, limit: number) {
    const groupIds = await this.getUserGroupIds(userId);
    const [messages, total] = await this.buildInboxQb(userId, groupIds)
      .andWhere(
        `EXISTS (
          SELECT 1 FROM message_user_statuses mus
          WHERE mus.message_id = m.id
            AND mus.user_id = :userId
            AND mus.is_relevant = false
        )`,
        { userId },
      )
      .orderBy('m.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: messages.map((m) => ({ ...m, isRelevant: false })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getSent(senderId: string, page: number, limit: number) {
    const [data, total] = await this.messageRepo.findAndCount({
      where: { senderId },
      relations: { recipient: true, group: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  async getUsers(
    currentUserId: string,
    query?: string,
  ): Promise<{ id: string; fullName: string; role: string; email: string | null }[]> {
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
