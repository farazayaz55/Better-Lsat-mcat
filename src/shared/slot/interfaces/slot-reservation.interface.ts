export interface SlotReservation {
  employeeId: number;
  status: string;
  expiresAt?: Date;
}

export interface SlotReservationMap {
  [slotTime: string]: SlotReservation[];
}

export interface ReservationValidationResult {
  isValid: boolean;
  conflictingSlots?: string[];
  errorMessage?: string;
}
