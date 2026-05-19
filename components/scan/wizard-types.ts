export interface JobItem {
  id: string;
  name: string;
  quantity: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  /** Volume per single unit, in m³. */
  volume_m3: number;
  category?: string;
  source: "ai" | "manual";
  /** Optional thumbnail (data URL or object URL). */
  photoDataUrl?: string;
}

export type WizardStep = "method" | "inventory" | "stops" | "details";
export type InventoryMethod = "ai" | "manual";

export type StopType = "PICKUP" | "DELIVERY";

export interface MoveStop {
  id: string;
  type: StopType;
  label?: string;
  address: string;
  floor: number;
  elevator: ElevatorSize;
  notes?: string;
  /** Item IDs (from JobItem.id) included in this stop. */
  itemIds: string[];
}

export type ElevatorSize = "none" | "small" | "medium" | "large";
export type CraneRequirement = "none" | "some" | "all";
export type TruckAccess = "easy" | "limited" | "narrow";

export interface PropertyDetails {
  fromFloor: number;
  toFloor: number;
  fromElevator: ElevatorSize;
  toElevator: ElevatorSize;
  crane: CraneRequirement;
  packing: boolean;
  truckAccess: TruckAccess;
  notes: string;
}

export interface RouteInfo {
  from: string;
  to: string;
  when: string;
  flex: number;
  shared: boolean;
  type: string;
}

export interface WizardState {
  step: WizardStep;
  method: InventoryMethod | null;
  items: JobItem[];
  property: PropertyDetails;
  route: RouteInfo;
  multiStop: boolean;
  stops: MoveStop[];
}

export const DEFAULT_PROPERTY: PropertyDetails = {
  fromFloor: 0,
  toFloor: 0,
  fromElevator: "none",
  toElevator: "none",
  crane: "none",
  packing: false,
  truckAccess: "easy",
  notes: "",
};
