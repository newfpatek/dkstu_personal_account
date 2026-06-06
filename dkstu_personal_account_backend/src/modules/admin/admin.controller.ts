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

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Users ───────────────────────────────────────────────────────────────

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

  @Post('users/import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importUsers(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { error: 'Файл не загружен' };
    }
    return this.adminService.importUsers(file.buffer, file.mimetype, file.originalname);
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

  // ─── Group membership ────────────────────────────────────────────────────

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
}
