import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
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
  getMyGroups(@Request() req) {
    return this.teacherService.getMyGroups(req.user.id);
  }

  @Get('groups/:id/students')
  getGroupStudents(@Request() req, @Param('id') groupId: string) {
    return this.teacherService.getGroupStudents(req.user.id, groupId);
  }
}
