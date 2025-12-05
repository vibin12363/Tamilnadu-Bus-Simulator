
export enum GameMode {
  MENU = 'MENU',
  SELECTION = 'SELECTION',
  DRIVING = 'DRIVING',
  SUMMARY = 'SUMMARY'
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
  isCranking: boolean; 
  isSputtering: boolean; // New: Engine shutdown shake
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

export const TN_DISTRICTS = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi",
  "Kanchipuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal",
  "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur",
  "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai",
  "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"
];

export const LOCAL_STOPS = [
  "Parvathipuram", "Vadasery", "Anna Bus Stand", "Collectorate", "Asaripallam", "Konam"
];
