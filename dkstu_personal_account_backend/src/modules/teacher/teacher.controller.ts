import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';

@Controller('teacher')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get('groups')
  @Roles(Role.TEACHER, Role.STAFF)
  getAllGroups() {
    return this.teacherService.getAllGroups();
  }

  @Get('groups/:id')
  @Roles(Role.TEACHER, Role.STAFF)
  getGroupById(@Param('id') id: string) {
    return this.teacherService.getGroupById(id);
  }
}
