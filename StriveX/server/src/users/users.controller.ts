import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { RequireKey } from '../auth/decorators';
import { LoginThrottleGuard } from './login.throttle';
import { UsersService } from './users.service';
import { CreateUserDto, LoginDto } from './dto';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @RequireKey('desk')
  @Post('users')
  create(@Body() dto: CreateUserDto) { return this.users.create(dto); }

  @RequireKey('desk')
  @UseGuards(LoginThrottleGuard)
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) { return this.users.login(dto); }
}
