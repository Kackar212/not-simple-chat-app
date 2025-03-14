import { types } from 'mediasoup';

export interface ClientToServerEvents {
  join: (data: { channelId: number }) => void;
  joinPrivateRoom: () => void;
  typing: (data: { channelId: number }) => void;
  offer: (data: {
    offer: unknown;
    channelId: number;
    username: string;
  }) => void;
  candidate: (data: {
    candidate: unknown;
    channelId: number;
    username: string;
  }) => void;
  answer: (data: {
    answer: unknown;
    username: string;
    channelId: number;
  }) => void;
  joinVoiceChannel: (data: { channelId: number; serverId: number }) => void;
  leaveVoiceChannel: () => void;
  joinServer: (data: { serverId: number }) => void;
  tryReconnectToVoiceChannel: () => void;
  ping: () => void;
  connectTransport: (dtlsParameters: types.DtlsParameters) => void;
}
