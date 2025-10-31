import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateOrderNotesDto {
  @ApiProperty({
    description: 'Free-form notes for the order',
    example: 'Prefers evenings; focus on logic games.',
  })
  @IsString()
  notes: string;
}
