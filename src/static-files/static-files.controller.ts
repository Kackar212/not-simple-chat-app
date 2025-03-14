import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { stat } from 'fs/promises';
import path from 'path';
import sharp, { Sharp } from 'sharp';
import { SupportedFileFormat } from './supported-file-format.enum';
import { StaticFilesService } from './static-files.service';
import { TransformFileQueryDTO } from './transform-file-query.dto';
import ffmpeg from 'fluent-ffmpeg-7';

@Controller('/')
export class StaticFilesController {
  constructor(private readonly staticFilesService: StaticFilesService) {}

  fileExists(path: string) {
    return stat(`./public/${path}`)
      .then(() => true)
      .catch(() => false);
  }

  @Get('/:dest(attachments|avatars|server-icons|posters|emojis|external)/:file')
  async getFile(
    @Req() request: Request,
    @Res() res: Response,
    @Query()
    { format, width, height, quality = 75 }: TransformFileQueryDTO,
  ) {
    const { pathname } = new URL(request.url, process.env.APP_URL);

    res.setHeader('Cache-Control', 'public, max-age=2592000');

    let ext = path.extname(pathname).substring(1) as SupportedFileFormat;
    ext = ext === SupportedFileFormat.Jpg ? SupportedFileFormat.Jpeg : ext;

    const fullPath = path.join(process.cwd(), 'public', pathname);

    if (!format && !width && !height) {
      res.sendFile(fullPath);

      return;
    }

    if (width && height && (width < 1 || height < 1)) {
      res.sendFile(fullPath);

      return;
    }

    const fileStats: ffmpeg.FfprobeFormat | false = await new Promise(
      (resolve) => {
        ffmpeg.ffprobe(
          path.join('public', pathname),
          (err: any, metadata: ffmpeg.FfprobeData) => {
            if (err) {
              resolve(false);
            }

            resolve(metadata);
          },
        );
      },
    );

    const imageFormats: SupportedFileFormat[] = [
      SupportedFileFormat.Jpeg,
      SupportedFileFormat.Jpg,
      SupportedFileFormat.Png,
      SupportedFileFormat.Webp,
      SupportedFileFormat.Gif,
      SupportedFileFormat.Avif,
      SupportedFileFormat.Tiff,
    ];

    if (!imageFormats.includes(ext)) {
      return res.sendFile(fullPath);
    }

    if (ext === 'gif' && format === 'mp4') {
      if (!fileStats) {
        res.sendFile(fullPath);

        return;
      }

      await this.staticFilesService.gifToMp4(
        res,
        fullPath,
        fileStats,
        width,
        height,
      );

      return {};
    }

    if (
      !imageFormats.includes(ext) ||
      (format && !imageFormats.includes(format))
    ) {
      return res.sendFile(fullPath);
    }

    const sharpInstance = sharp(fullPath, { animated: true });
    const instanceMetadata = await sharpInstance.metadata();
    const { height: imageHeight = 0 } = instanceMetadata;
    const { width: imageWidth = 0, pageHeight = imageHeight } =
      instanceMetadata;

    sharpInstance.resize({
      fit: 'contain',
      width: width && imageWidth > width ? Number(width) : undefined,
      height: height && pageHeight > height ? Number(height) : undefined,
    });

    const toFormat = sharpInstance[format as keyof Sharp];

    if (typeof toFormat === 'function') {
      /* @ts-expect-error sharp.format returns undefined for avif so i need to use specific method instead of sharp.toFormat
       */
      toFormat.call(sharpInstance, { quality });
    }

    res.writeHead(200, {
      'content-type': `image/${format || ext}`,
    });

    sharpInstance.pipe(res, { end: true });

    await new Promise((resolve) => {
      sharpInstance.on('end', resolve);
    });

    return;
  }
}
