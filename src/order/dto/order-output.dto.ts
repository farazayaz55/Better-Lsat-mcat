import { Expose, Type } from 'class-transformer';

export class ItemOutput {
  @Expose()
  id: number;

  @Expose()
  price: number;

  @Expose()
  name: string;

  @Expose()
  Duration: string;

  @Expose()
  Description: string;

  @Expose()
  DateTime: string[];

  @Expose()
  quantity: number;

  @Expose()
  assignedEmployeeId: number;
}

export class OrderOutput {
  @Expose()
  id: number;

  @Expose()
  customerId: number;

  @Expose()
  @Type(() => ItemOutput) // 👈 tell transformer how to map array
  items: ItemOutput[];
}
