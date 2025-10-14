export interface IGhlContact {
  id: string;
  dateAdded: string;
  dateUpdated: string;
  deleted: boolean;
  tags: string[];
  type: string;
  customFields: object[];
  locationId: string;
  firstName: string;
  firstNameLowerCase: string;
  fullNameLowerCase: string;
  lastName: string;
  lastNameLowerCase: string;
  email: string;
  emailLowerCase: string;
  bounceEmail: boolean;
  unsubscribeEmail: boolean;
  dnd: boolean;
  dndSettings: object;
  phone: string;
  address1: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  website: string;
  source: string;
  companyName: string;
  dateOfBirth: string;
  birthMonth: number;
  birthDay: number;
  lastSessionActivityAt: string;
  offers: string[];
  products: string[];
  businessId: string;
  assignedTo: string;
}

export interface IGhlUser {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  extension: string;
  permissions: object;
  scopes: string;
  roles: object;
  deleted: boolean;
  scopesAssignedToOnly: string[];
  profilePhoto: string;
  lcPhone: object;
}

export interface IOeleteUserResponse {
  message: string;
  statusCode?: number;
  succeded?: boolean;
}

export interface IAppointment {
  id: string;
  calendarId: string;
  locationId: string;
  contactId: string;
  startTime: string;
  endTime: string;
  title: string;
  meetingLocationType: string;
  appointmentStatus:
    | 'new'
    | 'confirmed'
    | 'cancelled'
    | 'showed'
    | 'noshow'
    | 'invalid';
  assignedUserId: string;
  address: string;
  isRecurring: boolean;
  rrule: string;
}

export interface ICalendar {
  id: string;
  isActive: boolean;
  notifications: object[];
  locationId: string;
  groupId: string;
  teamMembers: object[];
  eventType:
    | 'RoundRobin_OptimizeForAvailability'
    | 'RoundRobin_OptimizeForEqualDistribution';
  name: string;
  description: string;
  slug: string;
  widgetSlug: string;
  calendarType:
    | 'round_robin'
    | 'event'
    | 'class_booking'
    | 'collective'
    | 'service_booking'
    | 'personal';
  widgetType: 'default' | 'classic';
  eventTitle: string;
  eventColor: string;
  meetingLocation: string;
  locationConfigurations: object[];
  slotDuration: number;
  slotDurationUnit: 'mins' | 'hours';
  slotInterval: number;
  slotIntervalUnit: 'mins' | 'hours';
  slotBuffer: number;
  slotBufferUnit: 'mins' | 'hours';
  preBuffer: number;
  preBufferUnit: 'mins' | 'hours';
  appoinmentPerSlot: number;
  appoinmentPerDay: number;
  allowBookingAfter: number;
  allowBookingAfterUnit: 'hours' | 'days' | 'weeks' | 'months';
  allowBookingFor: number;
  allowBookingForUnit: 'days' | 'weeks' | 'months';
  openHours: object[];
  enableRecurring: boolean;
  recurring: object;
  formId: string;
  stickyContact: boolean;
  isLivePaymentMode: boolean;
  autoConfirm: boolean;
  shouldSendAlertEmailsToAssignedMember: boolean;
  alertEmail: string;
  googleInvitationEmails: boolean;
  allowReschedule: boolean;
  allowCancellation: boolean;
  shouldAssignContactToTeamMember: boolean;
  shouldSkipAssigningContactForExisting: boolean;
  notes: string;
  pixelId: string;
  formSubmitType: 'RedirectURL' | 'ThankYouMessage';
  formSubmitRedirectURL: string;
  formSubmitThanksMessage: string;
  availabilityType: 0 | 1;
  availabilities: object[];
  guestType: 'count_only' | 'collect_detail';
  consentLabel: string;
  calendarCoverImage: string;
  lookBusyConfig: object;
}
