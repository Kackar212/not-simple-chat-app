import type { Socket as SocketIO } from 'socket.io';
import { ClientToServerEvents } from 'src/common/socket/client-to-server-events.interface';
import { ServerToClientEvents } from 'src/common/socket/server-to-client-events.interface';

export type Socket = SocketIO<ClientToServerEvents, ServerToClientEvents>;
