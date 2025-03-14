import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { PrismaService } from '../prisma';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SocketGateway, PrismaService],
  exports: [SocketGateway],
})
export class SocketModule {}
