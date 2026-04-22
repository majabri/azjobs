/**
 * Zod schema for the Hiring Manager Job Posting form.
 * Covers src/components/hiring-manager/JobPostingForm.tsx
 */
import { z } from "zod";

const JOB_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "internship",
  "remote",
] as const;
const EXPERIENCE_LEVELS = ["entry", "mid", "senior", "executive"] as const;

export const jobPostingSchema = z
  .object({
    title: z
      .string()
      .min(3, "Job title must be at least 3 characters")
      .max(150, "Title too long"),

    company: z
      .string()
      .min(2, "Company name must be at least 2 characters")
      .max(150, "Company name too long"),

    location: z
      .string()
      .min(2, "Location is required")
      .max(200, "Location too long"),

    job_type: z.enum(JOB_TYPES, {
      errorMap: () => ({ message: "Please select a valid job type" }),
    }),

    experience_level: z.enum(EXPERIENCE_LEVELS, {
      errorMap: () => ({ message: "Please select an experience level" }),
    }),

    description: z
      .string()
      .min(50, "Description must be at least 50 characters")
      .max(10_000, "Description too long"),

    requirements: z
      .string()
      .min(20, "Requirements must be at least 20 characters")
      .max(5_000, "Requirements too long"),

    salary_min: z
      .number({ invalid_type_error: "Enter a number" })
      .int("Must be a whole number")
      .min(0, "Salary cannot be negative")
      .optional(),

    salary_max: z
      .number({ invalid_type_error: "Enter a number" })
      .int("Must be a whole number")
      .min(0, "Salary cannot be negative")
      .optional(),

    is_remote: z.boolean().default(false),

    application_url: z
      .string()
      .url("Please enter a valid application URL")
      .optional()
      .or(z.literal("")),

    skills_required: z
      .array(z.string().min(1))
      .min(1, "Add at least one required skill"),
  })
  .refine(
    (data) => {
      if (data.salary_min != null && data.salary_max != null) {
        return data.salary_max >= data.salary_min;
      }
      return true;
    },
    {
      message: "Maximum salary must be greater than or equal to minimum salary",
      path: ["salary_max"],
    },
  );

export type JobPostingFormValues = z.infer<typeof jobPostingSchema>;
