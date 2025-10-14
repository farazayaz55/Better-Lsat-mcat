export interface Slot {
  bookedSlots: string[];
  availableSlots: AvailableSlot[];
  slotDurationMinutes: number;
  warning?: string;
}

export interface AvailableSlot {
  slot: string;
  availableEmployees: {
    id: number;
    name: string;
    email: string;
  }[];
}
