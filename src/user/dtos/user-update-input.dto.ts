import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ROLE } from '../../auth/constants/role.constant';

export class UpdateUserInput {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(100)
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(100)
  @IsString()
  username: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(100)
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(100)
  @IsString()
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(100)
  @IsString()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  roles: ROLE[];
}
