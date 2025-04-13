import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { AuthSerializer } from './auth.serializer';
import { UserService } from 'src/user/user.service';
import { ConfigService } from '@nestjs/config';
import { MessageService } from 'src/message/message.service';
import { DirectMessageService } from 'src/direct-message/direct-message.service';
import { SocketModule } from 'src/common/socket/socket.module';
import { ServerService } from 'src/server/server.service';
import { EmbedService } from 'src/embed/embed.service';

@Module({
  imports: [SocketModule],
  controllers: [AuthController],
  providers: [
    LocalStrategy,
    AuthSerializer,
    MessageService,
    DirectMessageService,
    UserService,
    AuthService,
    ConfigService,
    ServerService,
    EmbedService,
  ],
})
export class AuthModule {}
