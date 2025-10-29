import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { ROLE } from '../constants/role.constant';

export class RegisterInput {
  @ApiProperty()
  @IsNotEmpty()
  @MaxLength(100)
  @IsString()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsPhoneNumber()
  phone: string;

  @ApiProperty()
  @MaxLength(200)
  @IsString()
  username: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((o) => o.password && o.password.trim().length > 0)
  @Length(6, 100)
  @IsString()
  password?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(100)
  email: string;

  @ApiProperty({
    example: [ROLE.USER],
    enum: ROLE,
    isArray: true,
    description: 'User roles',
  })
  @IsNotEmpty()
  roles: ROLE[] = [ROLE.USER];

  @ApiPropertyOptional({
    description: 'Employee working hours in UTC format (HH:MM-HH:MM)',
    example: { Monday: ['09:00-17:00'], Tuesday: ['09:00-17:00'] },
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: {
        type: 'string',
        example: '09:00-17:00',
      },
    },
  })
  @IsOptional()
  @IsObject()
  workHours?: Record<string, string[]>;

  ghlUserId?: string;

  isAccountDisabled: boolean;
}
