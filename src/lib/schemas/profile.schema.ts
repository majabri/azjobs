import { z } from "zod";

export const workExperienceSchema = z.object({
  title: z.string().optional().default(""),
  company: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  endDate: z.string().optional().default(""),
  description: z.string().optional().default(""),
});

export const educationSchema = z.object({
  degree: z.string().optional().default(""),
  institution: z.string().optional().default(""),
  year: z.string().optional().default(""),
});

export const profileSchema = z.object({
  full_name: z.string().optional().default(""),
  email: z.union([z.string().email(), z.literal("")]).optional().default(""),
  phone: z.string().optional().default(""),
  location: z.string().optional().default(""),
  summary: z.string().optional().default(""),
  linkedin_url: z.union([z.string().url(), z.literal("")]).optional().default(""),
  skills: z.array(z.string()).default([]),
  work_experience: z.array(workExperienceSchema).default([]),
  education: z.array(educationSchema).default([]),
  certifications: z.array(z.string()).default([]),
  preferred_job_types: z.array(z.string()).default([]),
  career_level: z.string().optional().default(""),
  target_job_titles: z.array(z.string()).default([]),
  salary_min: z.string().optional().default(""),
  salary_max: z.string().optional().default(""),
  remote_only: z.boolean().default(false),
  min_match_score: z.number().min(0).max(100).default(60),
  search_mode: z.string().optional().default("balanced"), // keeping string to be safe from old legacy data
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
