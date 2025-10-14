/* eslint-disable unicorn/filename-case */
import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { RegisterInput } from '../../auth/dtos/auth-register-input.dto';
import { ItemInput } from '../../order/interfaces/item.interface';
import { UserInput } from '../../order/interfaces/user.interface';
import { UserService } from '../../user/services/user.service';
import { RequestContext } from '../request-context/request-context.dto';
import {
  IOeleteUserResponse,
  IGhlUser,
  IAppointment,
  ICalendar,
  IGhlContact,
} from './interfaces/ghl.interface';

@Injectable()
export class GhlService {
  private baseUrl = 'https://services.leadconnectorhq.com';
  private apiKey = process.env.GHL_TOKEN;

  constructor(private readonly userService: UserService) {}

  async createUser(user: RegisterInput): Promise<IGhlUser> {
    const requestBody = {
      // firstName: 'John',
      // lastName: 'Deo',
      // email: 'john@deo.com',
      // password: '*******',
      // phone: '+18832327657',
      // type: 'account',
      // role: 'admin',
      firstName: user.name,
      lastName: user.name,
      email: user.email,
      password: user.password,
      phone: user.phone,
      type: 'account',
      role: 'admin',
      locationIds: [process.env.GHL_LOCATION_ID],
      companyId: process.env.GHL_COMPANY_ID,
    };
    const response = await axios
      .post(`${this.baseUrl}/users/`, requestBody, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Version: '2021-07-28',
          Accept: 'application/json',
          'Content-Type': 'application/json',
          LocationId: process.env.GHL_LOCATION_ID,
        },
      })
      .then((res) => res)
      .catch((error) => {
        console.error(error.response.data);
        throw new Error('Failed to create user in GHL');
      });
    return response.data;
  }

  async deleteUser(userId: string): Promise<IOeleteUserResponse> {
    const response = await axios
      .delete(`${this.baseUrl}/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Version: '2021-07-28',
          Accept: 'application/json',
          'Content-Type': 'application/json',
          LocationId: process.env.GHL_LOCATION_ID,
        },
      })
      .then((res) => res)
      .catch((error) => {
        console.error(error.response.data);
        throw new Error('Failed to delete user in GHL');
      });
    return response.data;
  }

  async getEmployees(): Promise<IGhlUser[]> {
    const response = await axios
      .get(`${this.baseUrl}/users/?locationId=${process.env.GHL_LOCATION_ID}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Version: '2021-07-28',
          Accept: 'application/json',
          'Content-Type': 'application/json',
          LocationId: process.env.GHL_LOCATION_ID,
        },
      })
      .then((res) => res)
      .catch((error) => {
        console.error('error', error);
        throw new Error('Failed to get employees in GHL');
      });
    const data = response.data.users;
    return data;
  }

  async getEmployee(
    ctx: RequestContext,
    id: number,
  ): Promise<IGhlUser | undefined> {
    try {
      const user = await this.userService.getUserById(ctx, id);
      const employees = await this.getEmployees();
      const employee = employees.find(
        (employee: IGhlUser) => employee.email === user.email,
      );
      return employee;
    } catch (error) {
      console.error(error);
      throw new Error('Failed to get employee in GHL');
    }
  }

  async createAppointment(
    ctx: RequestContext,
    appointment: ItemInput,
    contactId: string,
  ): Promise<IAppointment> {
    if (!appointment.assignedEmployeeId) {
      throw new Error('No employee assigned to this item');
    }
    const appointmentData = {
      title: appointment.name,
      appointmentStatus: 'confirmed',
      assignedUserId: (
        await this.getEmployee(ctx, appointment.assignedEmployeeId)
      )?.id,
      // address: 'Zoom',
      // ignoreDateRange: false,
      // toNotify: false,
      // ignoreFreeSlotValidation: true,
      // rrule: 'RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5',
      calendarId: process.env.GHL_CALENDAR_ID,
      locationId: process.env.GHL_LOCATION_ID,
      contactId,
      startTime: appointment.DateTime[0],
      endTime: new Date(
        new Date(appointment.DateTime[0]).getTime() + 15 * 60 * 1000,
      ).toISOString(),
    };
    const response = await axios
      .post(`${this.baseUrl}/calendars/events/appointments`, appointmentData, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Version: '2021-07-28',
          Accept: 'application/json',
          'Content-Type': 'application/json',
          LocationId: process.env.GHL_LOCATION_ID,
        },
      })
      .then((res) => {
        return res;
      })
      .catch((error) => {
        console.error('err create appointment', error.response.data);
        throw new Error('Failed to create appointment in GHL');
      });
    return response.data;
  }

  async getCalendar(): Promise<ICalendar> {
    const response = await axios
      .get(`${this.baseUrl}/calendars/${process.env.GHL_CALENDAR_ID}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Version: '2021-07-28',
          Accept: 'application/json',
          'Content-Type': 'application/json',
          LocationId: process.env.GHL_LOCATION_ID,
        },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res: any) => res)
      .catch((error) => {
        console.error(error.response.data);
        throw new Error('Failed to get calendar in GHL');
      });
    return response.data.calendar;
  }

  async addUserToCalendar(user: IGhlUser): Promise<ICalendar> {
    try {
      const calendar = await this.getCalendar();
      // Create a copy without id and locationId for the update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, locationId: _locationId, ...calendarUpdate } = calendar;
      calendarUpdate.teamMembers.push({ userId: user.id });

      const response = await axios.put(
        `${this.baseUrl}/calendars/${process.env.GHL_CALENDAR_ID}`,
        calendarUpdate,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Version: '2021-07-28',
            Accept: 'application/json',
            'Content-Type': 'application/json',
            LocationId: process.env.GHL_LOCATION_ID,
          },
        },
      );

      return response.data.calendar;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error(error);
      throw new Error('Failed to add user to calendar in GHL');
    }
  }

  async getSlots(startDate: string, endDate: string): Promise<string[]> {
    //looking at mustafa's calendar
    const response = await axios
      .get(
        `${this.baseUrl}/calendars/ykgARKRGf5mpZC3nHOYQ/free-slots?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Version: '2021-07-28',
            Accept: 'application/json',
            'Content-Type': 'application/json',
            LocationId: process.env.GHL_LOCATION_ID,
          },
        },
      )
      .then((res) => res)
      .catch((error) => {
        console.error(error.response.data);
        throw new Error('Failed to get slots in GHL');
      });

    const data = response.data;
    return data;
  }

  async getContact(email: string): Promise<IGhlContact | undefined> {
    console.log('getContact called with email:', email);
    const response = await axios
      .get(
        `${this.baseUrl}/contacts/?locationId=${process.env.GHL_LOCATION_ID}&query=${email}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Version: '2021-07-28',
            Accept: 'application/json',
            'Content-Type': 'application/json',
            LocationId: process.env.GHL_LOCATION_ID,
          },
        },
      )
      .then((res) => {
        console.log('Email search response:', res.data);
        return res;
      })
      .catch((error) => {
        console.error('err get contact', error.response?.data);
        throw new Error('Failed to get contact in GHL');
      });
    const contact = response.data.contacts[0];
    console.log(
      'Email search result:',
      contact ? 'Found contact' : 'No contact found',
    );
    return contact;
  }

  async getAllContacts(): Promise<IGhlContact[]> {
    console.log('getAllContacts called');
    const response = await axios
      .get(
        `${this.baseUrl}/contacts/?locationId=${process.env.GHL_LOCATION_ID}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Version: '2021-07-28',
            Accept: 'application/json',
            'Content-Type': 'application/json',
            LocationId: process.env.GHL_LOCATION_ID,
          },
        },
      )
      .then((res) => {
        console.log(
          'All contacts response count:',
          res.data.contacts?.length || 0,
        );
        return res;
      })
      .catch((error) => {
        console.error('err get all contacts', error.response?.data);
        throw new Error('Failed to get all contacts from GHL');
      });
    return response.data.contacts || [];
  }

  async getContactByPhone(phone: string): Promise<IGhlContact | undefined> {
    console.log('getContactByPhone called with phone:', phone);

    try {
      const allContacts = await this.getAllContacts();
      console.log(
        'Searching through',
        allContacts.length,
        'contacts for phone:',
        phone,
      );

      // Normalize phone number for comparison (remove spaces, dashes, parentheses)
      // eslint-disable-next-line unicorn/better-regex
      const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

      const contact = allContacts.find((contact: IGhlContact) => {
        if (!contact.phone) {
          return false;
        }

        // Normalize stored phone number for comparison
        // eslint-disable-next-line unicorn/better-regex
        const normalizedStoredPhone = contact.phone.replace(/[\s\-\(\)]/g, '');

        // Check for exact match or if one contains the other
        return (
          normalizedStoredPhone === normalizedPhone ||
          normalizedStoredPhone.includes(normalizedPhone) ||
          normalizedPhone.includes(normalizedStoredPhone)
        );
      });

      console.log(
        'Phone search result:',
        contact ? 'Found contact' : 'No contact found',
      );

      return contact;
    } catch (error) {
      console.error('Error in getContactByPhone:', error);
      throw error;
    }
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  async getOrCreateContact(user: UserInput): Promise<IGhlContact> {
    console.log('getOrCreateContact called with:', {
      email: user.email,
      phone: user.phone,
    });

    // First try to find by email
    let contact = await this.getContact(user.email);
    console.log('Contact found by email:', contact ? 'Yes' : 'No');

    // If not found by email, try to find by phone
    if (!contact && user.phone) {
      console.log('Searching by phone:', user.phone);
      contact = await this.getContactByPhone(user.phone);
      console.log('Contact found by phone:', contact ? 'Yes' : 'No');
    }

    // If still not found, create a new contact
    if (!contact) {
      console.log('No contact found, attempting to create new contact');
      try {
        contact = await this.createContact(user);
        console.log('Contact created successfully');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.log('Contact creation failed:', error.response?.data);
        // If creation fails due to duplicate phone, try to find by phone again
        if (
          error.response?.data?.message &&
          error.response.data.message.includes('duplicated contacts') &&
          user.phone
        ) {
          console.log('Duplicate contact detected, searching by phone again');
          contact = await this.getContactByPhone(user.phone);
          console.log(
            'Contact found after duplicate error:',
            contact ? 'Yes' : 'No',
          );
        } else {
          throw error;
        }
      }
    }

    return contact as IGhlContact;
  }

  async createContact(user: UserInput): Promise<IGhlContact> {
    const contactData = {
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.firstName + ' ' + user.lastName,
      email: user.email,
      // "locationId": "ve9EPM428h8vShlRW1KT",
      locationId: process.env.GHL_LOCATION_ID,
      // "gender": "male",
      phone: user.phone,
      // "address1": "3535 1st St N",
      // "city": "Dolomite",
      // "state": "AL",
      // "postalCode": "35061",
      // "website": "https://www.tesla.com",
      // "timezone": "America/Chihuahua",
      // "dnd": true,
      // "dndSettings": {
      //   "Call": {
      //     "status": "active",
      //     "message": "string",
      //     "code": "string"
      //   },
      //   "Email": {
      //     "status": "active",
      //     "message": "string",
      //     "code": "string"
      //   },
      //   "SMS": {
      //     "status": "active",
      //     "message": "string",
      //     "code": "string"
      //   },
      //   "WhatsApp": {
      //     "status": "active",
      //     "message": "string",
      //     "code": "string"
      //   },
      //   "GMB": {
      //     "status": "active",
      //     "message": "string",
      //     "code": "string"
      //   },
      //   "FB": {
      //     "status": "active",
      //     "message": "string",
      //     "code": "string"
      //   }
      // },
      // "inboundDndSettings": {
      //   "all": {
      //     "status": "active",
      //     "message": "string"
      //   }
      // },
      // "tags": [
      //   "nisi sint commodo amet",
      //   "consequat"
      // ],
      // "customFields": [
      //   {
      //     "id": "6dvNaf7VhkQ9snc5vnjJ",
      //     "key": "my_custom_field",
      //     "field_value": "My Text"
      //   }
      // ],
      // "source": "public api",
      // "country": "US",
      // "companyName": "DGS VolMAX",
      // "assignedTo": "y0BeYjuRIlDwsDcOHOJo"
    };
    const response = await axios
      .post(`${this.baseUrl}/contacts/`, contactData, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Version: '2021-07-28',
          Accept: 'application/json',
          'Content-Type': 'application/json',
          LocationId: process.env.GHL_LOCATION_ID,
        },
      })
      .then((res) => {
        return res;
      })
      .catch((error) => {
        console.error('err create contact', error.response.data);
        throw new Error('Failed to create contact in GHL');
      });
    return response.data.contact;
  }
}
