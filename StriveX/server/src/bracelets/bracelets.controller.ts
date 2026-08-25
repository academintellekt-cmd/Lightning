import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { RequireKey } from '../auth/decorators';
import { BraceletsService } from './bracelets.service';

class RegisterBraceletDto {
  @IsString() uid: string;
  @IsOptional() @IsString() label?: string;
}

@RequireKey('desk')
@Controller('bracelets')
export class BraceletsController {
  constructor(private readonly bracelets: BraceletsService) {}

  @Post()
  register(@Body() dto: RegisterBraceletDto) { return this.bracelets.register(dto.uid, dto.label); }

  @Post(':uid/return')
  returnByUid(@Param('uid') uid: string) { return this.bracelets.returnByUid(uid); }

  @Get('overdue')
  overdue() { return this.bracelets.overdue(); }

  @Get()
  list() { return this.bracelets.list(); }
}
