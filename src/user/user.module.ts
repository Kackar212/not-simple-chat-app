import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ChannelModule } from 'src/channel/channel.module';
import { MessageService } from 'src/message/message.service';
import { DirectMessageService } from 'src/direct-message/direct-message.service';
import { ConfigService } from '@nestjs/config';
import { FriendService } from 'src/friend/friend.service';
import { SocketModule } from 'src/common/socket/socket.module';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { ServerService } from 'src/server/server.service';
import { EmbedService } from 'src/embed/embed.service';

@Module({
  exports: [UserService],
  controllers: [UserController],
  imports: [ChannelModule, SocketModule, PrismaModule],
  providers: [
    UserService,
    FriendService,
    MessageService,
    DirectMessageService,
    ConfigService,
    ServerService,
    EmbedService,
  ],
})
export class UserModule {}
