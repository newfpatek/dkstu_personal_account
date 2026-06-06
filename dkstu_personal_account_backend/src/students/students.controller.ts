// // src/students/students.controller.ts
// import { Controller, Get, Param, UseGuards } from '@nestjs/common';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';
// import { Role } from '../auth/enums/role.enum';

// @Controller('students')
// @UseGuards(JwtAuthGuard, RolesGuard)
// export class StudentsController {

//   // Только сам студент
//   @Get('me/grades')
//   @Roles(Role.STUDENT)
//   getMyGrades(@Request() req) {
//     return this.studentsService.getGrades(req.user.id);
//   }

//   // Staff и admin — любой студент, только чтение
//   @Get(':id/grades')
//   @Roles(Role.STAFF, Role.ADMIN)
//   getStudentGrades(@Param('id') id: number) {
//     return this.studentsService.getGrades(id);
//   }

//   @Get(':id/scholarship')
//   @Roles(Role.STAFF, Role.ADMIN)
//   getStudentScholarship(@Param('id') id: number) {
//     return this.studentsService.getScholarship(id);
//   }

//   @Get(':id/portfolio')
//   @Roles(Role.STAFF, Role.ADMIN)
//   getStudentPortfolio(@Param('id') id: number) {
//     return this.studentsService.getPortfolio(id);
//   }
// }