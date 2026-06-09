import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../groups/entities/group.entity';
import { UserGroupRole } from '../groups/entities/user-group-role.entity';
import { Role } from '../../auth/enums/role.enum';

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(UserGroupRole) private userGroupRoleRepo: Repository<UserGroupRole>,
  ) {}

  async getAllGroups() {
    const groups = await this.groupRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.members', 'm')
      .orderBy('g.name', 'ASC')
      .getMany();

    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      year: group.year,
      memberCount: (group.members ?? []).length,
      studentCount: (group.members ?? []).filter((m) => m.role === Role.STUDENT).length,
    }));
  }

  async getGroupById(groupId: string) {
    const group = await this.groupRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.members', 'm')
      .where('g.id = :groupId', { groupId })
      .getOne();

    if (!group) throw new NotFoundException('Группа не найдена');

    const roleEntries = await this.userGroupRoleRepo.find({ where: { groupId } });

    const members = (group.members ?? [])
      .map((member) => {
        const entry = roleEntries.find((r) => r.userId === member.id);
        return {
          id: member.id,
          fullName: member.fullName,
          email: member.email,
          role: member.role,
          isPaid: member.isPaid,
          groupRole: entry?.label ?? null,
        };
      })
      .sort((a, b) => {
        if (a.role === Role.STUDENT && b.role !== Role.STUDENT) return -1;
        if (a.role !== Role.STUDENT && b.role === Role.STUDENT) return 1;
        return a.fullName.localeCompare(b.fullName, 'ru');
      });

    return {
      id: group.id,
      name: group.name,
      year: group.year,
      members,
    };
  }
}
