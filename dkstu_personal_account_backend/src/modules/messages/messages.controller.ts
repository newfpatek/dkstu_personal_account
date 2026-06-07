import {
  Controller, Post, Get, Patch, Body, Request, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SetMessageStatusDto } from './dto/set-message-status.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  send(@Request() req: any, @Body() dto: SendMessageDto) {
    return this.messagesService.send(req.user.id, dto);
  }

  @Get('users')
  getUsers(@Request() req: any) {
    return this.messagesService.getUsers(req.user.id);
  }

  @Get('groups')
  getGroups(@Request() req: any) {
    return this.messagesService.getGroupsForUser(req.user.id, req.user.role);
  }

  @Get('inbox')
  getInbox(@Request() req: any) {
    return this.messagesService.getInbox(req.user.id);
  }

  @Get('sent')
  getSent(@Request() req: any) {
    return this.messagesService.getSent(req.user.id);
  }

  @Patch(':id/status')
  setStatus(
    @Request() req: any,
    @Param('id') messageId: string,
    @Body() dto: SetMessageStatusDto,
  ) {
    return this.messagesService.setMessageRelevance(req.user.id, messageId, dto.isRelevant);
  }
}
