import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
export const KEY_CLASS = 'keyClass';

// Public route: the explicit exception to global auth (RISKS.md standing rule #1)
export const Public = () => SetMetadata(IS_PUBLIC, true);
// Which device class may call this route: 'desk' | 'station'
export const RequireKey = (cls: 'desk' | 'station') => SetMetadata(KEY_CLASS, cls);
