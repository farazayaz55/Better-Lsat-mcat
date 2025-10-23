import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiExtraModels,
} from '@nestjs/swagger';
import { SlotService } from './services/slot.service';
import { SlotsQueryDto } from './dto/slots.query.dto';
import { Slot } from './interfaces/slot.interface';
import { BaseApiResponse } from '../dtos/base-api-response.dto';

@ApiTags('slots')
@ApiExtraModels(SlotsQueryDto)
@Controller('slots')
export class SlotController {
  constructor(private readonly slotService: SlotService) {}

  @Get()
  @ApiOperation({
    summary: 'Get available slots for a package',
    description:
      'Returns available and booked slots for the specified date and package. Used by Orders, Tasks, and Appointments.',
  })
  @ApiQuery({
    name: 'date',
    description: 'Date in ISO 8601 format (UTC timezone)',
    example: '2025-01-15T00:00:00.000Z',
    required: true,
    type: 'string',
  })
  @ApiQuery({
    name: 'packageId',
    description: 'Service/package ID',
    example: 5,
    required: true,
    type: 'number',
  })
  @ApiQuery({
    name: 'customerTimezone',
    description: 'Customer timezone (e.g., America/New_York, Europe/London)',
    example: 'America/New_York',
    required: false,
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Available and booked slots with employee details',
    type: Slot,
  })
  async getAvailableSlots(
    @Query() query: SlotsQueryDto,
  ): Promise<BaseApiResponse<Slot>> {
    const slots = await this.slotService.getSlotsForPackage(
      query.date,
      query.packageId,
    );
    return { data: slots, meta: {} };
  }
}
