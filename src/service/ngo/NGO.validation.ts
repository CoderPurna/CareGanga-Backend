import { z } from "zod";
import { VALIDATION_PATTERNS } from "../../utils/constants.js";

/**
 * Address Schema matching UI Address form
 */
const addressSchema = z.object({
  line1: z
    .string({ message: "Office Address is required" })
    .trim()
    .min(3, "Office Address must be at least 3 characters long")
    .max(255, "Office Address cannot exceed 255 characters"),
  line2: z
    .string()
    .trim()
    .max(255, "Address Line 2 cannot exceed 255 characters")
    .optional()
    .or(z.literal("")),
  city: z
    .string({ message: "City is required" })
    .trim()
    .min(2, "City name must be at least 2 characters long")
    .max(100, "City name cannot exceed 100 characters"),
  district: z
    .string({ message: "District is required" })
    .trim()
    .min(2, "District must be at least 2 characters long")
    .max(100, "District name cannot exceed 100 characters"),
  state: z
    .string({ message: "State is required" })
    .trim()
    .min(2, "State name must be at least 2 characters long")
    .max(100, "State name cannot exceed 100 characters"),
  country: z
    .string()
    .trim()
    .min(2, "Country name must be at least 2 characters long")
    .max(100, "Country name cannot exceed 100 characters")
    .optional()
    .or(z.literal("")),
  postalCode: z
    .string({ message: "Pincode is required" })
    .trim()
    .min(5, "Pincode must be at least 5 characters")
    .max(10, "Pincode cannot exceed 10 characters"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

/**
 * Team Member Schema inside teamMembers JSON array
 */
const teamMemberSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  role: z.string().trim().min(2, "Role must be at least 2 characters"),
});

/**
 * Zod Schema for Creating an NGO Profile
 */
export const createNgoSchema = z.object({
  // Basic Information
  name: z
    .string({ message: "NGO Name is required" })
    .trim()
    .min(2, "NGO Name must be at least 2 characters long")
    .max(200, "NGO Name cannot exceed 200 characters"),
  shortName: z
    .string()
    .trim()
    .max(100, "NGO Short Name cannot exceed 100 characters")
    .optional()
    .or(z.literal("")),
  logo: z.string({ message: "NGO Logo is required" }).trim().min(1, "NGO Logo is required"),
  coverImage: z.string().trim().optional().or(z.literal("")),
  description: z
    .string({ message: "NGO Description is required" })
    .trim()
    .min(10, "NGO Description must be at least 10 characters long"),
  establishmentYear: z.string().trim().optional().or(z.literal("")),
  registrationNumber: z
    .string({ message: "Registration Number is required" })
    .trim()
    .min(3, "Registration Number must be at least 3 characters long")
    .max(100, "Registration Number cannot exceed 100 characters"),
  registrationDate: z
    .string({ message: "Registration Date is required" })
    .transform((val) => new Date(val))
    .refine((val) => !isNaN(val.getTime()), {
      message: "Please provide a valid Registration Date",
    }),
  ngoType: z.string({ message: "NGO Type is required" }).trim().min(2, "NGO Type is required"),

  // Contact Information
  email: z
    .string({ message: "Official Email is required" })
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),
  phone: z
    .string({ message: "Mobile Number is required" })
    .trim()
    .regex(VALIDATION_PATTERNS.PHONE_IN, "Please provide a valid 10-digit mobile number"),
  whatsappNumber: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.PHONE_IN, "Please provide a valid 10-digit WhatsApp number")
    .optional()
    .or(z.literal("")),
  website: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid website URL")
    .optional()
    .or(z.literal("")),
  googleMapUrl: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid Google Map URL")
    .optional()
    .or(z.literal("")),
  address: addressSchema, // Required on create

  // Legal & Verification
  registrationCertificate: z
    .string({ message: "Registration Certificate is required" })
    .trim()
    .min(1, "Registration Certificate is required"),
  panCard: z.string({ message: "PAN Card is required" }).trim().min(1, "PAN Card is required"),
  certificate12A: z.string().trim().optional().or(z.literal("")),
  certificate80G: z.string().trim().optional().or(z.literal("")),
  csr1Certificate: z.string().trim().optional().or(z.literal("")),
  fcraNumber: z.string().trim().optional().or(z.literal("")),
  fcraCertificate: z.string().trim().optional().or(z.literal("")),

  // Social Media
  facebookUrl: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid Facebook URL")
    .optional()
    .or(z.literal("")),
  instagramUrl: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid Instagram URL")
    .optional()
    .or(z.literal("")),
  linkedInUrl: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid LinkedIn URL")
    .optional()
    .or(z.literal("")),
  youtubeUrl: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid YouTube URL")
    .optional()
    .or(z.literal("")),
  twitterUrl: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid X (Twitter) URL")
    .optional()
    .or(z.literal("")),

  // Team Information
  founderName: z.string().trim().optional().or(z.literal("")),
  presidentName: z
    .string({ message: "President Name is required" })
    .trim()
    .min(2, "President Name must be at least 2 characters long"),
  secretaryName: z
    .string({ message: "Secretary Name is required" })
    .trim()
    .min(2, "Secretary Name must be at least 2 characters long"),
  treasurerName: z.string().trim().optional().or(z.literal("")),
  teamMembers: z.array(teamMemberSchema).optional(),

  // NGO Work Information
  mission: z
    .string({ message: "Mission Statement is required" })
    .trim()
    .min(10, "Mission Statement must be at least 10 characters long"),
  vision: z.string().trim().optional().or(z.literal("")),
  focusAreas: z.array(z.string().trim()).min(1, "Please select at least one focus area"),
  operationalAreas: z.string().trim().optional().or(z.literal("")),
  beneficiariesServed: z.string().trim().optional().or(z.literal("")),
  volunteersCount: z.string().trim().optional().or(z.literal("")),
});

/**
 * Zod Schema for Updating an NGO Profile
 */
export const updateNgoSchema = z.object({
  // Basic Information
  name: z
    .string()
    .trim()
    .min(2, "NGO Name must be at least 2 characters long")
    .max(200, "NGO Name cannot exceed 200 characters")
    .optional(),
  shortName: z.string().trim().max(100, "NGO Short Name cannot exceed 100 characters").optional(),
  logo: z.string().trim().optional(),
  coverImage: z.string().trim().optional(),
  description: z
    .string()
    .trim()
    .min(10, "NGO Description must be at least 10 characters long")
    .optional(),
  establishmentYear: z.string().trim().optional(),
  registrationNumber: z
    .string()
    .trim()
    .min(3, "Registration Number must be at least 3 characters long")
    .max(100, "Registration Number cannot exceed 100 characters")
    .optional(),
  registrationDate: z
    .string()
    .transform((val) => new Date(val))
    .refine((val) => !isNaN(val.getTime()), {
      message: "Please provide a valid Registration Date",
    })
    .optional(),
  ngoType: z.string().trim().optional(),

  // Contact Information
  email: z.string().trim().toLowerCase().email("Please provide a valid email address").optional(),
  phone: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.PHONE_IN, "Please provide a valid 10-digit mobile number")
    .optional(),
  whatsappNumber: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.PHONE_IN, "Please provide a valid 10-digit WhatsApp number")
    .optional(),
  website: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid website URL")
    .optional(),
  googleMapUrl: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid Google Map URL")
    .optional(),
  address: addressSchema.partial().optional(),

  // Legal & Verification
  registrationCertificate: z.string().trim().optional(),
  panCard: z.string().trim().optional(),
  certificate12A: z.string().trim().optional(),
  certificate80G: z.string().trim().optional(),
  csr1Certificate: z.string().trim().optional(),
  fcraNumber: z.string().trim().optional(),
  fcraCertificate: z.string().trim().optional(),

  // Social Media
  facebookUrl: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid Facebook URL")
    .optional(),
  instagramUrl: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid Instagram URL")
    .optional(),
  linkedInUrl: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid LinkedIn URL")
    .optional(),
  youtubeUrl: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid YouTube URL")
    .optional(),
  twitterUrl: z
    .string()
    .trim()
    .regex(VALIDATION_PATTERNS.URL, "Please provide a valid X (Twitter) URL")
    .optional(),

  // Team Information
  founderName: z.string().trim().optional(),
  presidentName: z
    .string()
    .trim()
    .min(2, "President Name must be at least 2 characters long")
    .optional(),
  secretaryName: z
    .string()
    .trim()
    .min(2, "Secretary Name must be at least 2 characters long")
    .optional(),
  treasurerName: z.string().trim().optional(),
  teamMembers: z.array(teamMemberSchema).optional(),

  // NGO Work Information
  mission: z
    .string()
    .trim()
    .min(10, "Mission Statement must be at least 10 characters long")
    .optional(),
  vision: z.string().trim().optional(),
  focusAreas: z.array(z.string().trim()).min(1, "Please select at least one focus area").optional(),
  operationalAreas: z.string().trim().optional(),
  beneficiariesServed: z.string().trim().optional(),
  volunteersCount: z.string().trim().optional(),
});
