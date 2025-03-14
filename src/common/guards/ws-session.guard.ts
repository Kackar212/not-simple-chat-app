import { ExecutionContext, Injectable, CanActivate } from '@nestjs/common';
import { Socket } from 'socket.io';
import { SocketEvent } from 'src/common/socket/socket-event.enum';

@Injectable()
export class WsSessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const wsContext = context.switchToWs();
    const client = wsContext.getClient();

    if (!client.request.isAuthenticated) {
      throw new Error('Passport is not setup correctly!');
    }

    const isUserAuthenticated = client.request.isAuthenticated();

    if (isUserAuthenticated) {
      return true;
    }

    const socket = client as Socket;

    socket.emit(
      SocketEvent.Unauthorized,
      JSON.stringify({
        data: wsContext.getData(),
        event: context.getArgByIndex(3),
      }),
    );

    return false;
  }
}
