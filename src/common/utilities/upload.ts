import { Destinations } from 'src/common/types/destinations.type';
import sharp from 'sharp';
import path from 'path';
import { open, unlink, writeFile } from 'fs/promises';
import Ffmpeg from 'fluent-ffmpeg-7';
import { UploadDestination } from '../constants';
import { FileTypeValidator, MaxFileSizeValidator } from '@nestjs/common';

export const validators = [
  new MaxFileSizeValidator({ maxSize: 256 * 1024 }),
  new FileTypeValidator({
    fileType: /^image\/(jpg|png|gif|jpeg|webp)/,
  }),
];

export function getFileUrl(destination: Destinations, filename: string) {
  return new URL(`${destination}/${filename}`, process.env.APP_URL).toString();
}

export async function createPlaceholder(fullPath: string | Buffer) {
  const {
    data: placeholder,
    info: { format },
  } = await sharp(fullPath)
    .resize(16, 16, { fit: 'inside' })
    .webp({ quality: 20, alphaQuality: 20, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  return `data:image/${format};base64,${placeholder.toString('base64')}` as const;
}

export async function convertVideo(fullPath: string, data: Buffer) {
  const tmp = `${fullPath}.temp`;

  await writeFile(tmp, data, { flag: 'w' });
  const handle = await open(fullPath, 'a');
  await handle.close();

  await new Promise((resolve) => {
    Ffmpeg()
      .input(tmp)
      .outputOptions([
        '-c:v libx264',
        '-movflags frag_keyframe+empty_moov',
        '-movflags +faststart',
        '-crf 28',
        '-preset medium',
      ])
      .saveToFile(fullPath)
      .on('end', async () => {
        await unlink(tmp);

        resolve(1);
      });
  });
}

export function createPoster(videoPath: string) {
  const posterPath = path.join(
    UploadDestination.Posters,
    path.basename(videoPath).replace(path.extname(videoPath), '.webp'),
  );

  const posterFullPath = path.join(process.cwd(), 'public', posterPath);

  const posterUrl = new URL(posterPath, process.env.APP_URL);

  return new Promise<string>((resolve) => {
    Ffmpeg(videoPath)
      .inputOptions(['-ss 1'])
      .outputOptions(['-frames 1'])
      .saveToFile(posterFullPath)
      .on('end', () => {
        resolve(posterUrl.toString());
      });
  });
}
