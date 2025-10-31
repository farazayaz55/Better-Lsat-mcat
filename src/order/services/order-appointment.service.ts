import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { TriggerEvent } from '../../automation/constants/trigger-events.constant';
import { Order , OrderStatus } from '../entities/order.entity';
import {
  OrderAppointment,
  OrderAppointmentAttendanceStatus,
  OrderTag,
} from '../entities/order-appointment.entity';

@Injectable()
export class OrderAppointmentService {
  constructor(
    @InjectRepository(OrderAppointment)
    private readonly appointmentRepo: Repository<OrderAppointment>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(OrderAppointmentService.name);
  }

  async createFromOrder(ctx: RequestContext, order: Order): Promise<void> {
    if (!order.items?.length) {return;}

    const appointments: OrderAppointment[] = [];
    for (const item of order.items) {
      const times: string[] = item.DateTime || [];
      const employeeIds: Array<number | undefined> =
        item.assignedEmployeeIds || [];
      for (const [idx, iso] of times.entries()) {
        const appt = this.appointmentRepo.create({
          orderId: order.id,
          itemId: item.id,
          slotDateTime: new Date(iso),
          assignedEmployeeId: employeeIds[idx] ?? null,
          attendanceStatus: OrderAppointmentAttendanceStatus.UNKNOWN,
        });
        appointments.push(appt);
      }
    }
    if (appointments.length > 0) {
      await this.appointmentRepo.save(appointments);
    }
  }

  async listByOrder(orderId: number): Promise<OrderAppointment[]> {
    return this.appointmentRepo.find({ where: { orderId } });
  }

  async getById(appointmentId: number): Promise<OrderAppointment | null> {
    return this.appointmentRepo.findOne({ where: { id: appointmentId } });
  }

  async reschedule(
    ctx: RequestContext,
    appointmentId: number,
    newDateTimeISO: string,
  ): Promise<OrderAppointment> {
    const appt = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
    });
    if (!appt) {throw new NotFoundException('Appointment not found');}

    const oldDate = appt.slotDateTime;
    appt.slotDateTime = new Date(newDateTimeISO);
    appt.attendanceStatus = OrderAppointmentAttendanceStatus.UNKNOWN;
    appt.attendanceMarkedAt = null;
    appt.attendanceMarkedBy = null;
    const saved = await this.appointmentRepo.save(appt);

    // Recompute tags
    const all = await this.appointmentRepo.find({
      where: { orderId: appt.orderId },
    });
    const hasNoShow = all.some(
      (a) => a.attendanceStatus === OrderAppointmentAttendanceStatus.NO_SHOW,
    );
    const hasShowed = all.some(
      (a) => a.attendanceStatus === OrderAppointmentAttendanceStatus.SHOWED,
    );
    const tags: OrderTag[] = [];
    if (hasShowed) {tags.push(OrderTag.SHOWED);}
    if (hasNoShow) {tags.push(OrderTag.NO_SHOW);}
    await this.orderRepo.update(appt.orderId, {
      tags,
      orderStatus: OrderStatus.IN_PROGRESS,
    });

    this.logger.log(
      ctx,
      `Rescheduled appointment ${appointmentId} from ${oldDate?.toISOString()} to ${newDateTimeISO}`,
    );
    return saved;
  }

  async markAttendance(
    ctx: RequestContext,
    appointmentId: number,
    status: OrderAppointmentAttendanceStatus,
    markedByUserId?: number,
  ): Promise<OrderAppointment> {
    const appt = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
    });
    if (!appt) {throw new NotFoundException('Appointment not found');}

    appt.attendanceStatus = status;
    appt.attendanceMarkedAt = new Date();
    appt.attendanceMarkedBy = markedByUserId ?? null;
    const saved = await this.appointmentRepo.save(appt);

    // Update order tags based on aggregate of appointments
    const all = await this.appointmentRepo.find({
      where: { orderId: appt.orderId },
    });
    const hasNoShow = all.some(
      (a) => a.attendanceStatus === OrderAppointmentAttendanceStatus.NO_SHOW,
    );
    const hasShowed = all.some(
      (a) => a.attendanceStatus === OrderAppointmentAttendanceStatus.SHOWED,
    );

    const tags: OrderTag[] = [];
    if (hasShowed) {tags.push(OrderTag.SHOWED);}
    if (hasNoShow) {tags.push(OrderTag.NO_SHOW);}
    await this.orderRepo.update(appt.orderId, { tags });

    // If all appointments are SHOWED, mark order completed
    const allShowed =
      all.length > 0 &&
      all.every(
        (a) => a.attendanceStatus === OrderAppointmentAttendanceStatus.SHOWED,
      );
    if (allShowed) {
      await this.orderRepo.update(appt.orderId, {
        orderStatus: OrderStatus.COMPLETED,
        completedAt: new Date(),
      });
      this.eventEmitter.emit(TriggerEvent.ORDER_COMPLETED, {
        ctx,
        orderId: appt.orderId,
      });
    }

    // Emit automation events per-appointment
    // Load order relation with customer for automation payload
    const appointmentWithOrder = await this.appointmentRepo.findOne({
      where: { id: saved.id },
      relations: ['order', 'order.customer'],
    });

    if (status === OrderAppointmentAttendanceStatus.NO_SHOW) {
      this.eventEmitter.emit(TriggerEvent.ORDER_APPOINTMENT_NO_SHOW, {
        ctx,
        appointment: appointmentWithOrder || saved,
      });
    } else if (status === OrderAppointmentAttendanceStatus.SHOWED) {
      this.eventEmitter.emit(TriggerEvent.ORDER_APPOINTMENT_SHOWED, {
        ctx,
        appointment: appointmentWithOrder || saved,
      });
    }

    this.logger.log(
      ctx,
      `Marked attendance ${status} for appointment ${appointmentId}`,
    );
    return saved;
  }
}
