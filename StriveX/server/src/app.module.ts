import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DbModule } from './db/db.module';
import { ApiKeyGuard } from './auth/api-key.guard';
import { UsersModule } from './users/users.module';
import { BraceletsModule } from './bracelets/bracelets.module';
import { SessionsModule } from './sessions/sessions.module';
import { StationsModule } from './stations/stations.module';
import { ResultsModule } from './results/results.module';
import { HealthController } from './health.controller';

@Module({
  imports: [DbModule, UsersModule, BraceletsModule, SessionsModule, StationsModule, ResultsModule],
  controllers: [HealthController],
  // R1 + standing rule: auth is GLOBAL; public routes are the explicit exception via @Public()
  providers: [{ provide: APP_GUARD, useClass: ApiKeyGuard }],
})
export class AppModule {}
