import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'kpv:public';

/** Marks a route as reachable without authentication (login, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
