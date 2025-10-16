import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsPhoneNumber, IsString } from 'class-validator';

export class UserInput {
  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'Email', example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  // You can specify a region code like 'PK' or 'US' if you want stricter validation
  @ApiProperty({ description: 'Phone number', example: '+1234567890' })
  @IsPhoneNumber()
  phone: string;
}
