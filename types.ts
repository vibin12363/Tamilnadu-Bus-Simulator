export enum GameMode {
  MENU = 'MENU',
  SELECTION = 'SELECTION',
  DRIVING = 'DRIVING'
}

export enum BusMode {
  OMNI = 'OMNI', // City-to-City
  LOCAL = 'LOCAL' // Intra-district
}

export enum Gear {
  REVERSE = -1,
  NEUTRAL = 0,
  FIRST = 1,
  SECOND = 2,
  THIRD = 3,
  FOURTH = 4,
  FIFTH = 5
}

export interface Route {
  id: string;
  name: string;
  start: string;
  end: string;
  stops: string[];
  distanceKm: number;
}

export interface BusState {
  speed: number;
  rpm: number;
  gear: Gear;
  isEngineOn: boolean;
  fuel: number;
  temperature: number;
  odometer: number;
  doorsOpen: boolean;
  wiperOn: boolean;
  headlightsOn: boolean;
}

export interface SimulationEvent {
  message: string;
  type: 'INFO' | 'WARNING' | 'ERROR';
  timestamp: number;
}

export const TN_CITIES = [
  "Nagercoil", "Tirunelveli", "Madurai", "Trichy", "Chennai", "Coimbatore", "Pollachi"
];

export const LOCAL_STOPS = [
  "Parvathipuram", "Vadasery", "Anna Bus Stand", "Collectorate"
];
