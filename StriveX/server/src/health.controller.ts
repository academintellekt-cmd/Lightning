import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { Public } from './auth/decorators';
import { DbService } from './db/db.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DbService) {}

  @Public()
  @Get()
  health() {
    try {
      this.db.raw.prepare('SELECT 1').get();
      return { ok: true };
    } catch (e: any) {
      throw new InternalServerErrorException({ ok: false, error: e.message });
    }
  }
}
