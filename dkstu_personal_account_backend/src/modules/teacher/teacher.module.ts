import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherService } from './teacher.service';
import { TeacherController } from './teacher.controller';
import { Group } from '../groups/entities/group.entity';
import { UserGroupRole } from '../groups/entities/user-group-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Group, UserGroupRole])],
  providers: [TeacherService],
  controllers: [TeacherController],
  exports: [TeacherService],
})
export class TeacherModule {}
