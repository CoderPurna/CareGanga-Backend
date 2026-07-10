export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// User Roles
export const USER_ROLES = {
  USER: "user",
  COMPANY: "company",
  NGO: "ngo",
  ADMIN: "admin",
} as const;

// Campaign Categories
export const CAMPAIGN_CATEGORIES = [
  "education",
  "healthcare",
  "environment",
  "poverty",
  "disaster-relief",
  "animal-welfare",
  "other",
] as const;

// Campaign Status
export const CAMPAIGN_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  COMPLETED: "completed",
  SUSPENDED: "suspended",
  DRAFT: "draft",
} as const;

// Donation Status
export const DONATION_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  REFUNDED: "refunded",
  CANCELLED: "cancelled",
} as const;

// Payment Methods
export const PAYMENT_METHODS = {
  CREDIT_CARD: "credit_card",
  DEBIT_CARD: "debit_card",
  UPI: "upi",
  NET_BANKING: "net_banking",
  WALLET: "wallet",
  BANK_TRANSFER: "bank_transfer",
  CASH: "cash",
} as const;

// File Types
export const ALLOWED_FILE_TYPES = {
  IMAGES: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  DOCUMENTS: [".pdf", ".doc", ".docx"],
  ALL: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx"],
} as const;

// MIME Types
export const ALLOWED_MIME_TYPES = {
  IMAGES: ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"],
  DOCUMENTS: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ALL: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
} as const;

// File Size Limits (in bytes)
export const FILE_SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  DEFAULT: 5 * 1024 * 1024, // 5MB
} as const;

// Activity Types
export const ACTIVITY_TYPES = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  REGISTER: "REGISTER",
  UPDATE_PROFILE: "UPDATE_PROFILE",
  CHANGE_PASSWORD: "CHANGE_PASSWORD",
  CREATE_CAMPAIGN: "CREATE_CAMPAIGN",
  UPDATE_CAMPAIGN: "UPDATE_CAMPAIGN",
  DELETE_CAMPAIGN: "DELETE_CAMPAIGN",
  DONATE: "DONATE",
  FILE_UPLOAD: "FILE_UPLOAD",
  VIEW_CAMPAIGN: "VIEW_CAMPAIGN",
  VIEW_PROFILE: "VIEW_PROFILE",
  ADMIN_LOGIN: "ADMIN_LOGIN",
  ADMIN_UPDATE_USER: "ADMIN_UPDATE_USER",
  ADMIN_UPDATE_CAMPAIGN: "ADMIN_UPDATE_CAMPAIGN",
  ADMIN_DELETE_USER: "ADMIN_DELETE_USER",
  ADMIN_DELETE_CAMPAIGN: "ADMIN_DELETE_CAMPAIGN",
  OTHER: "OTHER",
} as const;

// Company Types
export const COMPANY_TYPES = [
  "IT",
  "Manufacturing",
  "Healthcare",
  "Education",
  "Finance",
  "Retail",
  "Construction",
  "Agriculture",
  "Other",
] as const;

// NGO Types
export const NGO_TYPES = ["Trust", "Society", "Section 8 Company", "Partnership", "Other"] as const;

// Working Areas for NGOs
export const NGO_WORKING_AREAS = [
  "Education",
  "Healthcare",
  "Environment",
  "Poverty Alleviation",
  "Women Empowerment",
  "Child Welfare",
  "Disaster Relief",
  "Animal Welfare",
  "Rural Development",
  "Other",
] as const;

// Target Beneficiaries
export const TARGET_BENEFICIARIES = [
  "Children",
  "Women",
  "Elderly",
  "Disabled",
  "Poor",
  "Students",
  "Farmers",
  "Workers",
  "All",
  "Other",
] as const;

// Currencies
export const CURRENCIES = {
  INR: "INR",
  USD: "USD",
  EUR: "EUR",
  GBP: "GBP",
} as const;

// Languages
export const LANGUAGES = [
  "english",
  "hindi",
  "tamil",
  "telugu",
  "bengali",
  "marathi",
  "gujarati",
  "kannada",
  "malayalam",
  "punjabi",
] as const;

// Gender Options
export const GENDER_OPTIONS = ["male", "female", "other", "prefer-not-to-say"] as const;

// Account Types
export const ACCOUNT_TYPES = ["Savings", "Current", "Other"] as const;

// Notification Types
export const NOTIFICATION_TYPES = {
  EMAIL: "email",
  SMS: "sms",
  PUSH: "push",
  IN_APP: "in_app",
} as const;

// Stats Types
export const STATS_TYPES = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;

// Pagination Defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  GENERAL: {
    WINDOW_MS: Number(process.env.RATE_LIMIT_GENERAL_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: Number(process.env.RATE_LIMIT_GENERAL_MAX_REQUESTS) || 1000, // Increased default to 1000 for production friendliness
  },
  AUTH: {
    WINDOW_MS: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: Number(process.env.RATE_LIMIT_AUTH_MAX_REQUESTS) || 5,
  },
  UPLOAD: {
    WINDOW_MS: Number(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: Number(process.env.RATE_LIMIT_UPLOAD_MAX_REQUESTS) || 10,
  },
  DONATION: {
    WINDOW_MS: Number(process.env.RATE_LIMIT_DONATION_WINDOW_MS) || 60 * 1000, // 1 minute
    MAX_REQUESTS: Number(process.env.RATE_LIMIT_DONATION_MAX_REQUESTS) || 5,
  },
} as const;

// JWT Configuration
export const JWT_CONFIG = {
  DEFAULT_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRY || "24h",
  REFRESH_THRESHOLD: Number(process.env.JWT_REFRESH_THRESHOLD) || 3600, // 1 hour in seconds
  ALGORITHM: "HS256",
} as const;

// Password Configuration
export const PASSWORD_CONFIG = {
  MIN_LENGTH: Number(process.env.PASSWORD_MIN_LENGTH) || 8,
  MAX_LENGTH: 128,
  SALT_ROUNDS: Number(process.env.PASSWORD_SALT_ROUNDS) || 12,
  RESET_TOKEN_EXPIRY: Number(process.env.PASSWORD_RESET_TOKEN_EXPIRY) || 3600000, // 1 hour in milliseconds
} as const;

// Validation Patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE_IN: /^[6-9]\d{9}$/, // Indian mobile number
  OBJECT_ID: /^[0-9a-fA-F]{24}$/,
  URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  ALPHA: /^[a-zA-Z]+$/,
  NUMERIC: /^[0-9]+$/,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  // Authentication
  INVALID_CREDENTIALS: "Invalid email or password",
  ACCESS_DENIED: "Access denied. Authentication required.",
  INSUFFICIENT_PERMISSIONS: "Insufficient permissions to perform this action",
  TOKEN_EXPIRED: "Authentication token has expired",
  INVALID_TOKEN: "Invalid authentication token",
  ACCOUNT_LOCKED: "Account is temporarily locked due to multiple failed login attempts",
  ACCOUNT_INACTIVE: "Account is deactivated. Please contact support.",

  // Validation
  REQUIRED_FIELD: "This field is required",
  INVALID_EMAIL: "Please provide a valid email address",
  INVALID_PHONE: "Please provide a valid phone number",
  WEAK_PASSWORD: "Password does not meet security requirements",
  INVALID_URL: "Please provide a valid URL",
  INVALID_DATE: "Please provide a valid date",
  INVALID_NUMBER: "Please provide a valid number",

  // File Upload
  FILE_TOO_LARGE: "File size exceeds the maximum allowed limit",
  INVALID_FILE_TYPE: "File type is not supported",
  NO_FILE_UPLOADED: "No file was uploaded",
  UPLOAD_FAILED: "File upload failed. Please try again.",

  // Database
  DUPLICATE_ENTRY: "A record with this information already exists",
  RECORD_NOT_FOUND: "The requested record was not found",
  DATABASE_ERROR: "A database error occurred. Please try again.",

  // Rate Limiting
  TOO_MANY_REQUESTS: "Too many requests. Please try again later.",

  // General
  INTERNAL_SERVER_ERROR: "An internal server error occurred",
  INVALID_REQUEST: "Invalid request format",
  SERVICE_UNAVAILABLE: "Service is temporarily unavailable",
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  // Authentication
  LOGIN_SUCCESS: "Login successful",
  LOGOUT_SUCCESS: "Logout successful",
  REGISTRATION_SUCCESS: "Registration completed successfully",
  PASSWORD_CHANGED: "Password changed successfully",

  // Profile
  PROFILE_UPDATED: "Profile updated successfully",

  // Campaign
  CAMPAIGN_CREATED: "Campaign created successfully",
  CAMPAIGN_UPDATED: "Campaign updated successfully",
  CAMPAIGN_DELETED: "Campaign deleted successfully",

  // Donation
  DONATION_SUCCESS: "Donation completed successfully",

  // File Upload
  FILE_UPLOADED: "File uploaded successfully",

  // General
  OPERATION_SUCCESS: "Operation completed successfully",
} as const;

// Email Templates
export const EMAIL_TEMPLATES = {
  WELCOME: "welcome",
  PASSWORD_RESET: "password_reset",
  DONATION_RECEIPT: "donation_receipt",
  CAMPAIGN_CREATED: "campaign_created",
  CAMPAIGN_MILESTONE: "campaign_milestone",
} as const;

// Default Values
export const DEFAULTS = {
  PROFILE_IMAGE: process.env.DEFAULT_PROFILE_IMAGE || "/assets/default-avatar.png",
  COMPANY_LOGO: process.env.DEFAULT_COMPANY_LOGO || "/assets/default-company-logo.png",
  NGO_LOGO: process.env.DEFAULT_NGO_LOGO || "/assets/default-ngo-logo.png",
  CAMPAIGN_IMAGE: process.env.DEFAULT_CAMPAIGN_IMAGE || "/assets/default-campaign-image.png",
  COUNTRY: process.env.DEFAULT_COUNTRY || "India",
  CURRENCY: process.env.DEFAULT_CURRENCY || "INR",
  LANGUAGE: process.env.DEFAULT_LANGUAGE || "english",
  TIMEZONE: process.env.DEFAULT_TIMEZONE || "Asia/Kolkata",
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  BASE: "/api",
  AUTH: "/api/auth",
  USERS: "/api/users",
  CAMPAIGNS: "/api/campaigns",
  DONATIONS: "/api/donations",
  COMPANIES: "/api/companies",
  NGOS: "/api/ngos",
  STATS: "/api/stats",
  ADMIN: "/api/admin",
  PAYMENTS: "/api/payments",
} as const;
