import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';

import { ROLE } from '../../auth/constants/role.constant';

export class CreateCustomerInput {
  // @ApiPropertyOptional()
  // @IsOptional()
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsPhoneNumber()
  phone: string;

  // @ApiPropertyOptional()
  // @IsOptional()
  // @IsNotEmpty()
  // @IsString()
  // lastName: string;

  // @ApiProperty()
  // @IsNotEmpty()
  // @Length(6, 100)
  // @IsAlphanumeric()
  // username: string;

  // @ApiProperty()
  // @IsNotEmpty()
  // @IsString()
  // @Length(6, 100)
  // password: string;

  @ApiProperty()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ROLE, { each: true })
  roles: ROLE[];

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(100)
  email: string;

  @ApiProperty()
  @IsBoolean()
  isAccountDisabled: boolean;
}
