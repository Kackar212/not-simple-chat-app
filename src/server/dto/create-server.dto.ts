import { IsOptional, IsString, Length } from 'class-validator';
import {
  FileSystemStoredFile,
  HasMimeType,
  IsFile,
  MaxFileSize,
} from 'nestjs-form-data';

const MAX_FILE_SIZE = 1024 ** 2 * 2;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export class CreateServerDTO {
  @IsString()
  @Length(3, 32)
  name: string;

  @IsFile()
  @IsOptional()
  @MaxFileSize(MAX_FILE_SIZE)
  @HasMimeType(ALLOWED_MIME_TYPES)
  serverIcon?: FileSystemStoredFile;

  @IsString()
  @Length(3, 500)
  @IsOptional()
  description?: string;
}
