import { Body, Controller, Get, Post } from '@nestjs/common';
import { RequireKey } from '../auth/decorators';
import { ResultsService } from './results.service';
import { CreateResultDto } from './dto';

@Controller()
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @RequireKey('station')
  @Post('results')
  create(@Body() dto: CreateResultDto) { return this.results.create(dto); }

  @RequireKey('desk')
  @Get('stats/stations')
  stats() { return this.results.statsByStation(); }
}
