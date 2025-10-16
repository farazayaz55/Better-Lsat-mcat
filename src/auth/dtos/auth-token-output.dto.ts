import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { ROLE } from '../constants/role.constant';
import { IsNotEmpty, IsString } from 'class-validator';

export class AuthTokenOutput {
  @Expose()
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @Expose()
  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class UserAccessTokenClaims {
  @Expose()
  @ApiProperty({
    description: 'User ID',
    example: 1,
    type: Number,
  })
  id: number;
  @Expose()
  @ApiProperty({
    description: 'Username',
    example: 'john_doe',
    type: String,
  })
  username: string;
  @Expose()
  @ApiProperty({
    description: 'User roles',
    example: [ROLE.USER],
    enum: ROLE,
    isArray: true,
  })
  roles: ROLE[];
}

export class UserRefreshTokenClaims {
  @ApiProperty({
    description: 'User ID',
    example: 1,
    type: Number,
  })
  id: number;
}

export class loginOutput {
  @Expose()
  @ApiProperty({ type: AuthTokenOutput })
  auth: AuthTokenOutput;
  @Expose()
  @ApiProperty({ type: UserAccessTokenClaims })
  user: UserAccessTokenClaims;
}
