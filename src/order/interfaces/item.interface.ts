import { IsArray, IsNumber, IsOptional,IsString } from 'class-validator';

export class ItemInput {
  @IsNumber()
  id: number;

  @IsNumber()
  price: number;

  @IsString()
  name: string;

  @IsString()
  Duration: string;

  @IsString()
  Description: string;

  @IsArray()
  @IsString({ each: true }) // ensure each element is a string
  DateTime: string[]; // ISO strings

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsNumber()
  assignedEmployeeId?: number; // Employee assigned to this item
}

// Array of items
export type Items = ItemInput[];
