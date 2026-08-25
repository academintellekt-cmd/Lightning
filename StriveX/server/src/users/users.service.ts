import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { DbService } from '../db/db.service';
import { CreateUserDto, LoginDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  async create(dto: CreateUserDto) {
    if (!dto.guest && (!dto.email || !dto.password))
      throw new BadRequestException('email and password required (or guest: true)');
    const id = randomUUID();
    const hash = dto.password ? await bcrypt.hash(dto.password, 10) : null;
    try {
      this.db.raw.prepare('INSERT INTO users (id, username, email, name, password_hash) VALUES (?, ?, ?, ?, ?)')
        .run(id, dto.username, dto.email ?? null, dto.name ?? null, hash);
    } catch {
      throw new ConflictException('username or email already taken');
    }
    return { id, username: dto.username };
  }

  async login(dto: LoginDto) {
    const user = this.db.raw.prepare('SELECT * FROM users WHERE email = ?').get(dto.email) as any;
    if (!user?.password_hash || !(await bcrypt.compare(dto.password, user.password_hash)))
      throw new UnauthorizedException('invalid credentials');
    return { id: user.id, username: user.username, name: user.name };
  }
}
