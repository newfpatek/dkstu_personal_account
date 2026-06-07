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

  async getUsers(currentUserId: string): Promise<Pick<User, 'id' | 'fullName' | 'role'>[]> {
    return this.userRepo.find({
      where: { id: Not(currentUserId) },
      select: { id: true, fullName: true, role: true },
      order: { fullName: 'ASC' },
    });
  }

  async getGroupsForUser(userId: string, role: Role): Promise<{ id: string; name: string }[]> {
    if (role === Role.STUDENT) {
      const user = await this.userRepo
        .createQueryBuilder('u')
        .leftJoinAndSelect('u.groups', 'g')
        .where('u.id = :userId', { userId })
        .getOne();
      return (user?.groups ?? [])
        .map((g) => ({ id: g.id, name: g.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }

    if (role === Role.TEACHER) {
      const assignments = await this.assignmentRepo.find({
        where: { teacherId: userId },
        relations: { group: true },
      });
      const seen = new Set<string>();
      const result: { id: string; name: string }[] = [];
      for (const a of assignments) {
        if (!seen.has(a.groupId)) {
          seen.add(a.groupId);
          result.push({ id: a.group.id, name: a.group.name });
        }
      }
      return result.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }

    // STAFF and ADMIN see all groups
    const groups = await this.groupRepo.find({ order: { name: 'ASC' } });
    return groups.map((g) => ({ id: g.id, name: g.name }));
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
