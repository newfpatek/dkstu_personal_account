import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { User } from '../users/entities/user.entity';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    @InjectRepository(User) private userRepo: Repository<User>,
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

  async getInbox(studentId: string): Promise<Message[]> {
    const student = await this.userRepo.findOne({
      where: { id: studentId },
      relations: { groups: true },
    });
    if (!student) throw new NotFoundException('Пользователь не найден');

    const groupIds = (student.groups ?? []).map((g) => g.id);

    // Сообщения адресованные напрямую студенту + сообщения в его группы
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.group', 'group')
      .where('m.recipientId = :studentId', { studentId });

    if (groupIds.length > 0) {
      qb.orWhere('m.groupId IN (:...groupIds)', { groupIds });
    }

    return qb.orderBy('m.createdAt', 'DESC').getMany();
  }

  async getSent(senderId: string): Promise<Message[]> {
    return this.messageRepo.find({
      where: { senderId },
      relations: { recipient: true, group: true },
      order: { createdAt: 'DESC' },
    });
  }
}
