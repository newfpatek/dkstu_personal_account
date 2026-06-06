// src/dashboard/dashboard.controller.ts
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)  // вешаем оба guard'а сразу на весь контроллер
export class DashboardController {

  @Roles(Role.STUDENT)
  @Get('student')
  getStudentPage(@Request() req) {
    return {
      message: 'Добро пожаловать в личный кабинет!',
      user: req.user,
    };
  }

  @Roles(Role.TEACHER)
  @Get('teacher')
  getTeacherPage() {
    return { message: 'Кабинет преподавателя' };
  }

  @Roles(Role.ADMIN)
  @Get('admin')
  getAdminPage() {
    return { message: 'Панель администратора' };
  }

  @Roles(Role.STAFF)
  @Get('staff')
  getStaffPage() {
    return { message: 'Кабинет сотрудника' };
  }
}