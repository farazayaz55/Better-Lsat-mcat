# Google Calendar Integration - Shared Calendar Approach

This document explains how the Google Calendar integration works in the Better LSAT MCAT application using a **shared calendar approach**.

## Overview

The system uses a **shared Google Calendar** where:

- **You (business owner) are the organizer** of all events
- **Customers and employees are invitees** - they receive invitations but don't need to authorize anything
- **Service account manages the calendar** - but events appear to come from you
- **No user authorization required** - customers and employees just receive email invitations

## How It Works

### 1. Event Creation Flow

```
Customer places order → System creates calendar event → You (organizer) invites customer + employee
```

### 2. Event Structure

- **Organizer**: Your business email (Better LSAT MCAT)
- **Attendees**: Customer email + Assigned employee email
- **Location**: Your shared calendar
- **Invitations**: Automatically sent to all attendees

### 3. User Experience

- **Customers**: Receive email invitation, can accept/decline, no authorization needed
- **Employees**: Receive email invitation, can accept/decline, no authorization needed
- **You**: See all events in your shared calendar, manage everything from one place

## Setup Instructions

### Step 1: Create Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Calendar API
4. Go to "Credentials" → "Create Credentials" → "Service Account"
5. Download the JSON key file
6. Note the service account email (looks like: `your-service@project.iam.gserviceaccount.com`)

### Step 2: Create Shared Calendar

1. Go to [Google Calendar](https://calendar.google.com/)
2. Click "+" → "Create new calendar"
3. Name it "Better LSAT MCAT Appointments" (or similar)
4. Set it as your business calendar
5. Copy the calendar ID (looks like: `your-calendar@group.calendar.google.com`)

### Step 3: Share Calendar with Service Account

1. In your Google Calendar, click on the calendar name
2. Click "Settings and sharing"
3. Under "Share with specific people", add your service account email
4. Give it "Make changes to events" permission

### Step 4: Configure Environment Variables

Add these variables to your `.env` file:

```env
# Google Calendar Service Account Configuration
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Shared Calendar Configuration
GOOGLE_CALENDAR_ID=your-calendar@group.calendar.google.com
GOOGLE_BUSINESS_OWNER_EMAIL=your-business-email@gmail.com

# Timezone Configuration
VITE_DEFAULT_TIMEZONE=America/New_York
```

### Step 5: Restart Application

```bash
docker-compose restart
```

## Environment Variables Explained

| Variable                             | Description                                     | Example                                            |
| ------------------------------------ | ----------------------------------------------- | -------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`       | Service account email from Google Cloud Console | `calendar-service@project.iam.gserviceaccount.com` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Private key from service account JSON file      | `"-----BEGIN PRIVATE KEY-----\n..."`               |
| `GOOGLE_CALENDAR_ID`                 | Your shared calendar ID                         | `better-lsat-mcat@group.calendar.google.com`       |
| `GOOGLE_BUSINESS_OWNER_EMAIL`        | Your business email (will be the organizer)     | `your-business@gmail.com`                          |
| `VITE_DEFAULT_TIMEZONE`              | Default timezone for events                     | `America/New_York`                                 |

## How Events Are Created

### When an Order is Placed

1. **System processes order** with items (excluding ID 8 which uses GHL)
2. **For each item**, creates a Google Calendar event
3. **Event details**:
   - **Title**: `{Item Name} - Appointment`
   - **Organizer**: Your business email
   - **Attendees**: Customer + Assigned employee
   - **Description**: Includes order details and business branding
   - **Reminders**: 24 hours and 30 minutes before

### Event Properties

```typescript
{
  summary: "LSAT Tutoring - Appointment",
  description: "LSAT Tutoring Session\n\nThis appointment has been scheduled by Better LSAT MCAT.\n\nOrder Item ID: 123\nQuantity: 1\nPrice: $150",
  organizer: {
    email: "your-business@gmail.com",
    displayName: "Better LSAT MCAT"
  },
  attendees: [
    {
      email: "customer@example.com",
      displayName: "Customer",
      responseStatus: "needsAction"
    },
    {
      email: "employee@example.com",
      displayName: "Employee",
      responseStatus: "needsAction"
    }
  ],
  reminders: {
    useDefault: false,
    overrides: [
      { method: "email", minutes: 1440 }, // 24 hours
      { method: "popup", minutes: 30 }    // 30 minutes
    ]
  }
}
```

## Slot Availability System

### How It Works

The system uses your shared calendar to determine slot availability:

1. **Generates time slots** for 8AM-8PM Canadian timezone
2. **Checks calendar** for existing events
3. **Determines availability**:
   - **Available**: At least one employee is free
   - **Booked**: All employees are busy
4. **Smart assignment**: Assigns to least busy available employee

### Business Hours

- **Operating Hours**: 8:00 AM - 8:00 PM (Canadian time)
- **Slot Duration**: 60 minutes (or 15 minutes for service ID 8)
- **Timezone**: America/Toronto (properly handled)

### Availability Logic

```typescript
// A slot is available if at least one employee is free
const availableEmployees = employees.filter(
  (emp) => !busyEmployeeIds.includes(emp.id),
);

// A slot is booked only if ALL employees are busy
const isBooked = busyEmployeeIds.length === availableEmployees.length;
```

## Round-Robin Assignment

### Smart Employee Assignment

1. **Customer requests specific time** → System checks calendar availability
2. **Finds available employees** → Assigns to least busy one
3. **Creates calendar event** → Both customer and employee get invitations
4. **Updates availability** → Future requests reflect the new booking

### Assignment Logic

```typescript
// Priority: Available employees at requested time
const availableAtTime = await getAvailableEmployeesAtTime(
  requestedTime,
  employees,
);

if (availableAtTime.length > 0) {
  // Assign to least busy available employee
  const selectedEmployee = availableAtTime.sort(
    (a, b) => a.lastAssignedOrderCount - b.lastAssignedOrderCount,
  )[0];
} else {
  // Fall back to general round-robin
  const selectedEmployee = employees.sort(
    (a, b) => a.lastAssignedOrderCount - b.lastAssignedOrderCount,
  )[0];
}
```

## API Endpoints

### Get Available Slots

```http
GET /order/slots?date=15&month=1&year=2024&packageId=5&customerTimezone=America/New_York
```

**Response:**

```json
{
  "bookedSlots": ["2024-01-15T09:00:00.000Z", "2024-01-15T14:00:00.000Z"],
  "availableSlots": [
    {
      "slot": "2024-01-15T10:00:00.000Z",
      "availableEmployees": [
        {
          "id": 1,
          "name": "John Doe",
          "email": "john@example.com"
        }
      ]
    }
  ],
  "slotDurationMinutes": 60
}
```

### Create Order (with Calendar Event)

```http
POST /order
Content-Type: application/json

{
  "user": {
    "email": "customer@example.com",
    "name": "Jane Customer"
  },
  "items": [
    {
      "id": 5,
      "name": "LSAT Tutoring",
      "preferredDateTime": "2024-01-15T10:00:00.000Z",
      "duration": 60
    }
  ]
}
```

**What happens:**

1. Order is created
2. Employee is assigned (round-robin)
3. Google Calendar event is created
4. Both customer and employee receive email invitations

## Benefits of This Approach

### ✅ **No User Authorization Required**

- Customers don't need Google accounts
- Employees don't need to authorize anything
- Simple email invitation system

### ✅ **Centralized Management**

- All events in your shared calendar
- Easy to see all appointments
- Simple to manage and reschedule

### ✅ **Professional Appearance**

- Events appear to come from your business
- Consistent branding and messaging
- Professional email invitations

### ✅ **Real-time Availability**

- Always up-to-date slot availability
- No double-booking possible
- Smart employee assignment

### ✅ **Easy Setup**

- No complex OAuth flows
- Simple service account setup
- One shared calendar to manage

## Troubleshooting

### Common Issues

1. **"Config validation error"**
   - Check all environment variables are set
   - Verify email formats are correct

2. **"Calendar not found"**
   - Verify calendar ID is correct
   - Ensure service account has access to calendar

3. **"Permission denied"**
   - Check service account permissions
   - Verify calendar sharing settings

4. **Events not appearing**
   - Check calendar ID in environment variables
   - Verify service account email is added to calendar

### Testing the Integration

1. **Check slot availability**:

   ```bash
   curl "http://localhost:3000/order/slots?date=15&month=1&year=2024&packageId=5"
   ```

2. **Create test order**:

   ```bash
   curl -X POST "http://localhost:3000/order" \
     -H "Content-Type: application/json" \
     -d '{"user":{"email":"test@example.com","name":"Test User"},"items":[{"id":5,"name":"Test Service","preferredDateTime":"2024-01-15T10:00:00.000Z","duration":60}]}'
   ```

3. **Check your Google Calendar** for the new event

## Security Considerations

- **Service account** has minimal permissions (only calendar access)
- **Private key** is stored securely in environment variables
- **Calendar sharing** is limited to service account only
- **No user data** is stored in Google Calendar beyond what's necessary

## Support

If you encounter any issues:

1. Check the application logs: `docker-compose logs app`
2. Verify environment variables are set correctly
3. Test the Google Calendar API access
4. Check calendar sharing permissions

The shared calendar approach provides a simple, professional, and user-friendly way to manage appointments without requiring any user authorization! 🎉
