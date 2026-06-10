import {
  Controller, Post, Get, Patch, Body, Request, Param, Query,
  UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
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
  getUsers(@Request() req: any, @Query('q') q?: string) {
    return this.messagesService.getUsers(req.user.id, q);
  }

  @Get('groups')
  getGroups(@Request() req: any, @Query('q') q?: string) {
    return this.messagesService.getGroupsForUser(req.user.id, req.user.role, q);
  }

  @Get('search')
  search(@Request() req: any, @Query('q') q = '') {
    return this.messagesService.searchCombined(req.user.id, req.user.role, q);
  }

  @Get('inbox/irrelevant')
  getIrrelevantInbox(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit ?? '10', 10) || 10));
    return this.messagesService.getIrrelevantInbox(req.user.id, p, l);
  }

  @Get('inbox')
  getInbox(@Request() req: any) {
    return this.messagesService.getInbox(req.user.id);
  }

  @Get('sent')
  getSent(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit ?? '10', 10) || 10));
    return this.messagesService.getSent(req.user.id, p, l);
  }

  @Patch(':id/status')
  setStatus(
    @Request() req: any,
    // ParseUUIDPipe: без него PostgreSQL бросает 500 при невалидном UUID вместо 400.
    // Это утечка деталей реализации и лишняя нагрузка на БД.
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body() dto: SetMessageStatusDto,
  ) {
    return this.messagesService.setMessageRelevance(req.user.id, messageId, dto.isRelevant);
  }
}
