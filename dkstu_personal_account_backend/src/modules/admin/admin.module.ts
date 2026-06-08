import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Group } from '../groups/entities/group.entity';
import { Scholarship } from '../students/entities/scholarship.entity';
import { ScholarshipBaseAmount } from '../students/entities/scholarship-base-amount.entity';
import { GradeRecord } from '../students/entities/grade-record.entity';
import { UserGroupRole } from '../groups/entities/user-group-role.entity';
import { GroupSemesterDiscipline } from '../groups/entities/group-semester-discipline.entity';
import { TeacherAssignment } from '../teacher/entities/teacher-assignment.entity';
import { Discipline } from '../students/entities/discipline.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([
    User, Group, Scholarship, ScholarshipBaseAmount, GradeRecord, UserGroupRole, GroupSemesterDiscipline, TeacherAssignment, Discipline,
  ])],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
