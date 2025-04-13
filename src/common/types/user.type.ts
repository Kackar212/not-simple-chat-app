import { Prisma, User as PrismaUser } from '@prisma/client';
import { userPayload } from '../prisma';

// export type User = Omit<PrismaUser, 'resetPasswordToken'> & {
//   resetPasswordToken: string | null;
// };

export type UserWithoutPrivateData = Prisma.UserGetPayload<userPayload>;
