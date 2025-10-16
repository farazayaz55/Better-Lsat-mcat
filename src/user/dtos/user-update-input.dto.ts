import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { ROLE } from '../../auth/constants/role.constant';

export class UpdateUserInput {
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  @IsString({ message: 'Name must be a string' })
  name: string;

  @ApiProperty({
    description: 'Username (alphanumeric)',
    example: 'john_doe',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Username is required' })
  @MaxLength(100, { message: 'Username must not exceed 100 characters' })
  @IsString({ message: 'Username must be a string' })
  username: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+1234567890',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Phone is required' })
  @MaxLength(100, { message: 'Phone must not exceed 100 characters' })
  @IsString({ message: 'Phone must be a string' })
  phone: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @MaxLength(100, { message: 'Email must not exceed 100 characters' })
  email: string;

  @ApiProperty({
    description: 'User roles',
    example: [ROLE.USER],
    enum: ROLE,
    isArray: true,
  })
  @IsNotEmpty({ message: 'Roles are required' })
  @IsArray({ message: 'Roles must be an array' })
  @IsEnum(ROLE, {
    each: true,
    message: 'Each role must be a valid ROLE enum value',
  })
  roles: ROLE[];

  @ApiPropertyOptional({
    description: 'Account disabled status',
    example: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean({ message: 'isAccountDisabled must be a boolean' })
  isAccountDisabled?: boolean;

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
  @IsObject({ message: 'Work hours must be an object' })
  workHours?: Record<string, string[]>;
}
