import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC, KEY_CLASS } from './decorators';

// R1: per-device-class shared secrets. Fail closed: unset key disables its routes;
// a route with no @RequireKey/@Public marking is also rejected.
// AUTH_DISABLED=1 bypasses (dev only).
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (process.env.AUTH_DISABLED === '1') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const cls = this.reflector.getAllAndOverride<'desk' | 'station'>(KEY_CLASS, [ctx.getHandler(), ctx.getClass()]);
    if (!cls) throw new ServiceUnavailableException('route has no key class assigned');

    const expected = cls === 'desk' ? process.env.DESK_KEY : process.env.STATION_KEY;
    if (!expected) throw new ServiceUnavailableException(`${cls} key not configured on server`);

    const provided = ctx.switchToHttp().getRequest().get('X-Api-Key');
    if (provided !== expected) throw new UnauthorizedException('invalid or missing X-Api-Key');
    return true;
  }
}
