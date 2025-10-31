import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum AttendanceStatusDto {
  SHOWED = 'showed',
  NO_SHOW = 'no_show',
}

export class UpdateSessionAttendanceDto {
  @ApiProperty({
    description: 'Index of the session within item.sessions[]',
    example: 0,
  })
  @IsNumber()
  sessionIndex: number;

  @ApiProperty({
    description: 'Attendance status to set',
    enum: AttendanceStatusDto,
  })
  @IsEnum(AttendanceStatusDto)
  status: AttendanceStatusDto;

  @ApiPropertyOptional({
    description: 'Datetime when attendance occurred; defaults to now()',
    example: '2025-11-01T15:35:00.000Z',
  })
  @IsOptional()
  @IsString()
  occurredAt?: string;
}
