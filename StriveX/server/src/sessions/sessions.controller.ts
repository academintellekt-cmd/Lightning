import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { RequireKey } from '../auth/decorators';
import { SessionsService } from './sessions.service';

class BindSessionDto {
  @IsString() user_id: string;
  @IsString() bracelet_uid: string;
}

@Controller()
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @RequireKey('desk')
  @Post('sessions')
  bind(@Body() dto: BindSessionDto) { return this.sessions.bind(dto.user_id, dto.bracelet_uid); }

  @RequireKey('desk')
  @Post('sessions/:id/return')
  returnById(@Param('id') id: string) { return this.sessions.returnById(id); }

  @RequireKey('station')
  @Get('lookup/:uid')
  lookup(@Param('uid') uid: string) { return this.sessions.lookup(uid); }
}
