export const APP_NAME = "QuickShift";

export const SESSION_STORAGE_KEY = "qs_session";
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

export const PAGE_SIZE_DEFAULT = 50;
