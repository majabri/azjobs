/**
 * Zod schema for the Job Seeker Profile form.
 * Covers src/components/profile/ProfileForm.tsx
 */
import { z } from "zod";

const CAREER_LEVELS = [
  "Entry-Level / Junior",
  "Mid-Level",
  "Senior",
  "Manager",
  "Director",
  "VP / Senior Leadership",
  "C-Level / Executive",
] as const;

const SEARCH_MODES = ["quality", "balanced", "volume"] as const;

export const profileSchema = z.object({
  full_name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Name too long")
    .optional()
    .or(z.literal("")),

  email: z
    .string()
    .email("Please enter a valid email")
    .optional()
    .or(z.literal("")),

  phone: z
    .string()
    .max(30, "Phone number too long")
    .optional()
    .or(z.literal("")),

  location: z
    .string()
    .max(200, "Location too long")
    .optional()
    .or(z.literal("")),

  summary: z
    .string()
    .max(2000, "Summary must be under 2000 characters")
    .optional()
    .or(z.literal("")),

  career_level: z
    .enum(CAREER_LEVELS)
    .optional()
    .or(z.literal("") as z.ZodLiteral<string>),

  linkedin_url: z
    .string()
    .url("Please enter a valid LinkedIn URL")
    .optional()
    .or(z.literal("")),

  github_url: z
    .string()
    .url("Please enter a valid GitHub URL")
    .optional()
    .or(z.literal("")),

  portfolio_url: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),

  salary_min: z
    .string()
    .regex(/^\d{0,10}$/, "Enter a number (no commas)")
    .optional()
    .or(z.literal("")),

  salary_max: z
    .string()
    .regex(/^\d{0,10}$/, "Enter a number (no commas)")
    .optional()
    .or(z.literal("")),

  remote_only: z.boolean().optional(),

  search_mode: z.enum(SEARCH_MODES).optional(),

  min_match_score: z.number().int().min(0).max(100).optional(),

  // Array fields – validated as arrays of non-empty strings
  skills: z.array(z.string().min(1)).optional(),
  target_job_titles: z.array(z.string().min(1)).optional(),
  preferred_job_types: z.array(z.string().min(1)).optional(),
  certifications: z.array(z.string().min(1)).optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
