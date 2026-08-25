import { Module } from '@nestjs/common';
import { BraceletsController } from './bracelets.controller';
import { BraceletsService } from './bracelets.service';

@Module({ controllers: [BraceletsController], providers: [BraceletsService] })
export class BraceletsModule {}
