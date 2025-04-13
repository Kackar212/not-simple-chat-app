import { Prisma } from '@prisma/client';
import { userPayload } from '../prisma';

export type ServerEntity = Prisma.ServerGetPayload<{
  include: {
    members: { include: { user: userPayload } };
    inviteLink: true;
  };
}>;
