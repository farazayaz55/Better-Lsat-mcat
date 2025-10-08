import { IsEmail, IsPhoneNumber,IsString } from 'class-validator';

export class UserInput {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  // You can specify a region code like 'PK' or 'US' if you want stricter validation
  @IsPhoneNumber()
  phone: string;
}
