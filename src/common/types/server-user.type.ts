import { Prisma } from '@prisma/client';

export type Member = Prisma.MemberGetPayload<{
  include: { user: true };
}>;
