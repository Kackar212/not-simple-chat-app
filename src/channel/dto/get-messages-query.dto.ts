import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import { PaginationQueryDTO } from 'src/common/dto/pagination-query.dto';

export class GetMessagesQuery extends PaginationQueryDTO {
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsInt()
  @IsOptional()
  around?: number;
}
