import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderAppointmentService } from './services/order-appointment.service';
import { verifyRescheduleToken } from '../shared/security/reschedule-token.util';
import { SlotAvailabilityService } from '../shared/slot/services/slot-availability.service';
import { RequestContext } from '../shared/request-context/request-context.dto';
import { AppLogger } from '../shared/logger/logger.service';

@ApiTags('public')
@Controller('public')
export class OrderPublicController {
  constructor(
    private readonly slotAvailabilityService: SlotAvailabilityService,
    private readonly orderAppointmentService: OrderAppointmentService,
    private readonly logger: AppLogger,
  ) {}

  @Get('reschedule/slots')
  @ApiOperation({ summary: 'Get available slots for rescheduling (public)' })
  async getSlots(
    @Query('token') token: string,
    @Query('date') date?: string,
    @Query('graceHours') graceHours?: string,
  ) {
    const payload = verifyRescheduleToken(token);
    const ctx: RequestContext = {
      user: { id: 0, username: 'public', roles: [] },
      requestID: 'public',
      url: '/public/reschedule/slots',
      ip: '0.0.0.0',
    } as any;

    // Derive date range and slot duration from existing item data is non-trivial here;
    // we will reuse existing appointment slot and return near-future availability using shared services.
    // For an MVP, return no server-side filtering besides module-provided logic.
    // Use provided date if available; default to today (YYYY-MM-DD) if not
    const dateIso = date || new Date().toISOString().slice(0, 10);

    // Optional override of grace period hours for debugging
    const grace = graceHours ? Number.parseInt(graceHours, 10) : 24;

    this.logger.log(
      ctx,
      `Public reschedule slots - itemId(packageId)=${payload.itemId}, date=${dateIso}, graceHours=${grace}`,
    );

    const result = await this.slotAvailabilityService.getSlotsForPackage(
      ctx,
      dateIso,
      payload.itemId,
      grace,
    );
    return { data: result, meta: {} } as any;
  }

  @Post('reschedule/confirm')
  @ApiOperation({ summary: 'Confirm reschedule (public)' })
  async confirm(@Body() body: { token: string; newDateTimeISO: string }) {
    const payload = verifyRescheduleToken(body.token);
    const ctx: RequestContext = {
      user: { id: 0, username: 'public', roles: [] },
      requestID: 'public',
      url: '/public/reschedule/confirm',
      ip: '0.0.0.0',
    } as any;
    const saved = await this.orderAppointmentService.reschedule(
      ctx,
      payload.appointmentId,
      body.newDateTimeISO,
    );
    this.logger.log(
      ctx,
      `Public reschedule success for appointment ${saved.id}`,
    );
    return { data: { appointmentId: saved.id }, meta: {} } as any;
  }
}
