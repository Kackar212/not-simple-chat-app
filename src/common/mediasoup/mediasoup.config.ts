import { types } from 'mediasoup';
import { networkInterfaces } from 'os';

interface MediasoupConfig {
  localIp: string;
  listenIp: string;
  cert: string;
  key: string;
  mediaCodecs: types.RtpCodecCapability[];
}

const getLocalIp = () => {
  let localIp = '127.0.0.1';
  const ifaces = networkInterfaces();

  Object.keys(ifaces).forEach((ifname) => {
    for (const iface of ifaces[ifname]!) {
      if (iface.family !== 'IPv4' || iface.internal !== false) {
        continue;
      }

      localIp = iface.address;
      return;
    }
  });
  return localIp;
};

export const config: MediasoupConfig = {
  localIp: getLocalIp(),
  listenIp: '0.0.0.0',
  cert: '/localhost.pem',
  key: '/localhost-key.pem',
  mediaCodecs: [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
  ],
};
