import { Global, Module } from '@nestjs/common';
import { BasePrismaService, PrismaService } from './prisma.service';

export const PRISMA_INJECTION_TOKEN = 'PrismaService';

@Global()
@Module({
  providers: [
    {
      provide: PRISMA_INJECTION_TOKEN,
      useFactory(): PrismaService {
        return new BasePrismaService().withExtensions();
      },
    },
  ],
  exports: [PRISMA_INJECTION_TOKEN],
})
export class PrismaModule {}
