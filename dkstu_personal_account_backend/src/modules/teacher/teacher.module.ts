import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherService } from './teacher.service';
import { TeacherController } from './teacher.controller';
import { User } from '../users/entities/user.entity';
import { Group } from '../groups/entities/group.entity';
import { GradeRecord } from '../students/entities/grade-record.entity';
import { UserGroupRole } from '../groups/entities/user-group-role.entity';
import { TeacherAssignment } from './entities/teacher-assignment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Group, GradeRecord, UserGroupRole, TeacherAssignment])],
  providers: [TeacherService],
  controllers: [TeacherController],
  exports: [TeacherService],
})
export class TeacherModule {}
