import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { AdminService } from './admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { SetBaseAmountDto } from './dto/set-base-amount.dto';
import { AssignScholarshipDto } from './dto/assign-scholarship.dto';
import { UpdateScholarshipDto } from './dto/update-scholarship.dto';
import { SetGroupRoleDto } from './dto/set-group-role.dto';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Users ───────────────────────────────────────────────────────────────

  @Post('users/import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importUsers(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { error: 'Файл не загружен' };
    return this.adminService.importUsers(file.buffer, file.mimetype, file.originalname);
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.adminService.createUser(dto);
  }

  @Get('users')
  findAllUsers(@Query('role') role?: Role) {
    return this.adminService.findAllUsers(role);
  }

  @Get('users/:id')
  findUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.findUserById(id);
  }

  @Patch('users/:id')
  updateUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Delete('users/:id')
  deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteUser(id);
  }

  // ─── Groups ──────────────────────────────────────────────────────────────

  @Post('groups')
  createGroup(@Body() dto: CreateGroupDto) {
    return this.adminService.createGroup(dto);
  }

  @Get('groups')
  findAllGroups() {
    return this.adminService.findAllGroups();
  }

  @Get('groups/:id')
  findGroup(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.findGroupById(id);
  }

  @Delete('groups/:id')
  deleteGroup(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteGroup(id);
  }

  @Post('groups/:id/users/:userId')
  addUserToGroup(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.addUserToGroup(groupId, userId);
  }

  @Delete('groups/:id/users/:userId')
  removeUserFromGroup(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.removeUserFromGroup(groupId, userId);
  }

  // POST /api/admin/groups/:id/users/:userId/role — назначить роль в группе
  @Post('groups/:id/users/:userId/role')
  setGroupRole(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SetGroupRoleDto,
  ) {
    return this.adminService.setGroupRole(groupId, userId, dto.label);
  }

  // DELETE /api/admin/groups/:id/users/:userId/role — снять роль в группе
  @Delete('groups/:id/users/:userId/role')
  removeGroupRole(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.removeGroupRole(groupId, userId);
  }

  // ─── Teacher assignments ──────────────────────────────────────────────────

  @Post('teacher-assignments')
  createTeacherAssignment(@Body() dto: CreateTeacherAssignmentDto) {
    return this.adminService.createTeacherAssignment(dto);
  }

  @Get('teacher-assignments')
  getTeacherAssignments(
    @Query('teacherId') teacherId?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.adminService.getTeacherAssignments(teacherId, groupId);
  }

  @Delete('teacher-assignments/:id')
  deleteTeacherAssignment(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteTeacherAssignment(id);
  }

  @Get('disciplines')
  getDisciplines() {
    return this.adminService.getDisciplines();
  }

  // ─── Scholarship base amounts ─────────────────────────────────────────────

  @Get('scholarships/base')
  getBaseAmounts() {
    return this.adminService.getBaseAmounts();
  }

  @Post('scholarships/base')
  setBaseAmount(@Body() dto: SetBaseAmountDto) {
    return this.adminService.setBaseAmount(dto);
  }

  // ─── Student scholarships ─────────────────────────────────────────────────

  @Get('students/:studentId/scholarships')
  getStudentScholarships(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.adminService.getStudentScholarships(studentId);
  }

  @Post('students/:studentId/scholarships')
  assignScholarship(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: AssignScholarshipDto,
  ) {
    return this.adminService.assignScholarship(studentId, dto);
  }

  @Patch('students/:studentId/scholarships/:id')
  updateScholarship(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScholarshipDto,
  ) {
    return this.adminService.updateScholarship(id, dto);
  }

  @Delete('students/:studentId/scholarships/:id')
  deleteScholarship(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteScholarship(id);
  }
}
