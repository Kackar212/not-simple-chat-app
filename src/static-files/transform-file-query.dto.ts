import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsUrl, Max, Min } from 'class-validator';
import { SupportedFileFormat } from './supported-file-format.enum';

export class TransformFileQueryDTO {
  @IsEnum(SupportedFileFormat)
  @IsOptional()
  format?: SupportedFileFormat;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  width?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  height?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Max(100)
  @Min(0)
  quality?: number;
}
