export interface Appointment {
  id: string;
  applicationId: string;
  datetime: string;
  address: string | null;
  googleCalendarEventId: string | null;
  calendarAdded: boolean;
}
