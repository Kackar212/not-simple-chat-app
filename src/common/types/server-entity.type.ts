import { Prisma } from '@prisma/client';

export type ServerEntity = Prisma.ServerGetPayload<{
  include: { members: { include: { user: true } }; inviteLink: true };
}>;
