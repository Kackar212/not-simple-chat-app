import { Module } from '@nestjs/common';
import { ChannelController } from './channel.controller';
import { ChannelService } from './channel.service';
import { PrismaService } from 'src/common';
import { MessageService } from 'src/message/message.service';
import { SocketModule } from 'src/common/socket/socket.module';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { EmbedService } from 'src/embed/embed.service';
import { DirectMessageService } from 'src/direct-message/direct-message.service';
import { ServerService } from 'src/server/server.service';

@Module({
  imports: [SocketModule, NestjsFormDataModule],
  controllers: [ChannelController],
  providers: [
    ChannelService,
    DirectMessageService,
    PrismaService,
    MessageService,
    EmbedService,
    ServerService,
  ],
})
export class ChannelModule {}
