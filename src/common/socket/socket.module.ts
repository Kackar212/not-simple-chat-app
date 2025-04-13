import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class SocketModule {}
