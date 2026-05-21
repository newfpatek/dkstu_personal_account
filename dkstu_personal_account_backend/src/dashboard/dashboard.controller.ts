import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('dashboard')
export class DashboardController {

  // Только для student
  @UseGuards(JwtAuthGuard)
  @Roles('student')
  @Get('student')
  getStudentPage(@Request() req) {
    return {
      message: 'Добро пожаловать в личный кабинет!',
      user: req.user,
    };
  }

  // Только для teacher
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('teacher')
  @Get('teacher')
  getTeacherPage() {
    return { message: 'Кабинет преподавателя' };
  }

  // Только для admin
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin')
  getAdminPage() {
    return { message: 'Панель администратора' };
  }
}