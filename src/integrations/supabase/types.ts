export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_command_log: {
        Row: {
          admin_id: string
          args: Json | null
          command: string
          executed_at: string
          id: string
          result: Json | null
          success: boolean
        }
        Insert: {
          admin_id: string
          args?: Json | null
          command: string
          executed_at?: string
          id?: string
          result?: Json | null
          success?: boolean
        }
        Update: {
          admin_id?: string
          args?: Json | null
          command?: string
          executed_at?: string
          id?: string
          result?: Json | null
          success?: boolean
        }
        Relationships: []
      }
      admin_logs: {
        Row: {
          agent_id: string | null
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json | null
          run_id: string | null
          status: string | null
          timestamp: string
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          run_id?: string | null
          status?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          run_id?: string | null
          status?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent_timings: Json | null
          agents_completed: Json
          applications_sent: number | null
          completed_at: string | null
          errors: Json | null
          id: string
          jobs_found: number | null
          jobs_matched: number | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          agent_timings?: Json | null
          agents_completed?: Json
          applications_sent?: number | null
          completed_at?: string | null
          errors?: Json | null
          id?: string
          jobs_found?: number | null
          jobs_matched?: number | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          agent_timings?: Json | null
          agents_completed?: Json
          applications_sent?: number | null
          completed_at?: string | null
          errors?: Json | null
          id?: string
          jobs_found?: number | null
          jobs_matched?: number | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      analysis_history: {
        Row: {
          company: string | null
          created_at: string
          gaps: Json | null
          id: string
          improvement_plan: Json | null
          job_description: string
          job_title: string | null
          matched_skills: Json | null
          optimized_resume: string | null
          overall_score: number
          resume_text: string
          strengths: Json | null
          summary: string | null
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          gaps?: Json | null
          id?: string
          improvement_plan?: Json | null
          job_description?: string
          job_title?: string | null
          matched_skills?: Json | null
          optimized_resume?: string | null
          overall_score?: number
          resume_text?: string
          strengths?: Json | null
          summary?: string | null
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          gaps?: Json | null
          id?: string
          improvement_plan?: Json | null
          job_description?: string
          job_title?: string | null
          matched_skills?: Json | null
          optimized_resume?: string | null
          overall_score?: number
          resume_text?: string
          strengths?: Json | null
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_preferences: {
        Row: {
          daily_job_alerts: boolean
          id: string
          min_match_score: number
          updated_at: string
          user_id: string
          weekly_insights: boolean
        }
        Insert: {
          daily_job_alerts?: boolean
          id?: string
          min_match_score?: number
          updated_at?: string
          user_id: string
          weekly_insights?: boolean
        }
        Update: {
          daily_job_alerts?: boolean
          id?: string
          min_match_score?: number
          updated_at?: string
          user_id?: string
          weekly_insights?: boolean
        }
        Relationships: []
      }
      ignored_jobs: {
        Row: {
          company: string
          created_at: string
          id: string
          job_title: string
          job_url: string | null
          user_id: string
        }
        Insert: {
          company?: string
          created_at?: string
          id?: string
          job_title?: string
          job_url?: string | null
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          id?: string
          job_title?: string
          job_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      interview_schedules: {
        Row: {
          candidate_email: string | null
          candidate_name: string
          candidate_profile_id: string | null
          created_at: string
          duration_minutes: number
          feedback: string | null
          id: string
          interview_type: string
          job_posting_id: string | null
          location: string | null
          meeting_link: string | null
          notes: string | null
          rating: number | null
          scheduled_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          candidate_email?: string | null
          candidate_name?: string
          candidate_profile_id?: string | null
          created_at?: string
          duration_minutes?: number
          feedback?: string | null
          id?: string
          interview_type?: string
          job_posting_id?: string | null
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          rating?: number | null
          scheduled_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          candidate_email?: string | null
          candidate_name?: string
          candidate_profile_id?: string | null
          created_at?: string
          duration_minutes?: number
          feedback?: string | null
          id?: string
          interview_type?: string
          job_posting_id?: string | null
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          rating?: number | null
          scheduled_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_schedules_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          created_at: string
          id: string
          job_title: string
          messages: Json
          readiness_score: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_title?: string
          messages?: Json
          readiness_score?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_title?: string
          messages?: Json
          readiness_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          applied_at: string
          company: string
          follow_up_date: string | null
          follow_up_notes: string | null
          followed_up: boolean
          id: string
          interview_stage: string | null
          job_title: string
          job_url: string | null
          notes: string | null
          outcome_detail: string | null
          response_days: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string
          company?: string
          follow_up_date?: string | null
          follow_up_notes?: string | null
          followed_up?: boolean
          id?: string
          interview_stage?: string | null
          job_title?: string
          job_url?: string | null
          notes?: string | null
          outcome_detail?: string | null
          response_days?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string
          company?: string
          follow_up_date?: string | null
          follow_up_notes?: string | null
          followed_up?: boolean
          id?: string
          interview_stage?: string | null
          job_title?: string
          job_url?: string | null
          notes?: string | null
          outcome_detail?: string | null
          response_days?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          candidates_matched: number | null
          company: string
          created_at: string
          department: string | null
          description: string
          id: string
          is_remote: boolean | null
          job_type: string | null
          location: string | null
          nice_to_haves: string | null
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          candidates_matched?: number | null
          company?: string
          created_at?: string
          department?: string | null
          description?: string
          id?: string
          is_remote?: boolean | null
          job_type?: string | null
          location?: string | null
          nice_to_haves?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          candidates_matched?: number | null
          company?: string
          created_at?: string
          department?: string | null
          description?: string
          id?: string
          is_remote?: boolean | null
          job_type?: string | null
          location?: string | null
          nice_to_haves?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_queue: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          job_id: string
          payload: Json | null
          started_at: string | null
          status: string
          type: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string
          payload?: Json | null
          started_at?: string | null
          status?: string
          type?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string
          payload?: Json | null
          started_at?: string | null
          status?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      job_seeker_profiles: {
        Row: {
          automation_mode: string
          career_goals_long: string | null
          career_goals_short: string | null
          career_level: string | null
          certifications: string[] | null
          daily_apply_cap: number
          education: Json | null
          email: string | null
          full_name: string | null
          id: string
          last_active_at: string | null
          linkedin_url: string | null
          location: string | null
          match_threshold: number
          min_match_score: number | null
          phone: string | null
          preferred_job_types: string[] | null
          remote_only: boolean | null
          salary_max: string | null
          salary_min: string | null
          salary_target: string | null
          skills: string[] | null
          summary: string | null
          target_job_titles: string[] | null
          updated_at: string
          user_id: string
          work_experience: Json | null
        }
        Insert: {
          automation_mode?: string
          career_goals_long?: string | null
          career_goals_short?: string | null
          career_level?: string | null
          certifications?: string[] | null
          daily_apply_cap?: number
          education?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_active_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          match_threshold?: number
          min_match_score?: number | null
          phone?: string | null
          preferred_job_types?: string[] | null
          remote_only?: boolean | null
          salary_max?: string | null
          salary_min?: string | null
          salary_target?: string | null
          skills?: string[] | null
          summary?: string | null
          target_job_titles?: string[] | null
          updated_at?: string
          user_id: string
          work_experience?: Json | null
        }
        Update: {
          automation_mode?: string
          career_goals_long?: string | null
          career_goals_short?: string | null
          career_level?: string | null
          certifications?: string[] | null
          daily_apply_cap?: number
          education?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_active_at?: string | null
          linkedin_url?: string | null
          location?: string | null
          match_threshold?: number
          min_match_score?: number | null
          phone?: string | null
          preferred_job_types?: string[] | null
          remote_only?: boolean | null
          salary_max?: string | null
          salary_min?: string | null
          salary_target?: string | null
          skills?: string[] | null
          summary?: string | null
          target_job_titles?: string[] | null
          updated_at?: string
          user_id?: string
          work_experience?: Json | null
        }
        Relationships: []
      }
      learning_events: {
        Row: {
          application_id: string | null
          created_at: string
          features: Json
          id: string
          insights: Json | null
          job_id: string | null
          outcome: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          features?: Json
          id?: string
          insights?: Json | null
          job_id?: string | null
          outcome?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          features?: Json
          id?: string
          insights?: Json | null
          job_id?: string | null
          outcome?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scraped_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          base_salary: number | null
          bonus: number | null
          company: string
          created_at: string
          deadline: string | null
          equity: number | null
          id: string
          job_title: string
          market_rate: number | null
          negotiation_strategy: Json | null
          notes: string | null
          status: string
          total_comp: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          base_salary?: number | null
          bonus?: number | null
          company?: string
          created_at?: string
          deadline?: string | null
          equity?: number | null
          id?: string
          job_title?: string
          market_rate?: number | null
          negotiation_strategy?: Json | null
          notes?: string | null
          status?: string
          total_comp?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          base_salary?: number | null
          bonus?: number | null
          company?: string
          created_at?: string
          deadline?: string | null
          equity?: number | null
          id?: string
          job_title?: string
          market_rate?: number | null
          negotiation_strategy?: Json | null
          notes?: string | null
          status?: string
          total_comp?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      outreach_contacts: {
        Row: {
          company: string
          contact_name: string
          created_at: string
          id: string
          message_sent: string | null
          notes: string | null
          platform: string | null
          response_status: string
          role: string | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          company?: string
          contact_name?: string
          created_at?: string
          id?: string
          message_sent?: string | null
          notes?: string | null
          platform?: string | null
          response_status?: string
          role?: string | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          company?: string
          contact_name?: string
          created_at?: string
          id?: string
          message_sent?: string | null
          notes?: string | null
          platform?: string | null
          response_status?: string
          role?: string | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      processing_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          progress: number
          query: Json
          result: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          progress?: number
          query?: Json
          result?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          progress?: number
          query?: Json
          result?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string
          id: string
          referral_code: string
          referred_email: string
          referred_user_id: string | null
          referrer_id: string
          status: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          id?: string
          referral_code: string
          referred_email: string
          referred_user_id?: string | null
          referrer_id: string
          status?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_email?: string
          referred_user_id?: string | null
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      resume_versions: {
        Row: {
          created_at: string
          id: string
          job_type: string | null
          resume_text: string
          updated_at: string
          user_id: string
          version_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_type?: string | null
          resume_text?: string
          updated_at?: string
          user_id: string
          version_name?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_type?: string | null
          resume_text?: string
          updated_at?: string
          user_id?: string
          version_name?: string
        }
        Relationships: []
      }
      scraped_jobs: {
        Row: {
          company: string
          compensation_breakdown: Json | null
          created_at: string
          description: string
          first_seen_at: string
          flag_reasons: Json | null
          id: string
          industry: string | null
          is_flagged: boolean | null
          is_remote: boolean | null
          job_type: string | null
          job_url: string | null
          last_seen_at: string
          location: string | null
          market_rate: number | null
          quality_score: number | null
          salary: string | null
          salary_range_estimated: Json | null
          seniority: string | null
          source: string
          source_id: string | null
          title: string
        }
        Insert: {
          company: string
          compensation_breakdown?: Json | null
          created_at?: string
          description?: string
          first_seen_at?: string
          flag_reasons?: Json | null
          id?: string
          industry?: string | null
          is_flagged?: boolean | null
          is_remote?: boolean | null
          job_type?: string | null
          job_url?: string | null
          last_seen_at?: string
          location?: string | null
          market_rate?: number | null
          quality_score?: number | null
          salary?: string | null
          salary_range_estimated?: Json | null
          seniority?: string | null
          source?: string
          source_id?: string | null
          title: string
        }
        Update: {
          company?: string
          compensation_breakdown?: Json | null
          created_at?: string
          description?: string
          first_seen_at?: string
          flag_reasons?: Json | null
          id?: string
          industry?: string | null
          is_flagged?: boolean | null
          is_remote?: boolean | null
          job_type?: string | null
          job_url?: string | null
          last_seen_at?: string
          location?: string | null
          market_rate?: number | null
          quality_score?: number | null
          salary?: string | null
          salary_range_estimated?: Json | null
          seniority?: string | null
          source?: string
          source_id?: string | null
          title?: string
        }
        Relationships: []
      }
      scraping_targets: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_scraped_at: string | null
          name: string
          target_type: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_scraped_at?: string | null
          name?: string
          target_type?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_scraped_at?: string | null
          name?: string
          target_type?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      support_faq: {
        Row: {
          answer: string
          category: string
          created_at: string
          display_order: number
          id: string
          is_published: boolean
          question: string
          updated_at: string
        }
        Insert: {
          answer?: string
          category?: string
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean
          question?: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          email: string | null
          id: string
          priority: string
          request_type: string
          resolved_at: string | null
          status: string
          ticket_number: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          priority?: string
          request_type?: string
          resolved_at?: string | null
          status?: string
          ticket_number?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          priority?: string
          request_type?: string
          resolved_at?: string | null
          status?: string
          ticket_number?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ticket_responses: {
        Row: {
          author_id: string
          created_at: string
          id: string
          is_admin_response: boolean
          message: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          is_admin_response?: boolean
          message?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          is_admin_response?: boolean
          message?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_responses_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_portfolio_items: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          item_type: string
          tags: string[] | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          item_type?: string
          tags?: string[] | null
          title?: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          item_type?: string
          tags?: string[] | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      resolve_admin_email: { Args: { _username: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
