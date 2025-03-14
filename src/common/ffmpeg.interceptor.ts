import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg-7';
import { writeFile } from 'fs/promises';
import { Stream } from 'stream';
import { SupportedFileFormat } from 'src/static-files/supported-file-format.enum';
import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { VIDEO_OUTPUT_FORMAT } from './constants';
import { createPoster } from './utilities';

@Injectable()
export class FfmpegInterceptor implements NestInterceptor {
  async saveToFile(
    fullPath: string,
    multerFile: Express.Multer.File,
    buffers: Buffer[],
    size: number,
  ) {
    await writeFile(fullPath, Buffer.concat(buffers), { flag: 'w+' });

    multerFile.size = size;
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const files = (
      request.files ? Object.values(request.files) : []
    ) as Express.Multer.File[];

    for (const multerFile of files) {
      const { mimetype, path: filePath } = multerFile;

      if (!mimetype.startsWith('video') && !mimetype.startsWith('image')) {
        continue;
      }

      const fullPath = path.join(process.cwd(), filePath);

      if (mimetype.startsWith('image')) {
        const fileFormat = Object.values(SupportedFileFormat).find(
          (fileFormat) => mimetype.includes(fileFormat),
        );

        if (!fileFormat) {
          continue;
        }

        const file = sharp(await readFile(fullPath), {
          animated: true,
        });

        const metadata = {
          height: 0,
          width: 0,
          pages: 1,
          pageHeight: 0,
          ...(await file.metadata()),
        };
        const width = Math.min(metadata.width || 0, 1920);
        const height = Math.min(
          metadata.pages > 1 ? metadata.pageHeight : metadata.height,
          1280,
        );
        console.log('METADATA: ', metadata, width, height);

        multerFile.width = width;
        multerFile.height = height;

        if (fileFormat === SupportedFileFormat.Svg) {
          continue;
        }

        const fn =
          file[fileFormat as 'jpeg' | 'webp' | 'png' | 'avif' | 'tiff'] ||
          file.jpeg;

        fn.bind(file)({
          quality: 75,
        }).resize({
          width: width === 0 ? undefined : width,
          height: height === 0 ? undefined : height,
          fit: 'contain',
        });

        const buffer = await file.toBuffer();

        await this.saveToFile(
          fullPath,
          multerFile,
          [buffer],
          buffer.byteLength,
        );

        continue;
      }

      const passThroughStream = new Stream.PassThrough();
      const buffers = [] as Buffer[];

      let size = 0;
      passThroughStream.on('data', (buffer: Buffer) => {
        size += buffer.byteLength;

        buffers.push(buffer);
      });
      await new Promise(async (resolve) => {
        ffmpeg.ffprobe(fullPath, (_err, data: ffmpeg.FfprobeData) => {
          multerFile.width = data?.streams[0].width || 0;
          multerFile.height = data?.streams[0].height || 0;

          resolve(0);
        });
      });

      multerFile.poster = await createPoster(fullPath);

      ffmpeg(fullPath)
        .outputFormat(VIDEO_OUTPUT_FORMAT)
        .outputOptions([
          '-c:v libx264',
          '-movflags frag_keyframe+empty_moov',
          '-movflags +faststart',
          '-crf 28',
          '-preset medium',
        ])
        .on('end', async () => {
          await this.saveToFile(fullPath, multerFile, buffers, size);

          multerFile.size = size;
        })
        .stream(passThroughStream, { end: true });
    }

    return next.handle();
  }
}
