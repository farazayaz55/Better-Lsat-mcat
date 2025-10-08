import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { RegisterInput } from '../../auth/dtos/auth-register-input.dto';
import { ItemInput } from '../../order/interfaces/item.interface';
import { UserInput } from '../../order/interfaces/user.interface';
import { UserService } from '../../user/services/user.service';
import { RequestContext } from '../request-context/request-context.dto';

@Injectable()
export class GhlService {
  private baseUrl = 'https://services.leadconnectorhq.com';
  private apiKey = process.env.GHL_TOKEN;

  constructor(private readonly userService: UserService) {}

  async createUser(user: RegisterInput) {
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

  async deleteUser(userId: string) {
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

  async getEmployees() {
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

  async getEmployee(ctx: RequestContext, id: number) {
    try {
      const user = await this.userService.getUserById(ctx, id);
      const employees = await this.getEmployees();
      const employee = employees.find(
        (employee: any) => employee.email === user.email,
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
  ) {
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
        console.log('created appointment res', res.data);
        return res;
      })
      .catch((error) => {
        console.error('err create appointment', error.response.data);
        throw new Error('Failed to create appointment in GHL');
      });
    return response.data;
  }

  async getCalendar() {
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
      .then((res: any) => res)
      .catch((error) => {
        console.error(error.response.data);
        throw new Error('Failed to get calendar in GHL');
      });
    return response.data.calendar;
  }

  async addUserToCalendar(user: any) {
    try {
      const calendar = await this.getCalendar();
      delete calendar.id;
      delete calendar.locationId;
      calendar.teamMembers.push({ userId: user.id });

      console.log(calendar);
      await axios
        .put(
          `${this.baseUrl}/calendars/${process.env.GHL_CALENDAR_ID}`,
          calendar,
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
          throw new Error('Failed to add user to calendar in GHL');
        });
    } catch (error: any) {
      console.error(error);
      throw new Error('Failed to add user to calendar in GHL');
    }
  }

  async getSlots(startDate: string, endDate: string) {
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

  async getContact(email: string) {
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
        console.log('res get contact', res.data.contacts);
        return res;
      })
      .catch((error) => {
        console.error('err get contact', error.response.data);
        throw new Error('Failed to get contact in GHL');
      });
    return response.data.contacts[0];
  }

  async createContact(user: UserInput) {
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
        console.log('res create contact', res.data);
        return res;
      })
      .catch((error) => {
        console.error('err create contact', error.response.data);
        throw new Error('Failed to create contact in GHL');
      });
    return response.data.contact;
  }
}
