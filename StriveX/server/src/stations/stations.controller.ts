import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { RequireKey } from '../auth/decorators';
import { StationsService } from './stations.service';

class RegisterStationDto {
  @IsString() id: string;
  @IsOptional() @IsString() name?: string;
}
class HeartbeatDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() session_id?: string;
  @IsOptional() @IsString() started_at?: string;
}

@Controller('stations')
export class StationsController {
  constructor(private readonly stations: StationsService) {}

  @RequireKey('desk')
  @Post()
  register(@Body() dto: RegisterStationDto) { return this.stations.register(dto.id, dto.name); }

  @RequireKey('station')
  @Post(':id/heartbeat')
  heartbeat(@Param('id') id: string, @Body() dto: HeartbeatDto) {
    return this.stations.heartbeat(id, dto.status, dto.session_id, dto.started_at);
  }

  @RequireKey('desk')
  @Get()
  list() { return this.stations.list(); }
}
