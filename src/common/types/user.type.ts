import { User as PrismaUser } from '@prisma/client';

export type User = Omit<PrismaUser, 'resetPasswordToken'> & {
  resetPasswordToken: string | null;
};

export type UserWithoutPrivateData = Omit<
  PrismaUser,
  | 'password'
  | 'email'
  | 'resetPasswordToken'
  | 'isAccountActive'
  | 'activateAccountToken'
  | 'activationTokenExpiresIn'
>;
