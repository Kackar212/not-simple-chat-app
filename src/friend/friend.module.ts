import { Module } from '@nestjs/common';
import { FriendService } from './friend.service';
import { SocketModule } from 'src/common/socket/socket.module';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { ConfigService } from '@nestjs/config';
import { DirectMessageService } from 'src/direct-message/direct-message.service';
import { ServerService } from 'src/server/server.service';

@Module({
  imports: [SocketModule, PrismaModule],
  providers: [
    FriendService,
    ConfigService,
    DirectMessageService,
    ServerService,
  ],
  exports: [FriendService],
})
export class FriendModule {}
