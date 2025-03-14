import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { SocketModule } from 'src/common/socket/socket.module';
import { DirectMessageController } from 'src/direct-message/direct-message.controller';
import { DirectMessageService } from 'src/direct-message/direct-message.service';
import { ServerService } from 'src/server/server.service';

@Module({
  imports: [SocketModule, PrismaModule],
  controllers: [DirectMessageController],
  providers: [DirectMessageService, ConfigService, ServerService],
})
export class DirectMessageModule {}
