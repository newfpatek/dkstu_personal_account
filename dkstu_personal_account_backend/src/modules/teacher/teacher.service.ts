import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Group } from '../groups/entities/group.entity';
import { GradeRecord } from '../students/entities/grade-record.entity';
import { UserGroupRole } from '../groups/entities/user-group-role.entity';
import { TeacherAssignment } from './entities/teacher-assignment.entity';
import { Role } from '../../auth/enums/role.enum';

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Group) private groupRepo: Repository<Group>,
    @InjectRepository(GradeRecord) private gradeRepo: Repository<GradeRecord>,
    @InjectRepository(UserGroupRole) private userGroupRoleRepo: Repository<UserGroupRole>,
    @InjectRepository(TeacherAssignment) private assignmentRepo: Repository<TeacherAssignment>,
  ) {}

  async getMyGroups(teacherId: string) {
    const assignments = await this.assignmentRepo.find({
      where: { teacherId },
      relations: { group: { members: true }, discipline: true },
    });

    if (assignments.length === 0) return [];

    const groupMap = new Map<string, { group: Group; disciplines: Set<string> }>();
    for (const a of assignments) {
      if (!groupMap.has(a.groupId)) {
        groupMap.set(a.groupId, { group: a.group, disciplines: new Set() });
      }
      groupMap.get(a.groupId)!.disciplines.add(a.discipline.name);
    }

    const groupIds = [...groupMap.keys()];
    const roleEntries = groupIds.length > 0
      ? await this.userGroupRoleRepo.find({ where: { groupId: In(groupIds) } })
      : [];

    return [...groupMap.values()].map(({ group, disciplines }) => {
      const students = (group.members ?? []).filter((m) => m.role === Role.STUDENT);
      return {
        id: group.id,
        name: group.name,
        year: group.year,
        studentCount: students.length,
        disciplines: [...disciplines],
        members: students
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
      };
    });
  }

  async getGroupStudents(teacherId: string, groupId: string) {
    const hasAccess = await this.assignmentRepo.findOne({ where: { teacherId, groupId } });
    if (!hasAccess) throw new ForbiddenException('У вас нет доступа к этой группе');

    const group = await this.groupRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.members', 'm')
      .where('g.id = :groupId', { groupId })
      .getOne();

    if (!group) throw new NotFoundException('Группа не найдена');

    const students = (group.members ?? []).filter((m) => m.role === Role.STUDENT);

    if (students.length === 0) {
      return {
        group: { id: group.id, name: group.name, year: group.year },
        students: [],
      };
    }

    const studentIds = students.map((s) => s.id);

    const gradeStats = await this.gradeRepo
      .createQueryBuilder('gr')
      .select('gr.studentId', 'studentId')
      .addSelect('COUNT(gr.id)', 'total')
      .addSelect('SUM(CASE WHEN gr.isDebt = true THEN 1 ELSE 0 END)', 'debts')
      .where('gr.studentId IN (:...studentIds)', { studentIds })
      .groupBy('gr.studentId')
      .getRawMany();

    const statsMap = new Map(
      gradeStats.map((s) => [
        s.studentId,
        { total: parseInt(s.total, 10), debts: parseInt(s.debts, 10) },
      ]),
    );

    const roleEntries = await this.userGroupRoleRepo.find({ where: { groupId } });

    return {
      group: { id: group.id, name: group.name, year: group.year },
      students: students
        .map((student) => {
          const stats = statsMap.get(student.id) ?? { total: 0, debts: 0 };
          const entry = roleEntries.find((r) => r.userId === student.id);
          return {
            id: student.id,
            fullName: student.fullName,
            isPaid: student.isPaid,
            groupRole: entry?.label ?? null,
            totalGrades: stats.total,
            debtCount: stats.debts,
          };
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru')),
    };
  }

  async getMyAssignableGroups(teacherId: string): Promise<{ id: string; name: string }[]> {
    const assignments = await this.assignmentRepo.find({
      where: { teacherId },
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
}
