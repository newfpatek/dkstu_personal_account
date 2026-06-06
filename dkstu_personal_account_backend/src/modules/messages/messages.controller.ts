import {
  Controller, Post, Get, Body, Request,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';

@Controller('messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // POST /api/messages — отправить сообщение (teacher, staff)
  @Post()
  @Roles(Role.TEACHER, Role.STAFF)
  @HttpCode(HttpStatus.CREATED)
  send(@Request() req: any, @Body() dto: SendMessageDto) {
    return this.messagesService.send(req.user.id, dto);
  }

  // GET /api/messages/inbox — входящие сообщения (student)
  @Get('inbox')
  @Roles(Role.STUDENT)
  getInbox(@Request() req: any) {
    return this.messagesService.getInbox(req.user.id);
  }

  // GET /api/messages/sent — исходящие (teacher, staff)
  @Get('sent')
  @Roles(Role.TEACHER, Role.STAFF)
  getSent(@Request() req: any) {
    return this.messagesService.getSent(req.user.id);
  }
}
