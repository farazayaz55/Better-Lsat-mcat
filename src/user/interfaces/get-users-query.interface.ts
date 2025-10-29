import { IsEnum, IsOptional } from 'class-validator';
import { ROLE } from '../../auth/constants/role.constant';
import { PaginationParamsDto } from '../../shared/dtos/pagination-params.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetUsersQueryParams extends PaginationParamsDto {
  @ApiPropertyOptional({
    description: 'Filter users by role',
    enum: ROLE,
    type: String,
    example: ROLE.USER,
  })
  @IsOptional()
  @IsEnum(ROLE)
  role?: ROLE;
}
