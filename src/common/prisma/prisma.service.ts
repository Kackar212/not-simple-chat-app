import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleDestroy() {
    await this.$disconnect();
  }

  constructor() {
    super({
      omit: {
        user: {
          password: true,
          resetPasswordToken: true,
          isAccountActive: true,
          activateAccountToken: true,
          activationTokenExpiresIn: true,
          email: true,
        },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
