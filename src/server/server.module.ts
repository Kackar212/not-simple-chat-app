import { Module } from '@nestjs/common';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { ChannelService } from 'src/channel/channel.service';
import { SocketModule } from 'src/common/socket/socket.module';
import { MessageService } from 'src/message/message.service';
import { ConfigService } from '@nestjs/config';
import { EmbedService } from 'src/embed/embed.service';
import { DirectMessageService } from 'src/direct-message/direct-message.service';

@Module({
  imports: [PrismaModule, SocketModule],
  controllers: [ServerController],
  providers: [
    ServerService,
    ChannelService,
    MessageService,
    EmbedService,
    ConfigService,
    DirectMessageService,
  ],
})
export class ServerModule {}
