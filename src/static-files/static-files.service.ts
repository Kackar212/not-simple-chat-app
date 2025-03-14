import { Response } from 'express';
import Ffmpeg from 'fluent-ffmpeg-7';
import { SupportedFileFormat } from './supported-file-format.enum';
import { Stream } from 'stream';

export class StaticFilesService {
  async gifToMp4(
    res: Response,
    filePath: string,
    fileStats: Ffmpeg.FfprobeFormat,
    width?: number,
    height?: number,
  ) {
    const divisibleBy = 2;
    const stream = new Stream.PassThrough();

    const buffers = [] as Buffer[];
    stream.on('data', (buffer: Buffer) => {
      buffers.push(buffer);
    });

    if (fileStats.format.size === 0) {
      res.sendFile(filePath);
    }

    return await new Promise((resolve) => {
      const command = Ffmpeg(filePath)
        .on('error', resolve)
        .on('end', resolve)
        .inputFormat(SupportedFileFormat.Gif)
        .outputOptions([
          '-pix_fmt yuv420p',
          '-movflags frag_keyframe+empty_moov',
          '-movflags +faststart',
          '-vcodec libx264',
        ])
        .outputFormat(SupportedFileFormat.MP4);

      if (!!width || !!height) {
        const widthDivisibleBy2 = width
          ? ((divisibleBy - (width % divisibleBy)) % divisibleBy) + width
          : '?';

        const heightDivisibleBy2 = height
          ? ((divisibleBy - (height % divisibleBy)) % divisibleBy) + height
          : '?';

        command.setSize(`${widthDivisibleBy2}x${heightDivisibleBy2}`);
      }

      if (!width || !height) {
        command.keepDAR();
      }

      res.writeHead(200, {
        'content-type': 'video/mp4',
      });

      command.stream(res, { end: true });
    });
  }
}
