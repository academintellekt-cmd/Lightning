import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';

// R11: 5 login attempts / 15 min per email+IP (in-memory)
@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private attempts = new Map<string, { count: number; resetAt: number }>();

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const key = `${req.body?.email || ''}|${req.ip}`;
    const now = Date.now();
    const rec = this.attempts.get(key) || { count: 0, resetAt: now + 15 * 60_000 };
    if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + 15 * 60_000; }
    if (rec.count >= 5) throw new HttpException('too many attempts, try later', 429);
    rec.count++;
    this.attempts.set(key, rec);
    return true;
  }
}
