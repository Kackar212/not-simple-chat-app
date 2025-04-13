import { Prisma } from '@prisma/client';
import { userPayload } from '../prisma';

export type Member = Prisma.MemberGetPayload<{
  include: { user: userPayload };
}>;
