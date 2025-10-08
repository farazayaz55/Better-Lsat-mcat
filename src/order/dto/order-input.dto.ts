import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty,ValidateNested } from 'class-validator';

import { ItemInput, Items } from '../interfaces/item.interface';
import { UserInput } from '../interfaces/user.interface';

export class OrderInput {
  @ApiProperty({ type: [ItemInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemInput)
  @IsNotEmpty()
  items: Items;

  @ApiProperty({ type: UserInput })
  @ValidateNested()
  @Type(() => UserInput)
  @IsNotEmpty()
  user: UserInput;
}
