import { Message, Member, Prisma, Reaction, Friend } from '@prisma/client';
import { User, UserWithoutPrivateData } from '../types';
import { BasicUser } from '../types/basic-user.type';
import { types } from 'mediasoup';

export interface ServerToClientEvents {
  join: (data: { channelId: number; socketId: string }) => void;
  message: (
    message: Message & {
      isDeleted?: boolean;
      member: { user: UserWithoutPrivateData };
    },
  ) => void;
  channel: (
    channel: Prisma.ChannelGetPayload<{ include: { channelUsers: true } }> & {
      isDeleted?: boolean;
    },
  ) => void;
  joinPrivateRoom: () => void;
  status: (user: Partial<User>) => void;
  friend: (data: Friend & { isDeleted?: boolean }) => void;
  directMessageChannel: (channel: any) => void;
  block: (blacklist: UserWithoutPrivateData) => void;
  unblock: (blacklist: UserWithoutPrivateData) => void;
  member: (member: Member) => void;
  typing: (typingUsers: string[]) => void;
  offer: (data: {
    offer: unknown;
    channelId: number;
    answerTo: string;
  }) => void;
  candidate: (data: {
    candidate: unknown;
    candidateFrom: string;
    channelId: number;
  }) => void;
  answer: (data: {
    answer: unknown;
    answerFrom: string;
    channelId: number;
  }) => void;
  userJoinedVoiceChannel: (data: {
    channelId: number;
    socketId: string;
    newMember: UserWithoutPrivateData;
  }) => void;
  userLeftVoiceChannel: (data: { username: string }) => void;
  userJoinedServer: (data: {
    voiceChannelMembers: Record<number, BasicUser[]>;
  }) => void;
  reconnectToVoiceChannel: (data: { channelId: number }) => void;
  members: (data: { members: BasicUser[]; channelId: number }) => void;
  rtcDisconnect: () => void;
  connected: () => void;
  pong: () => void;
  getRtpCapabilities: (data: {
    rtpCapabilities: types.RtpCapabilities;
    channel: Prisma.ChannelGetPayload<{ include: { server: true } }>;
  }) => void;
  createTransport: (data: {
    params: {
      id: string;
      iceCandidates: types.IceCandidate[];
      iceParameters: types.IceParameters;
      dtlsParameters: types.DtlsParameters;
    };
  }) => void;
  createProduceTransport: (data: {
    params: {
      id: string;
      iceCandidates: types.IceCandidate[];
      iceParameters: types.IceParameters;
      dtlsParameters: types.DtlsParameters;
    };
  }) => void;
  createConsumeTransport: (data: {
    params: {
      id: string;
      iceCandidates: types.IceCandidate[];
      iceParameters: types.IceParameters;
      dtlsParameters: types.DtlsParameters;
    };
  }) => void;
  transportConnected: (data: { success: true }) => void;
  produce: (producerId: string) => void;
  consume: (data?: {
    rtpParameters: types.RtpParameters;
    id: string;
    kind: types.MediaKind;
    producerId: string;
    user: UserWithoutPrivateData;
    resumeConsumer: boolean;
  }) => void;
  newProducer: () => void;
  disconnected: () => void;
  rejoin: (data: {
    serverId: number;
    channelId: number;
    socketId: string;
  }) => void;
  changeProducerState: (data: {
    paused: boolean;
    username: string;
    channelId: number;
  }) => void;
  changeConsumerState: (data: { paused: boolean }) => void;
  punished: (data: { type: 'ban' | 'kick'; serverId: number }) => void;
  leaveServer: () => void;
  voiceCallEnded: (message: Message) => void;
  reaction: (reaction: Reaction & { count: number }) => void;
  emoji: (emoji: Prisma.EmojiGetPayload<null>) => void;
  pollAnswer: (
    answer: Prisma.PollUserAnswerGetPayload<{
      include: { pollAnswer: true };
    }> & { messageId: number },
  ) => void;
}
