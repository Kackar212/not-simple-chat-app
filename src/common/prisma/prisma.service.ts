import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

export type userPayload = {
  omit: {
    password: true;
    email: true;
    activateAccountToken: true;
    activationTokenExpiresIn: true;
    isAccountActive: true;
    resetPasswordToken: true;
    isInvisible: true;
  };
};

export const client = () =>
  new PrismaClient({
    omit: {
      user: {
        password: true,
        email: true,
        activateAccountToken: true,
        activationTokenExpiresIn: true,
        isAccountActive: true,
        resetPasswordToken: true,
        isInvisible: true,
      },
    },
  }).$extends({
    result: {
      member: {
        roleIds: {
          compute(
            data: Prisma.MemberGetPayload<{
              include: {
                roles: { select: { role: { select: { id: true } } } };
              };
            }>,
          ) {
            if (!data.roles) {
              return [];
            }

            return data.roles.map(({ role }) => role.id);
          },
          needs: {},
        },
        color: {
          compute(
            data: Prisma.MemberGetPayload<{
              include: {
                roles: { include: { role: true } };
              };
            }>,
          ) {
            if (!data.roles) {
              return 'rgb(220,220,220)';
            }

            return data.roles[0]?.role.color || 'rgb(220,220,220)';
          },
          needs: {},
        },
      },
    },
  });

export type PrismaService = ReturnType<BasePrismaService['withExtensions']>;

@Injectable()
export class BasePrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  withExtensions() {
    return client();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
