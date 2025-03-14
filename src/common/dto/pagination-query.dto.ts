import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDTO {
  @Transform((v) => Number(v.value))
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  perPage: number = 50;

  @IsInt()
  @Transform((v) => Number(v.value))
  @IsOptional()
  before?: number;

  @IsInt()
  @Transform((v) => Number(v.value))
  @IsOptional()
  after?: number;
}
