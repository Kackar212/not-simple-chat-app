import { MediasoupPeer } from './mediasoup.peer';
import { config } from './mediasoup.config';
import { types } from 'mediasoup';
import { MediasoupWorker } from './mediasoup.worker';
import { User } from '@prisma/client';
import { WsException } from '@nestjs/websockets';

type CallMessage = { id: number; createdAt: Date } | null;

export class MediasoupRoom {
  #peers: Map<string, MediasoupPeer> = new Map();
  #router: types.Router;
  #worker: MediasoupWorker;
  #currentCallMessage: CallMessage;

  constructor(router: types.Router, worker: MediasoupWorker) {
    this.#router = router;
    this.#worker = worker;
  }

  async createTransport(username: string, isProducer: boolean) {
    const peer = this.getPeer(username);

    const transport = await this.#router.createWebRtcTransport({
      webRtcServer: this.#worker.server,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    transport.on('dtlsstatechange', (dtlsState: types.DtlsState) => {
      if (dtlsState === 'closed') {
        transport.close();
      }
    });

    if (isProducer) {
      peer.produceTransport = transport;

      return transport;
    }

    peer.consumeTransport = transport;

    return transport;
  }

  async connectTransport(
    username: string,
    dtlsParameters: types.DtlsParameters,
    isProducer: boolean,
  ) {
    const peer = this.getPeer(username);

    if (isProducer && peer.produceTransport) {
      await peer.produceTransport.connect({ dtlsParameters });

      return;
    }

    if (peer.consumeTransport) {
      await peer.consumeTransport.connect({ dtlsParameters });
    }
  }

  async createProducer(
    username: string,
    producerOptions: types.ProducerOptions,
  ) {
    const peer = this.getPeer(username);

    if (!peer.produceTransport) {
      throw new WsException(
        'You need to create transport before you can create producer!',
      );
    }

    const producer = await peer.produceTransport.produce({
      ...producerOptions,
    });

    peer.producer = producer;

    return producer;
  }

  getRouterRtpCapabilities() {
    return this.#router.rtpCapabilities;
  }

  static async create(mediasoupWorker: MediasoupWorker) {
    const router = await mediasoupWorker.worker.createRouter({
      mediaCodecs: config.mediaCodecs,
    });

    return new MediasoupRoom(router, mediasoupWorker);
  }

  hasPeer(user: User) {
    return this.#peers.has(user.username);
  }

  addPeer(socketId: string, user: User) {
    const peer = new MediasoupPeer(socketId, user);

    this.#peers.set(user.username, peer);

    return peer;
  }

  getPeer(username: string) {
    const peer = this.#peers.get(username);

    if (!peer) {
      throw new WsException(
        'There is no peer with this username in this room!',
      );
    }

    return peer;
  }

  removePeer(user: User) {
    const peer = this.#peers.get(user.username);

    peer?.stop();

    this.#peers.delete(user.username);

    return peer;
  }

  isEmpty() {
    return this.#peers.size === 0;
  }

  clear() {
    [...this.#peers.values()].forEach((peer) => {
      peer.stop();
    });

    this.#peers.clear();
  }

  destroy() {
    if (!this.isEmpty()) {
      throw new WsException(
        'Before you can destroy a room you need to remove every peer!',
      );
    }

    this.#router.close();
  }

  getConsumablePeers(username: string, rtpCapabilities: types.RtpCapabilities) {
    const currentPeer = this.#peers.get(username);

    return [...this.#peers.values()].filter(
      (peer) =>
        !!peer.producer &&
        this.#router.canConsume({
          producerId: peer.producer.id,
          rtpCapabilities,
        }) &&
        peer !== currentPeer &&
        !currentPeer?.consumers.some(
          (consumer) => consumer.producerId === peer.producer!.id,
        ),
    ) as Array<MediasoupPeer & { producer: types.Producer }>;
  }

  async createConsumers(
    username: string,
    rtpCapabilities: types.RtpCapabilities,
  ) {
    const peer = this.#peers.get(username);

    if (!peer) {
      throw new WsException('There is no user with this username in this room');
    }

    const peersToConsume = this.getConsumablePeers(username, rtpCapabilities);
    const consumeTransport = peer.consumeTransport;

    if (!consumeTransport) {
      throw new WsException({
        message: 'You need to create transport before you can start consuming!',
      });
    }

    const consumersWithPeers = await Promise.all(
      peersToConsume.map(async (peerToConsume) => {
        return {
          peer: peerToConsume,
          consumer: await consumeTransport.consume({
            rtpCapabilities,
            producerId: peerToConsume.producer.id,
            paused: true,
          }),
        };
      }),
    );

    peer.consumers.push(...consumersWithPeers.map(({ consumer }) => consumer));

    return consumersWithPeers;
  }

  getPeers(
    predicate?: (
      peer: MediasoupPeer,
      index: number,
      peers: MediasoupPeer[],
    ) => boolean,
  ) {
    const peers = [...this.#peers.values()];

    if (predicate) {
      return peers.filter(predicate);
    }

    return peers;
  }

  get worker() {
    return this.#worker;
  }

  getCallMessage() {
    return this.#currentCallMessage;
  }

  setCallMessage(callMessage: CallMessage) {
    this.#currentCallMessage = callMessage;
  }
}
