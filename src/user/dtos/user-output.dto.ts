import { ApiProperty } from '@nestjs/swagger';
import { BaseUserOutput } from '../../shared/dtos/base-user-output.dto';
import { Expose, Transform } from 'class-transformer';
import { ROLE } from '../../auth/constants/role.constant';

export class UserOutput extends BaseUserOutput {
  @Expose()
  @Transform(({ obj, value }) => {
    // Only expose workHours if the user has CUSTOMER role
    return obj.roles && obj.roles.includes(ROLE.USER) ? value : undefined;
  })
  @ApiProperty({
    description: 'Work hours for employees ',
    example: { Monday: ['09:00-17:00'], Tuesday: ['09:00-17:00'] },
    required: false,
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: {
        type: 'string',
        example: '09:00-17:00',
      },
    },
  })
  workHours: Record<string, string[]>;
}
