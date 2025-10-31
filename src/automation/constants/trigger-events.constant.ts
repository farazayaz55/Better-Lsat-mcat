export enum TriggerEvent {
  ORDER_CREATED = 'order.created',
  ORDER_PAID = 'order.paid',
  ORDER_CANCELED = 'order.canceled', // Future
  ORDER_MODIFIED = 'order.modified', // Future
  ORDER_COMPLETED = 'order.completed',
  USER_REGISTERED = 'user.registered', // Future
  PAYMENT_REFUNDED = 'payment.refunded', // Future
  TASK_CREATED = 'task.created', // Future
  TASK_COMPLETED = 'task.completed', // Future
  ORDER_APPOINTMENT_NO_SHOW = 'order.appointment.no_show',
  ORDER_APPOINTMENT_SHOWED = 'order.appointment.showed',
}
