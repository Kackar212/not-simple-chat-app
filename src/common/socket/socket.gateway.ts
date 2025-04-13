import { ForbiddenException, Inject, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { $Enums, Status, User } from '@prisma/client';
import { Server } from 'socket.io';
import {
  ChannelPermission,
  ClientToServerEvents,
  Permissions,
  PrismaService,
  RequestWithUser,
  ServerPermission,
  ServerToClientEvents,
  Socket,
  SocketEvent,
  UserWithoutPrivateData,
  WsSessionGuard,
  WsUser,
  exclude,
  rooms,
} from 'src/common';
import { CreateMessageDTO } from 'src/message/dto/create-message.dto';
import { BasicUser } from '../types/basic-user.type';
import { types } from 'mediasoup';
import { MediasoupWorker } from '../mediasoup/mediasoup.worker';
import { MediasoupRoom } from '../mediasoup/mediasoup.room';
import { formatDistanceStrict } from 'date-fns';
import { PRISMA_INJECTION_TOKEN } from '../prisma/prisma.module';

function getRooms(
  channelId: number,
  username: string,
  previousChannelId?: number,
): [
  `channel/${string}/${number}`,
  `private/${string}`,
  `channel/${string}/${number}` | undefined,
] {
  return [
    rooms.channel(channelId, $Enums.ChannelType.Voice),
    rooms.privateRoom(username),
    previousChannelId
      ? rooms.channel(previousChannelId, $Enums.ChannelType.Voice)
      : undefined,
  ];
}

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  public server: Server<ClientToServerEvents, ServerToClientEvents>;

  private workers: MediasoupWorker[] = [];
  private rooms: Map<number, MediasoupRoom> = new Map();
  private assignedWorkers: Map<number, MediasoupWorker> = new Map();
  private connectedClients: Map<
    string,
    { channelId: number; serverId: number; socketId: string }
  > = new Map();
  private currentServerId = new Map<string, number | undefined>();
  private typingUsers = new Map<number, string[]>();

  constructor(
    @Inject(PRISMA_INJECTION_TOKEN)
    private readonly prisma: PrismaService,
  ) {
    this.createWorker();
  }

  async createWorker() {
    const worker = await MediasoupWorker.create();

    this.workers.push(worker);

    return worker;
  }

  getUsernames(channelId: number) {
    const room = this.rooms.get(channelId);

    if (!room) {
      return [];
    }

    return room.getPeers().map(({ user }) => user.username);
  }

  async getUsers(channelId: number, serverId: number) {
    const usernames = this.getUsernames(channelId);

    const members = await this.prisma.member.findMany({
      where: {
        user: {
          username: {
            in: usernames,
          },
        },
        serverId,
      },
      select: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
          },
        },
        profile: {
          select: {
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    return members.map((member) => ({
      ...member.user,
      displayName: member.profile?.displayName || member.user.displayName,
      avatar: member.profile?.avatar || member.user.avatar,
    }));
  }

  getRoomsOrUndefined(rooms: Array<string | undefined | false | null>) {
    const filteredRooms = <string[]>rooms.filter(Boolean);

    if (filteredRooms.length === 0) {
      return;
    }

    return filteredRooms;
  }

  removePeerFromPreviousRoom(user: User, currentRoom?: MediasoupRoom) {
    const [channelId, previousRoom] =
      [...this.rooms.entries()].find(([_channelId, room]) =>
        room.hasPeer(user),
      ) || [];

    if (currentRoom === previousRoom) {
      return;
    }

    if (!previousRoom || !channelId) {
      return;
    }

    previousRoom.removePeer(user);

    if (!previousRoom.isEmpty()) {
      return;
    }

    previousRoom.destroy();
    this.rooms.delete(channelId);
  }

  getRoom(channelId: number) {
    const room = this.rooms.get(channelId);

    if (!room) {
      throw new WsException('Room with this is does not exists!');
    }

    return room;
  }

  isSameClient(username: string, socketId: string) {
    return this.connectedClients.get(username)?.socketId === socketId;
  }

  @SubscribeMessage('createTransport')
  @UseGuards(WsSessionGuard)
  async handleCreateTransport(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    { channelId, isProducer }: { channelId: number; isProducer: boolean },
    @WsUser() { username }: User,
  ) {
    const room = this.getRoom(channelId);

    const transport = await room.createTransport(username, isProducer);

    const params = {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };

    if (isProducer) {
      socket.emit('createProduceTransport', { params });

      return;
    }

    socket.emit('createConsumeTransport', { params });
  }

  @SubscribeMessage('consume')
  @UseGuards(WsSessionGuard)
  async handleConsume(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    {
      channelId,
      rtpCapabilities,
    }: {
      channelId: number;
      rtpCapabilities: types.RtpCapabilities;
    },
    @WsUser() user: User,
  ) {
    const room = this.getRoom(channelId);

    const consumers = await room.createConsumers(
      user.username,
      rtpCapabilities,
    );

    if (consumers.length === 0) {
      socket.emit('consume');
      socket.emit('connected');

      return;
    }

    consumers.forEach(({ peer, consumer }) => {
      socket.emit('consume', {
        producerId: consumer.producerId,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        user: exclude(peer.user, ['password', 'resetPasswordToken', 'email']),
        resumeConsumer: !peer.isEveryConsumerMuted,
      });
    });

    socket.emit('connected');
  }

  @SubscribeMessage('connectTransport')
  @Permissions([ChannelPermission.Read], true)
  async handleConnectTransport(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    {
      channelId,
      dtlsParameters,
      isProducer,
    }: {
      channelId: number;
      dtlsParameters: types.DtlsParameters;
      isProducer: boolean;
    },
    @WsUser() user: User,
  ) {
    const room = this.getRoom(channelId);

    await room.connectTransport(user.username, dtlsParameters, isProducer);

    socket.emit('transportConnected', { success: true });
  }

  @SubscribeMessage('produce')
  @Permissions([ServerPermission.Member], true)
  async handleTransportProduce(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    {
      channelId,
      producerOptions,
    }: {
      channelId: number;
      producerOptions: types.ProducerOptions;
    },
    @WsUser() user: User,
  ) {
    const room = this.getRoom(channelId);

    const producer = await room.createProducer(user.username, producerOptions);

    if (!producer) {
      return;
    }

    const peerIds = room
      .getPeers((peer) => peer.socketId !== socket.id)
      .map((peer) => peer.socketId);

    if (peerIds.length > 0) {
      socket.broadcast.to(peerIds).emit('newProducer');
    }

    socket.emit('produce', producer.id);
  }

  @SubscribeMessage('changeProducerState')
  handleChangeProducerState(
    @ConnectedSocket() socket: Socket,
    @WsUser() { username }: User,
    @MessageBody()
    { channelId, paused }: { channelId: number; paused: boolean },
  ) {
    if (!this.isSameClient(username, socket.id)) {
      return;
    }

    const room = this.getRoom(channelId);
    const peer = room.getPeer(username);
    const peerIds = room
      .getPeers(({ socketId }) => peer.socketId !== socketId)
      .map((peer) => peer.socketId);

    socket.broadcast.to(peerIds).emit('changeProducerState', {
      paused,
      username,
      channelId,
    });
  }

  @SubscribeMessage('changeConsumerState')
  async handleChangeConsumerState(
    @ConnectedSocket() socket: Socket,
    @WsUser() { username }: User,
    @MessageBody()
    {
      channelId,
      paused,
      consumerId,
    }: { channelId: number; paused: boolean; consumerId: string },
  ) {
    if (!this.isSameClient(username, socket.id)) {
      return;
    }

    const room = this.getRoom(channelId);
    const peer = room.getPeer(username);

    const consumer = peer.consumers.find(
      (consumer) => consumer.id === consumerId,
    );

    if (!consumer) {
      return;
    }

    if (!paused) {
      await consumer.resume();
    }

    if (paused) {
      await consumer.pause();
    }

    socket.emit('changeConsumerState', { paused: consumer.paused });
  }

  @SubscribeMessage('toggleAllConsumers')
  @Permissions([ChannelPermission.Read], true)
  handlePauseAllConsumers(
    @ConnectedSocket() socket: Socket,
    @MessageBody() { channelId, muted }: { channelId: number; muted: boolean },
    @WsUser() user: User,
  ) {
    if (!this.isSameClient(user.username, socket.id)) {
      return;
    }

    const room = this.getRoom(channelId);
    const peer = room.getPeer(user.username);

    peer.isEveryConsumerMuted = !muted;

    peer.consumers.forEach((consumer) => {
      if (muted) {
        consumer.resume();
      }

      if (!muted) {
        consumer.pause();
      }
    });
  }

  @SubscribeMessage(SocketEvent.JoinChannel)
  @Permissions([ChannelPermission.Read], true)
  async handleJoinChannel(
    @ConnectedSocket() socket: Socket,
    @MessageBody() { channelId }: CreateMessageDTO,
    @WsUser() user: User,
  ) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        server: {
          select: {
            id: true,
            isGlobalServer: true,
          },
        },
      },
    });

    if (!channel) {
      return;
    }

    const room = rooms.channel(channelId);
    const previousRoom = [...socket.rooms].find((room) =>
      room.startsWith(`channel/${$Enums.ChannelType.Text}`),
    );

    if (room === previousRoom) {
      return;
    }

    const privateRoom = rooms.privateRoom(user.username);
    const event = SocketEvent.JoinChannel;

    if (previousRoom) {
      socket.leave(previousRoom);
    }

    socket.join(room);

    const {
      server: { isGlobalServer, id },
    } = channel;

    if (isGlobalServer) {
      const users = await this.getUsers(channelId, id);

      this.server
        .to(rooms.channel(channelId))
        .emit(SocketEvent.Members, { members: users, channelId });
    }
    console.log(socket.rooms);
    socket.to(room).except(privateRoom).emit(event, {
      channelId,
      socketId: socket.id,
    });
  }

  @SubscribeMessage('resumeConsumer')
  @Permissions([ChannelPermission.Read, ChannelPermission.Write], true)
  async handleResumeConsumer(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    { consumerId, channelId }: { consumerId: string; channelId: number },
    @WsUser() user: User,
  ) {
    const peer = this.rooms.get(channelId)?.getPeer(user.username);
    console.log(
      user.username,
      consumerId,
      peer?.consumers.map((c) => c.id),
      peer?.consumers?.find((consumer) => consumer.id === consumerId)?.paused,
    );

    await peer?.consumers
      ?.find((consumer) => consumer.id === consumerId)
      ?.resume();

    console.log(
      peer?.consumers?.find((consumer) => consumer.id === consumerId)?.paused,
    );
  }

  @Permissions([ChannelPermission.Read, ServerPermission.Read], true)
  @SubscribeMessage(SocketEvent.JoinVoiceChannel)
  async handleJoinVoiceChannel(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    { channelId }: { channelId: number; serverId: number },
    @WsUser() user: User,
  ) {
    const channel = await this.prisma.channel.findUnique({
      where: {
        id: channelId,
      },
      include: {
        server: true,
        channelUsers: {
          where: {
            member: {
              userId: {
                not: user.id,
              },
            },
          },
          select: {
            member: {
              select: {
                user: {
                  select: {
                    username: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!channel) {
      return;
    }

    const { serverId } = channel;

    let worker = this.assignedWorkers.get(channelId);

    if (!worker) {
      worker = this.workers.find((worker) => {
        return worker.roomsCount < 20;
      });
    }

    if (!worker) {
      worker = await this.createWorker();
    }

    if (!this.assignedWorkers.has(channelId)) {
      worker.roomsCount += 1;
    }

    await this.#leaveVoiceChannel(user);

    const mediasoupRoom =
      this.rooms.get(channelId) || (await MediasoupRoom.create(worker));

    this.assignedWorkers.set(channelId, worker);

    this.rooms.get(channelId);

    try {
      const peer = mediasoupRoom.getPeer(user.username);

      if (peer.socketId === socket.id) {
        return;
      }
    } catch (e) {
      mediasoupRoom.addPeer(socket.id, user);
    }

    this.rooms.set(channelId, mediasoupRoom);

    this.connectedClients.set(user.username, {
      channelId,
      serverId,
      socketId: socket.id,
    });

    const room = rooms.channel(channelId, $Enums.ChannelType.Voice);
    socket.join(room);

    socket.emit('getRtpCapabilities', {
      rtpCapabilities: mediasoupRoom.getRouterRtpCapabilities(),
      channel,
    });

    const users = await this.getUsers(channelId, serverId);

    this.server
      .to([rooms.server(channel.serverId), rooms.channel(channelId)])
      .emit(SocketEvent.Members, { members: users, channelId });

    const hasPlayerStartedCall =
      mediasoupRoom.getPeers().length === 1 && channel.server.isGlobalServer;

    if (!hasPlayerStartedCall) {
      return;
    }

    const message = await this.#createCallSystemMessage(
      user.id,
      'started a voice call',
      channel.id,
    );

    mediasoupRoom.setCallMessage({
      id: message.id,
      createdAt: message.createdAt,
    });
  }

  async #createCallSystemMessage(
    userId: number,
    messageContent: string,
    channelId: number,
  ) {
    const member = await this.prisma.member.findFirst({
      where: {
        userId: userId,
        server: {
          isGlobalServer: true,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException();
    }

    const systemMessage = await this.prisma.message.create({
      data: {
        message: messageContent,
        type: $Enums.MessageType.VoiceCallEnded,
        isSystemMessage: true,
        memberId: member.id,
        channelId: channelId,
      },
      include: {
        member: {
          include: {
            user: true,
            profile: true,
            roles: {
              take: 1,
              select: {
                role: {
                  select: {
                    color: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const message = {
      ...systemMessage,
      embeds: [],
      attachments: [],
      reactions: [],
      poll: null,
    };

    this.server.to(rooms.channel(channelId)).emit(SocketEvent.Message, message);

    return message;
  }

  async handleVoiceCallEnded(
    {
      channelId,
    }: {
      channelId: number;
    },
    user: User,
  ) {
    const mediasoupRoom = this.rooms.get(channelId);

    if (
      !mediasoupRoom ||
      !mediasoupRoom.hasPeer(user) ||
      mediasoupRoom.getPeers().length !== 1
    ) {
      return;
    }

    const callMessage = mediasoupRoom.getCallMessage();

    if (!callMessage) {
      return;
    }

    const { createdAt, id } = callMessage;
    const elapsedTime = formatDistanceStrict(new Date(), createdAt);

    const updatedMessage = await this.prisma.message.update({
      where: {
        id,
      },
      data: {
        message: `started a call that lasted ${elapsedTime}`,
      },
      include: {
        member: {
          include: {
            user: true,
            profile: true,
            roles: {
              take: 1,
              select: {
                role: {
                  select: {
                    color: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const room = rooms.channel(channelId);

    const message = {
      ...updatedMessage,
      embeds: [],
      attachments: [],
      reactions: [],
    };

    this.server.to(room).emit(SocketEvent.Message, message);
  }

  async #leaveVoiceChannel(
    user: User,
    currentClientSocketId?: string,
    allowIfDifferentClient = true,
  ) {
    const connectedClient = this.connectedClients.get(user.username);

    if (!connectedClient) {
      return;
    }

    if (
      connectedClient.socketId !== currentClientSocketId &&
      !allowIfDifferentClient
    ) {
      return;
    }

    const { channelId, serverId, socketId } = connectedClient;

    await this.handleVoiceCallEnded({ channelId }, user);

    this.removePeerFromPreviousRoom(user);

    const [room, privateRoom] = getRooms(channelId, user.username);

    const users = await this.getUsers(channelId, serverId);

    this.server.in(privateRoom).socketsLeave(room);

    this.server.to(socketId).emit('disconnected');
    this.server
      .to(room)
      .except(socketId)
      .emit('userLeftVoiceChannel', { username: user.username });

    this.server
      .to([rooms.server(serverId), privateRoom])
      .emit(SocketEvent.Members, { members: users, channelId });
  }

  @UseGuards(WsSessionGuard)
  @SubscribeMessage(SocketEvent.LeaveVoiceChannel)
  async handleLeaveVoiceChannel(
    @ConnectedSocket() socket: Socket,
    @WsUser()
    user: User,
  ) {
    this.#leaveVoiceChannel(user, socket.id, false);
    this.connectedClients.delete(user.username);
  }

  @Permissions([ServerPermission.Member], true)
  @SubscribeMessage(SocketEvent.JoinServer)
  async handleJoinServer(
    @ConnectedSocket() socket: Socket,
    @MessageBody() { serverId }: { serverId: number },
  ) {
    const previousRoom = [...socket.rooms].find((room) =>
      room.startsWith(`server/`),
    );
    const room = rooms.server(serverId);

    if (room === previousRoom) {
      return;
    }

    if (previousRoom) {
      socket.leave(previousRoom);
    }

    socket.join(room);

    const ids = await this.prisma.channel.findMany({
      where: {
        serverId,
        type: $Enums.ChannelType.Voice,
      },
      select: {
        id: true,
      },
    });

    const channelIds = ids.map(({ id }) => id);

    const voiceChannelMembers = await this.prisma.$transaction(async () => {
      return Promise.all(
        channelIds.map(async (channelId) => [
          channelId,
          await this.getUsers(channelId, serverId),
        ]) as Array<Promise<[number, BasicUser[]]>>,
      );
    });

    this.server.to(socket.id).emit(SocketEvent.UserJoinedServer, {
      voiceChannelMembers: Object.fromEntries(voiceChannelMembers),
    });
  }

  @UseGuards(WsSessionGuard)
  @SubscribeMessage(SocketEvent.JoinPrivateRoom)
  handleJoinPrivateRoom(
    @ConnectedSocket() socket: Socket,
    @WsUser() user: User,
  ) {
    const room = rooms.privateRoom(user.username);

    if (socket.rooms.has(room)) {
      return;
    }

    socket.join(room);

    socket.emit(SocketEvent.JoinPrivateRoom);

    const connectedClient = this.connectedClients.get(user.username);

    if (connectedClient) {
      socket.emit(SocketEvent.Rejoin, connectedClient);
    }
  }

  async changeUserStatusInServer(
    status: $Enums.Status,
    user: User,
    serverId?: number,
  ) {
    if (!serverId) {
      return null;
    }

    if (user.isInvisible) {
      return null;
    }

    const member = await this.prisma.member.findUnique({
      where: {
        serverId_userId: {
          serverId,
          userId: user.id,
        },
      },
      select: { id: true },
    });

    this.prisma.member.update({
      where: {
        serverId_userId: {
          serverId,
          userId: user.id,
        },
      },
      data: {
        profile: {
          update: {
            status,
          },
        },
      },
    });

    if (!member) {
      return null;
    }

    return await this.prisma.serverProfile.update({
      where: { memberId: member.id },
      data: { status },
    });
  }

  async getStatusRooms(user: UserWithoutPrivateData, serverId?: number) {
    const friends = await this.prisma.friend.findMany({
      where: {
        friendName: user.username,
        isPending: false,
        user: {
          status: $Enums.Status.Online,
        },
      },
      select: {
        username: true,
      },
    });

    const channels = await this.prisma.channel.findMany({
      where: {
        name: {
          has: user.username,
        },
        isRequestAccepted: true,
        server: {
          isGlobalServer: true,
        },
      },
      select: {
        channelUsers: {
          where: {
            member: {
              userId: {
                not: user.id,
              },
            },
          },
          select: {
            member: {
              select: {
                user: {
                  select: {
                    username: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const serverRoom = typeof serverId === 'number' && rooms.server(serverId);

    const privateRooms = this.getRoomsOrUndefined([
      ...friends.map((friend) => rooms.privateRoom(friend.username)),
      ...channels.map(
        ({
          channelUsers: [
            {
              member: {
                user: { username },
              },
            },
          ],
        }) => rooms.privateRoom(username),
      ),
      serverRoom,
    ]);

    if (!privateRooms) {
      return null;
    }

    return privateRooms;
  }

  @UseGuards(WsSessionGuard)
  @SubscribeMessage(SocketEvent.Status)
  async handleStatusChange(
    @MessageBody()
    body: { status: $Enums.Status; serverId?: number },
    @WsUser() user: User,
    @ConnectedSocket() socket: Socket,
  ) {
    const { status } = body;

    let { status: currentStatus, isInvisible, specialStatus } = user;
    let { serverId } = body;

    if (!serverId) {
      const server = await this.prisma.server.findUnique({
        where: { isGlobalServer: true },
        select: { id: true },
      });

      serverId = server?.id;
    }

    this.currentServerId.set(socket.id, serverId);

    if (serverId) {
      const profile = await this.prisma.serverProfile.findFirst({
        where: {
          serverId,
          member: {
            userId: user.id,
          },
        },
      });

      currentStatus = profile ? profile.status : currentStatus;
      isInvisible = profile ? profile.isInvisible : isInvisible;
      specialStatus = profile ? profile.specialStatus : specialStatus;
    }

    if (isInvisible) {
      return;
    }

    if (specialStatus && currentStatus === Status.Online) {
      return;
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        status,
      },
    });

    const profile = await this.changeUserStatusInServer(status, user, serverId);

    const statusRooms = await this.getStatusRooms({
      ...updatedUser,
      ...profile,
    });

    if (!statusRooms) {
      return;
    }

    socket
      .to(statusRooms)
      .emit(SocketEvent.Status, { ...updatedUser, ...profile });
  }

  @SubscribeMessage(SocketEvent.Typing)
  @UseGuards(WsSessionGuard)
  handleTyping(
    @MessageBody()
    {
      username,
      status,
      channelId,
    }: { username: string; status: 'typing' | 'stopped'; channelId: number },
    @ConnectedSocket() socket: Socket,
  ) {
    const room = rooms.channel(channelId);

    if (!socket.rooms.has(room)) {
      return;
    }

    let typingUsers = this.typingUsers.get(channelId) || [];

    if (status === 'typing' && !typingUsers.includes(username)) {
      typingUsers.unshift(username);
    }

    if (status === 'stopped') {
      typingUsers = typingUsers.filter((name) => name !== username);
    }

    this.typingUsers.set(channelId, typingUsers);

    socket
      .to(room)
      .except(rooms.privateRoom(username))
      .emit(SocketEvent.Typing, typingUsers);
  }

  @UseGuards(WsSessionGuard)
  async handleDisconnect(socket: Socket) {
    const { user } = socket.conn.request as RequestWithUser;

    await this.#leaveVoiceChannel(user, socket.id, false);
    await this.handleStatusChange(
      {
        status: $Enums.Status.Offline,
        serverId: this.currentServerId.get(socket.id),
      },
      user,
      socket,
    );

    this.currentServerId.delete(socket.id);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: Socket) {
    this.server.to(socket.id).emit('pong');
  }

  @UseGuards(WsSessionGuard)
  handleConnection(socket: Socket) {
    const req = socket.conn.request as RequestWithUser;
    console.log(req.user);
    if (!req.user) {
      socket.disconnect();

      return;
    }

    return {
      event: 'connect',
      data: {
        user: req.user,
      },
    };
  }
}
