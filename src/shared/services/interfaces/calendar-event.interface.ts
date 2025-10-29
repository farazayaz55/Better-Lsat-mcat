export interface OrderItem {
  id: number;
  name: string;
  Description?: string;
  Duration: number;
  quantity: number;
  price: number;
  DateTime: string[];
  assignedEmployeeIds?: number[];
}

export interface TaskEvent {
  id: number;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  priority: string;
  status: string;
  label: string;
}

export interface CalendarEventAttendee {
  email: string;
  displayName: string;
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
}

export interface CalendarEventReminder {
  method: 'email' | 'popup';
  minutes: number;
}

export interface CalendarEventExtendedProperties {
  orderId?: string;
  orderItemId?: string;
  customerEmail?: string;
  employeeEmail?: string;
  quantity?: string;
  price?: string;
  businessOwnerEmail?: string;
  taskId?: string;
  tutorEmail?: string;
  priority?: string;
  status?: string;
  label?: string;
  organizerUserId?: string;
  organizerRoles?: string;
}

export interface CalendarEventBase {
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  organizer?: {
    email: string;
    displayName: string;
  };
  attendees: CalendarEventAttendee[];
  reminders: {
    useDefault: boolean;
    overrides: CalendarEventReminder[];
  };
  extendedProperties?: {
    private: CalendarEventExtendedProperties;
  };
}

export interface AppointmentEvent extends CalendarEventBase {
  conferenceData?: {
    // Create a new conference
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: {
        type: 'hangoutsMeet';
      };
    };
    // OR reuse an existing conference
    conferenceId?: string;
    conferenceSolutionKey?: {
      type: 'hangoutsMeet';
    };
  };
}

export interface TaskEventData extends CalendarEventBase {
  // Task events don't have conference data
}
