import { Prisma } from '@prisma/client';

export type BasicUser = Prisma.UserGetPayload<{
  select: { id: true; displayName: true; avatar: true; username: true };
}>;
