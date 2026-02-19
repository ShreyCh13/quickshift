export const APP_NAME = "State Fleet";

// ============================================================
// INSPECTION CHECKLIST (fixed structure — not dynamic)
// ============================================================
export const INSPECTION_CATEGORIES = [
  {
    key: "exterior",
    label: "Exterior Inspection",
    fields: [
      { key: "body_condition", label: "Body condition (scratches, dents, rust)" },
      { key: "windshield", label: "Windshield and windows (cracks, chips)" },
      { key: "mirrors", label: "Mirrors (side & rearview)" },
      { key: "headlights", label: "Headlights / Tail lights / Indicators" },
      { key: "brake_lights", label: "Brake lights" },
      { key: "wipers", label: "Wipers and washer fluid" },
      { key: "doors", label: "Doors, locks, and handles" },
      { key: "tyres", label: "Tyres (tread depth, condition)" },
    ],
  },
  {
    key: "interior",
    label: "Interior Inspection",
    fields: [
      { key: "battery", label: "Battery" },
      { key: "seat_belts", label: "Seat belts condition" },
      { key: "dashboard_warning", label: "Dashboard warning lights" },
      { key: "speedometer", label: "Speedometer functioning" },
      { key: "fuel_gauge", label: "Fuel gauge working" },
      { key: "interior_lights", label: "Interior lights" },
      { key: "handbrake", label: "Handbrake functioning" },
      { key: "foot_brake", label: "Foot brake response" },
      { key: "dry_cleaning", label: "Dry Cleaning" },
    ],
  },
  {
    key: "road_test",
    label: "Road Test",
    fields: [
      { key: "ac_heater", label: "Air conditioning / Heater" },
      { key: "engine_start", label: "Smooth engine start" },
      { key: "steering", label: "Steering alignment" },
      { key: "brake_performance", label: "Brake performance" },
      { key: "suspension", label: "Suspension condition" },
      { key: "unusual_noises", label: "Unusual noises" },
      { key: "gear_shifting", label: "Gear shifting smooth" },
      { key: "clutch", label: "Clutch" },
      { key: "wheel_alignment", label: "Wheel alignment" },
      { key: "horn", label: "Horn" },
      { key: "music_system", label: "Music system" },
    ],
  },
] as const;

export type InspectionCategoryKey = (typeof INSPECTION_CATEGORIES)[number]["key"];

/** Flat list of all checklist field keys */
export const ALL_INSPECTION_FIELD_KEYS = INSPECTION_CATEGORIES.flatMap((c) =>
  c.fields.map((f) => f.key)
) as string[];

export const SESSION_STORAGE_KEY = "sf_session";
export const SESSION_TTL_DAYS = 30;
export const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export const DEFAULT_USERS = [
  { username: "admin", password: "admin123", display_name: "Admin", role: "admin" },
  { username: "mandu", password: "mandu123", display_name: "Mandu", role: "staff" },
] as const;

export const DEFAULT_REMARK_FIELDS = [
  { key: "tyre", label: "Tyre", sort_order: 1, is_active: true },
  { key: "alignment", label: "Alignment", sort_order: 2, is_active: true },
  { key: "interiors", label: "Interiors", sort_order: 3, is_active: true },
  { key: "exteriors", label: "Exteriors", sort_order: 4, is_active: true },
  { key: "miscellaneous", label: "Miscellaneous", sort_order: 5, is_active: true },
] as const;

export const DEFAULT_VEHICLES = [
  { vehicle_code: "HR38AF-4440", brand: "TEMPO TRAVELLER", model: "19 SEATER", is_active: true },
  { vehicle_code: "HR38AF-2287", brand: "TEMPO TRAVELLER", model: "19 SEATER", is_active: true },
  { vehicle_code: "DL1B-1234", brand: "MINI COACH", model: "23 SEATER", is_active: true },
  { vehicle_code: "DL1VC-4693", brand: "FORCE", model: "URBANIA", is_active: true },
  { vehicle_code: "DL1VC-4637", brand: "FORCE", model: "URBANIA", is_active: true },
  { vehicle_code: "HR51CB-1534", brand: "JAGUAR", model: "F-PACE", is_active: true },
  { vehicle_code: "HR38Z-8208", brand: "JAGUAR", model: "F-PACE", is_active: true },
  { vehicle_code: "HR38Z-7624", brand: "JAGUAR", model: "XF", is_active: true },
  { vehicle_code: "HR51BV-4689", brand: "JAGUAR", model: "XF", is_active: true },
  { vehicle_code: "HR38Z-4284", brand: "JAGUAR", model: "XF", is_active: true },
  { vehicle_code: "HR87K-7855", brand: "KIA", model: "CARNIVAL", is_active: true },
  { vehicle_code: "HR38AE-9365", brand: "KIA", model: "CARNIVAL LIMOUSINE", is_active: true },
  { vehicle_code: "HR38Z-2768", brand: "LANDROVER", model: "DISCOVERY SPORT", is_active: true },
  { vehicle_code: "HR38Z-7374", brand: "LANDROVER", model: "DISCOVERY SPORT", is_active: true },
  { vehicle_code: "DL1NA-4136", brand: "MERCEDES", model: "E-220 d", is_active: true },
  { vehicle_code: "DL1NA-4002", brand: "MERCEDES", model: "E-220 d", is_active: true },
  { vehicle_code: "DL1NA-4023", brand: "MERCEDES", model: "E-220 d", is_active: true },
  { vehicle_code: "HR51CB-6881", brand: "RANGE ROVER", model: "EVOQUE", is_active: true },
  { vehicle_code: "HR38AA-4474", brand: "SUZUKI", model: "CIAZ", is_active: true },
  { vehicle_code: "HR38AA-0920", brand: "SUZUKI", model: "CIAZ", is_active: true },
  { vehicle_code: "HR38AA-6033", brand: "SUZUKI", model: "CIAZ", is_active: true },
  { vehicle_code: "HR38AA-8773", brand: "SUZUKI", model: "CIAZ", is_active: true },
  { vehicle_code: "DL10DB-2164", brand: "SUZUKI", model: "INVICTO", is_active: true },
  { vehicle_code: "HR38-24", brand: "SUZUKI", model: "INVICTO", is_active: true },
  { vehicle_code: "HR38-25", brand: "SUZUKI", model: "INVICTO", is_active: true },
  { vehicle_code: "HR38-26", brand: "SUZUKI", model: "INVICTO", is_active: true },
  { vehicle_code: "HR38-27", brand: "SUZUKI", model: "INVICTO", is_active: true },
  { vehicle_code: "HR38AG-3568", brand: "SUZUKI", model: "DZIRE", is_active: true },
  { vehicle_code: "HR38AG-5699", brand: "SUZUKI", model: "DZIRE", is_active: true },
  { vehicle_code: "HR38AG-0878", brand: "SUZUKI", model: "DZIRE", is_active: true },
  { vehicle_code: "HR38AG-3097", brand: "SUZUKI", model: "DZIRE", is_active: true },
  { vehicle_code: "HR38AA-1972", brand: "TOYOTA", model: "FORTUNER", is_active: true },
  { vehicle_code: "HR38AE-3799", brand: "TOYOTA", model: "FORTUNER", is_active: true },
  { vehicle_code: "HR38AF-8090", brand: "TOYOTA", model: "HYCROSS HYBRID", is_active: true },
  { vehicle_code: "HR38AF-0893", brand: "TOYOTA", model: "HYCROSS HYBRID", is_active: true },
  { vehicle_code: "HR38AF-7748", brand: "TOYOTA", model: "HYCROSS HYBRID", is_active: true },
  { vehicle_code: "HR38AF-3331", brand: "TOYOTA", model: "HYCROSS HYBRID", is_active: true },
  { vehicle_code: "HR38AF-4446", brand: "TOYOTA", model: "HYCROSS HYBRID", is_active: true },
  { vehicle_code: "HR38AF-7897", brand: "TOYOTA", model: "HYCROSS HYBRID", is_active: true },
  { vehicle_code: "HR38AF-7016", brand: "TOYOTA", model: "HYCROSS HYBRID", is_active: true },
  { vehicle_code: "HR38AF-1568", brand: "TOYOTA", model: "HYCROSS HYBRID", is_active: true },
  { vehicle_code: "DL12CX-5096", brand: "TOYOTA", model: "HYCROSS HYBRID", is_active: true },
  { vehicle_code: "HR38AD-0953", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
  { vehicle_code: "HR38AD-6973", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
  { vehicle_code: "HR38AD-6934", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
  { vehicle_code: "HR38AD-7085", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
  { vehicle_code: "HR38AD-2421", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
  { vehicle_code: "HR38AD-3129", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
  { vehicle_code: "HR38AD-4792", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
  { vehicle_code: "HR38AD-5387", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
  { vehicle_code: "HR38AD-0417", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
  { vehicle_code: "HR38AD-8726", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
  { vehicle_code: "HR51BX-7596", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
  { vehicle_code: "DL1NA-3916", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
  { vehicle_code: "HR38-55", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
  { vehicle_code: "HR38-56", brand: "TOYOTA", model: "INNOVA CRYSTA", is_active: true },
] as const;

export const PAGE_SIZE_DEFAULT = 50;
export const PAGE_SIZE_MAX = 200;

// Rate limiting constants
export const RATE_LIMIT_LOGIN_MAX = 5;
export const RATE_LIMIT_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_API_MAX = 60;
export const RATE_LIMIT_API_WINDOW_MS = 60 * 1000; // 1 minute

// Cache TTLs (in milliseconds)
export const CACHE_TTL_VEHICLES = 60 * 1000; // 1 minute
export const CACHE_TTL_REMARK_FIELDS = 10 * 60 * 1000; // 10 minutes
export const CACHE_TTL_ANALYTICS = 5 * 60 * 1000; // 5 minutes
