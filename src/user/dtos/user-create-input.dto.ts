import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsAlphanumeric,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import { ROLE } from '../../auth/constants/role.constant';

export class CreateUserInput {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsPhoneNumber()
  phone: string;

  @ApiProperty()
  @IsNotEmpty()
  @Length(6, 100)
  @IsAlphanumeric()
  username: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(6, 100)
  password?: string;

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

  @ApiPropertyOptional({
    description: 'Employee working hours in UTC format (HH:MM-HH:MM)',
    example: { Monday: ['09:00-17:00'], Tuesday: ['09:00-17:00'] },
  })
  @IsOptional()
  @IsObject()
  workHours?: Record<string, string[]>;

  ghlUserId?: string;
}
