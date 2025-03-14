import { createWorker } from 'mediasoup';
import { WebRtcServer } from 'mediasoup/node/lib/WebRtcServerTypes';
import { Worker } from 'mediasoup/node/lib/WorkerTypes';

export class MediasoupWorker {
  #worker: Worker;
  #server: WebRtcServer;
  roomsCount: number = 0;

  constructor(worker: Worker, server: WebRtcServer) {
    this.#worker = worker;
    this.#server = server;
  }

  static async create() {
    const worker = await createWorker({
      logLevel: 'warn',
      logTags: [
        'info',
        'ice',
        'dtls',
        'rtp',
        'srtp',
        'rtcp',
        'rtx',
        'bwe',
        'score',
        'simulcast',
        'svc',
        'sctp',
      ],
      disableLiburing: false,
    });

    const webRtcServer = await worker.createWebRtcServer({
      listenInfos: [
        {
          ip: '127.0.0.1',
          protocol: 'udp',
          port: 4000,
        },
        {
          ip: '127.0.0.1',
          protocol: 'tcp',
          port: 3016,
        },
      ],
    });

    worker.on('died', () => {
      console.error(
        'mediasoup worker died, exiting in 2 seconds... [pid:%d]',
        worker.pid,
      );

      setTimeout(() => process.exit(1), 2000);
    });

    return new MediasoupWorker(worker, webRtcServer);
  }

  getPid() {
    return this.#worker.pid;
  }

  get worker() {
    return this.#worker;
  }

  get server() {
    return this.#server;
  }
}
