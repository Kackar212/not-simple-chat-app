import { User } from '@prisma/client';
import { Consumer, Producer, WebRtcTransport } from 'mediasoup/node/lib/types';

export class MediasoupPeer {
  produceTransport?: WebRtcTransport;
  producer?: Producer;
  consumeTransport?: WebRtcTransport;
  consumers: Consumer[] = [];
  user: User;
  socketId: string;
  isEveryConsumerMuted: boolean = false;

  constructor(socketId: string, user: User) {
    this.socketId = socketId;
    this.user = user;
  }

  stop() {
    this.produceTransport?.close();
    this.producer?.close();
    this.consumeTransport?.close();
    this.consumers.forEach((consumer) => {
      consumer.close();
    });

    Object.assign(this, {
      produceTransport: null,
      producer: null,
      consumeTRansport: null,
      consumers: [],
    });
  }
}
