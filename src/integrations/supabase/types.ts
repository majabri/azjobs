export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_alerts: {
        Row: {
          acknowledged_at: string | null;
          alert_type: string;
          created_at: string;
          id: string;
          message: string;
          resolved_at: string | null;
          service_name: string;
          severity: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          alert_type: string;
          created_at?: string;
          id?: string;
          message: string;
          resolved_at?: string | null;
          service_name: string;
          severity: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          acknowledged_at?: string | null;
          alert_type?: string;
          created_at?: string;
          id?: string;
          message?: string;
          resolved_at?: string | null;
          service_name?: string;
          severity?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_command_log: {
        Row: {
          admin_id: string;
          args: Json | null;
          command: string;
          executed_at: string;
          id: string;
          result: Json | null;
          success: boolean;
        };
        Insert: {
          admin_id: string;
          args?: Json | null;
          command: string;
          executed_at?: string;
          id?: string;
          result?: Json | null;
          success?: boolean;
        };
        Update: {
          admin_id?: string;
          args?: Json | null;
          command?: string;
          executed_at?: string;
          id?: string;
          result?: Json | null;
          success?: boolean;
        };
        Relationships: [];
      };
      admin_logs: {
        Row: {
          agent_id: string | null;
          created_at: string;
          id: string;
          level: string;
          message: string;
          metadata: Json | null;
          run_id: string | null;
          status: string | null;
          timestamp: string;
          user_id: string | null;
        };
        Insert: {
          agent_id?: string | null;
          created_at?: string;
          id?: string;
          level?: string;
          message: string;
          metadata?: Json | null;
          run_id?: string | null;
          status?: string | null;
          timestamp?: string;
          user_id?: string | null;
        };
        Update: {
          agent_id?: string | null;
          created_at?: string;
          id?: string;
          level?: string;
          message?: string;
          metadata?: Json | null;
          run_id?: string | null;
          status?: string | null;
          timestamp?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      admin_settings: {
        Row: {
          description: string | null;
          id: string;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          description?: string | null;
          id?: string;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Update: {
          description?: string | null;
          id?: string;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      admin_usernames: {
        Row: {
          created_at: string | null;
          id: string;
          user_id: string;
          username: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          user_id: string;
          username: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          user_id?: string;
          username?: string;
        };
        Relationships: [];
      };
      agent_runs: {
        Row: {
          agent_timings: Json | null;
          agents_completed: Json;
          applications_sent: number | null;
          completed_at: string | null;
          errors: Json | null;
          id: string;
          jobs_found: number | null;
          jobs_matched: number | null;
          started_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          agent_timings?: Json | null;
          agents_completed?: Json;
          applications_sent?: number | null;
          completed_at?: string | null;
          errors?: Json | null;
          id?: string;
          jobs_found?: number | null;
          jobs_matched?: number | null;
          started_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          agent_timings?: Json | null;
          agents_completed?: Json;
          applications_sent?: number | null;
          completed_at?: string | null;
          errors?: Json | null;
          id?: string;
          jobs_found?: number | null;
          jobs_matched?: number | null;
          started_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      analysis_history: {
        Row: {
          company: string | null;
          created_at: string;
          gaps: Json | null;
          id: string;
          improvement_plan: Json | null;
          job_description: string;
          job_title: string | null;
          matched_skills: Json | null;
          optimized_resume: string | null;
          overall_score: number;
          resume_text: string;
          strengths: Json | null;
          summary: string | null;
          user_id: string;
        };
        Insert: {
          company?: string | null;
          created_at?: string;
          gaps?: Json | null;
          id?: string;
          improvement_plan?: Json | null;
          job_description?: string;
          job_title?: string | null;
          matched_skills?: Json | null;
          optimized_resume?: string | null;
          overall_score?: number;
          resume_text?: string;
          strengths?: Json | null;
          summary?: string | null;
          user_id: string;
        };
        Update: {
          company?: string | null;
          created_at?: string;
          gaps?: Json | null;
          id?: string;
          improvement_plan?: Json | null;
          job_description?: string;
          job_title?: string | null;
          matched_skills?: Json | null;
          optimized_resume?: string | null;
          overall_score?: number;
          resume_text?: string;
          strengths?: Json | null;
          summary?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_label: string | null;
          category: string;
          created_at: string;
          details: Json | null;
          id: string;
          ip_address: string | null;
          success: boolean;
          target_id: string | null;
          target_label: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_label?: string | null;
          category: string;
          created_at?: string;
          details?: Json | null;
          id?: string;
          ip_address?: string | null;
          success?: boolean;
          target_id?: string | null;
          target_label?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_label?: string | null;
          category?: string;
          created_at?: string;
          details?: Json | null;
          id?: string;
          ip_address?: string | null;
          success?: boolean;
          target_id?: string | null;
          target_label?: string | null;
        };
        Relationships: [];
      };
      benchmark_reports: {
        Row: {
          accuracy: Json;
          cost: Json;
          coverage: Json;
          created_at: string | null;
          health: Json;
          id: string;
          performance: Json;
          report_date: string;
        };
        Insert: {
          accuracy: Json;
          cost: Json;
          coverage: Json;
          created_at?: string | null;
          health: Json;
          id?: string;
          performance: Json;
          report_date: string;
        };
        Update: {
          accuracy?: Json;
          cost?: Json;
          coverage?: Json;
          created_at?: string | null;
          health?: Json;
          id?: string;
          performance?: Json;
          report_date?: string;
        };
        Relationships: [];
      };
      benefits_catalog: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          keywords: string[];
          label: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          id?: string;
          keywords?: string[];
          label: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          keywords?: string[];
          label?: string;
        };
        Relationships: [];
      };
      catalog_orders: {
        Row: {
          buyer_id: string;
          created_at: string;
          delivery_date: string;
          id: string;
          order_price: number;
          package_id: string;
          payment_status: string;
          service_id: string;
          special_requests: string | null;
          status: string;
          stripe_payment_intent_id: string | null;
          talent_id: string;
          updated_at: string;
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          delivery_date: string;
          id?: string;
          order_price: number;
          package_id: string;
          payment_status?: string;
          service_id: string;
          special_requests?: string | null;
          status?: string;
          stripe_payment_intent_id?: string | null;
          talent_id: string;
          updated_at?: string;
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          delivery_date?: string;
          id?: string;
          order_price?: number;
          package_id?: string;
          payment_status?: string;
          service_id?: string;
          special_requests?: string | null;
          status?: string;
          stripe_payment_intent_id?: string | null;
          talent_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_orders_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "service_packages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_orders_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "service_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      contract_milestones: {
        Row: {
          amount: number;
          approved_at: string | null;
          contract_id: string;
          created_at: string | null;
          deliverable_url: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          paid_at: string | null;
          sort_order: number | null;
          status: string;
          submitted_at: string | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          amount: number;
          approved_at?: string | null;
          contract_id: string;
          created_at?: string | null;
          deliverable_url?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          paid_at?: string | null;
          sort_order?: number | null;
          status?: string;
          submitted_at?: string | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          amount?: number;
          approved_at?: string | null;
          contract_id?: string;
          created_at?: string | null;
          deliverable_url?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          paid_at?: string | null;
          sort_order?: number | null;
          status?: string;
          submitted_at?: string | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contract_milestones_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "gig_contracts";
            referencedColumns: ["id"];
          },
        ];
      };
      contracts: {
        Row: {
          agreed_price: number;
          agreed_timeline_days: number;
          created_at: string;
          employer_id: string;
          id: string;
          project_id: string;
          proposal_id: string;
          status: string;
          talent_id: string;
          updated_at: string;
        };
        Insert: {
          agreed_price: number;
          agreed_timeline_days: number;
          created_at?: string;
          employer_id: string;
          id?: string;
          project_id: string;
          proposal_id: string;
          status?: string;
          talent_id: string;
          updated_at?: string;
        };
        Update: {
          agreed_price?: number;
          agreed_timeline_days?: number;
          created_at?: string;
          employer_id?: string;
          id?: string;
          project_id?: string;
          proposal_id?: string;
          status?: string;
          talent_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contracts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_proposal_id_fkey";
            columns: ["proposal_id"];
            isOneToOne: false;
            referencedRelation: "project_proposals";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_surveys: {
        Row: {
          answers: Json;
          created_at: string;
          email: string | null;
          id: string;
          phone: string | null;
          role: string;
          wants_callback: boolean;
        };
        Insert: {
          answers?: Json;
          created_at?: string;
          email?: string | null;
          id?: string;
          phone?: string | null;
          role: string;
          wants_callback?: boolean;
        };
        Update: {
          answers?: Json;
          created_at?: string;
          email?: string | null;
          id?: string;
          phone?: string | null;
          role?: string;
          wants_callback?: boolean;
        };
        Relationships: [];
      };
      daily_audit_reports: {
        Row: {
          date: string;
          healthy_checks: number;
          id: string;
          incidents_by_service: Json;
          patterns: Json;
          report_generated_at: string;
          slo_percentage: number;
          total_checks: number;
        };
        Insert: {
          date: string;
          healthy_checks?: number;
          id?: string;
          incidents_by_service?: Json;
          patterns?: Json;
          report_generated_at?: string;
          slo_percentage?: number;
          total_checks?: number;
        };
        Update: {
          date?: string;
          healthy_checks?: number;
          id?: string;
          incidents_by_service?: Json;
          patterns?: Json;
          report_generated_at?: string;
          slo_percentage?: number;
          total_checks?: number;
        };
        Relationships: [];
      };
      deduplicated_jobs: {
        Row: {
          company: string;
          created_at: string | null;
          deduped_at: string | null;
          id: string;
          job_hash: string;
          location: string | null;
          primary_extracted_job_id: string | null;
          source_count: number | null;
          sources: Json;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          company: string;
          created_at?: string | null;
          deduped_at?: string | null;
          id?: string;
          job_hash: string;
          location?: string | null;
          primary_extracted_job_id?: string | null;
          source_count?: number | null;
          sources?: Json;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          company?: string;
          created_at?: string | null;
          deduped_at?: string | null;
          id?: string;
          job_hash?: string;
          location?: string | null;
          primary_extracted_job_id?: string | null;
          source_count?: number | null;
          sources?: Json;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "deduplicated_jobs_primary_extracted_job_id_fkey";
            columns: ["primary_extracted_job_id"];
            isOneToOne: false;
            referencedRelation: "extracted_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      discovered_jobs: {
        Row: {
          ai_legitimacy: number | null;
          ai_match_summary: string | null;
          ai_red_flags: string[] | null;
          ai_score: number | null;
          benefits_extracted: string[] | null;
          benefits_taxonomy: Json | null;
          company_name: string | null;
          company_url: string | null;
          created_at: string;
          dedup_hash: string | null;
          description: string | null;
          description_length: number | null;
          discovery_batch_id: string | null;
          effort_estimate: string | null;
          effort_minutes: number | null;
          employment_type: string | null;
          enriched_at: string | null;
          experience_level: string | null;
          expires_at: string | null;
          external_id: string | null;
          first_seen_at: string;
          flagged_reason: string | null;
          id: string;
          is_direct_posting: boolean | null;
          is_flagged: boolean | null;
          last_seen_at: string;
          location: string | null;
          location_type: string | null;
          normalized_url: string | null;
          original_url: string | null;
          parsed_company_info: string | null;
          parsed_requirements: string[] | null;
          posted_at: string | null;
          raw_data: Json | null;
          redirect_chain: string[] | null;
          relevance_score: number | null;
          response_factors: Json | null;
          response_probability: number | null;
          salary_currency: string | null;
          salary_max: number | null;
          salary_min: number | null;
          salary_text: string | null;
          score_breakdown: Json | null;
          score_explanation: string | null;
          scored_at: string | null;
          skills_extracted: string[] | null;
          smart_tags: string[] | null;
          source_name: string;
          source_url: string | null;
          status: string | null;
          strategy: string | null;
          strategy_reason: string | null;
          title: string;
          title_normalized: string | null;
          trust_flags: string[] | null;
          trust_score: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_legitimacy?: number | null;
          ai_match_summary?: string | null;
          ai_red_flags?: string[] | null;
          ai_score?: number | null;
          benefits_extracted?: string[] | null;
          benefits_taxonomy?: Json | null;
          company_name?: string | null;
          company_url?: string | null;
          created_at?: string;
          dedup_hash?: string | null;
          description?: string | null;
          description_length?: number | null;
          discovery_batch_id?: string | null;
          effort_estimate?: string | null;
          effort_minutes?: number | null;
          employment_type?: string | null;
          enriched_at?: string | null;
          experience_level?: string | null;
          expires_at?: string | null;
          external_id?: string | null;
          first_seen_at?: string;
          flagged_reason?: string | null;
          id?: string;
          is_direct_posting?: boolean | null;
          is_flagged?: boolean | null;
          last_seen_at?: string;
          location?: string | null;
          location_type?: string | null;
          normalized_url?: string | null;
          original_url?: string | null;
          parsed_company_info?: string | null;
          parsed_requirements?: string[] | null;
          posted_at?: string | null;
          raw_data?: Json | null;
          redirect_chain?: string[] | null;
          relevance_score?: number | null;
          response_factors?: Json | null;
          response_probability?: number | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          salary_text?: string | null;
          score_breakdown?: Json | null;
          score_explanation?: string | null;
          scored_at?: string | null;
          skills_extracted?: string[] | null;
          smart_tags?: string[] | null;
          source_name: string;
          source_url?: string | null;
          status?: string | null;
          strategy?: string | null;
          strategy_reason?: string | null;
          title: string;
          title_normalized?: string | null;
          trust_flags?: string[] | null;
          trust_score?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_legitimacy?: number | null;
          ai_match_summary?: string | null;
          ai_red_flags?: string[] | null;
          ai_score?: number | null;
          benefits_extracted?: string[] | null;
          benefits_taxonomy?: Json | null;
          company_name?: string | null;
          company_url?: string | null;
          created_at?: string;
          dedup_hash?: string | null;
          description?: string | null;
          description_length?: number | null;
          discovery_batch_id?: string | null;
          effort_estimate?: string | null;
          effort_minutes?: number | null;
          employment_type?: string | null;
          enriched_at?: string | null;
          experience_level?: string | null;
          expires_at?: string | null;
          external_id?: string | null;
          first_seen_at?: string;
          flagged_reason?: string | null;
          id?: string;
          is_direct_posting?: boolean | null;
          is_flagged?: boolean | null;
          last_seen_at?: string;
          location?: string | null;
          location_type?: string | null;
          normalized_url?: string | null;
          original_url?: string | null;
          parsed_company_info?: string | null;
          parsed_requirements?: string[] | null;
          posted_at?: string | null;
          raw_data?: Json | null;
          redirect_chain?: string[] | null;
          relevance_score?: number | null;
          response_factors?: Json | null;
          response_probability?: number | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          salary_text?: string | null;
          score_breakdown?: Json | null;
          score_explanation?: string | null;
          scored_at?: string | null;
          skills_extracted?: string[] | null;
          smart_tags?: string[] | null;
          source_name?: string;
          source_url?: string | null;
          status?: string | null;
          strategy?: string | null;
          strategy_reason?: string | null;
          title?: string;
          title_normalized?: string | null;
          trust_flags?: string[] | null;
          trust_score?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovered_jobs_source_name_fkey";
            columns: ["source_name"];
            isOneToOne: false;
            referencedRelation: "job_source_config";
            referencedColumns: ["source_name"];
          },
        ];
      };
      discovery_company_sources: {
        Row: {
          ats: string;
          company_slug: string;
          created_at: string | null;
          display_name: string | null;
          enabled: boolean | null;
          id: string;
          last_polled_at: string | null;
        };
        Insert: {
          ats: string;
          company_slug: string;
          created_at?: string | null;
          display_name?: string | null;
          enabled?: boolean | null;
          id?: string;
          last_polled_at?: string | null;
        };
        Update: {
          ats?: string;
          company_slug?: string;
          created_at?: string | null;
          display_name?: string | null;
          enabled?: boolean | null;
          id?: string;
          last_polled_at?: string | null;
        };
        Relationships: [];
      };
      discovery_jobs: {
        Row: {
          company: string | null;
          created_at: string | null;
          dedupe_hash: string | null;
          description: string | null;
          description_html: string | null;
          employment_type: string | null;
          external_id: string | null;
          id: string;
          location: string | null;
          posted_at: string | null;
          raw_payload: Json | null;
          remote_type: string | null;
          salary_currency: string | null;
          salary_max: number | null;
          salary_min: number | null;
          scraped_at: string | null;
          source_board: string;
          source_url: string | null;
          title: string | null;
        };
        Insert: {
          company?: string | null;
          created_at?: string | null;
          dedupe_hash?: string | null;
          description?: string | null;
          description_html?: string | null;
          employment_type?: string | null;
          external_id?: string | null;
          id?: string;
          location?: string | null;
          posted_at?: string | null;
          raw_payload?: Json | null;
          remote_type?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          scraped_at?: string | null;
          source_board: string;
          source_url?: string | null;
          title?: string | null;
        };
        Update: {
          company?: string | null;
          created_at?: string | null;
          dedupe_hash?: string | null;
          description?: string | null;
          description_html?: string | null;
          employment_type?: string | null;
          external_id?: string | null;
          id?: string;
          location?: string | null;
          posted_at?: string | null;
          raw_payload?: Json | null;
          remote_type?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          scraped_at?: string | null;
          source_board?: string;
          source_url?: string | null;
          title?: string | null;
        };
        Relationships: [];
      };
      discovery_runs: {
        Row: {
          batch_id: string;
          completed_at: string | null;
          created_at: string;
          duration_ms: number | null;
          error_detail: string | null;
          id: string;
          queries_executed: number | null;
          results_after_dedup: number | null;
          results_after_trust: number | null;
          results_fetched: number | null;
          results_scored: number | null;
          search_mode: string | null;
          sources_failed: string[] | null;
          sources_queried: string[] | null;
          started_at: string;
          status: string | null;
          trigger_type: string | null;
          user_id: string | null;
        };
        Insert: {
          batch_id?: string;
          completed_at?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error_detail?: string | null;
          id?: string;
          queries_executed?: number | null;
          results_after_dedup?: number | null;
          results_after_trust?: number | null;
          results_fetched?: number | null;
          results_scored?: number | null;
          search_mode?: string | null;
          sources_failed?: string[] | null;
          sources_queried?: string[] | null;
          started_at?: string;
          status?: string | null;
          trigger_type?: string | null;
          user_id?: string | null;
        };
        Update: {
          batch_id?: string;
          completed_at?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          error_detail?: string | null;
          id?: string;
          queries_executed?: number | null;
          results_after_dedup?: number | null;
          results_after_trust?: number | null;
          results_fetched?: number | null;
          results_scored?: number | null;
          search_mode?: string | null;
          sources_failed?: string[] | null;
          sources_queried?: string[] | null;
          started_at?: string;
          status?: string | null;
          trigger_type?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      domain_extraction_hints: {
        Row: {
          best_selector: string | null;
          best_strategy: string | null;
          created_at: string;
          domain: string;
          failure_count: number;
          id: string;
          last_failure_at: string | null;
          last_seen_at: string;
          last_success_at: string | null;
          notes: string | null;
          success_count: number;
          updated_at: string;
        };
        Insert: {
          best_selector?: string | null;
          best_strategy?: string | null;
          created_at?: string;
          domain: string;
          failure_count?: number;
          id?: string;
          last_failure_at?: string | null;
          last_seen_at?: string;
          last_success_at?: string | null;
          notes?: string | null;
          success_count?: number;
          updated_at?: string;
        };
        Update: {
          best_selector?: string | null;
          best_strategy?: string | null;
          created_at?: string;
          domain?: string;
          failure_count?: number;
          id?: string;
          last_failure_at?: string | null;
          last_seen_at?: string;
          last_success_at?: string | null;
          notes?: string | null;
          success_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_preferences: {
        Row: {
          daily_job_alerts: boolean;
          id: string;
          min_match_score: number;
          updated_at: string;
          user_id: string;
          weekly_insights: boolean;
        };
        Insert: {
          daily_job_alerts?: boolean;
          id?: string;
          min_match_score?: number;
          updated_at?: string;
          user_id: string;
          weekly_insights?: boolean;
        };
        Update: {
          daily_job_alerts?: boolean;
          id?: string;
          min_match_score?: number;
          updated_at?: string;
          user_id?: string;
          weekly_insights?: boolean;
        };
        Relationships: [];
      };
      employer_profiles: {
        Row: {
          company_name: string | null;
          company_size: string | null;
          created_at: string | null;
          description: string | null;
          id: string;
          industry: string | null;
          logo_url: string | null;
          user_id: string | null;
          website: string | null;
        };
        Insert: {
          company_name?: string | null;
          company_size?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          industry?: string | null;
          logo_url?: string | null;
          user_id?: string | null;
          website?: string | null;
        };
        Update: {
          company_name?: string | null;
          company_size?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          industry?: string | null;
          logo_url?: string | null;
          user_id?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      escrow_holds: {
        Row: {
          amount: number;
          contract_id: string | null;
          created_at: string | null;
          currency: string | null;
          id: string;
          milestone_id: string | null;
          order_id: string | null;
          refunded_at: string | null;
          released_at: string | null;
          status: string;
          stripe_transfer_id: string | null;
        };
        Insert: {
          amount: number;
          contract_id?: string | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          milestone_id?: string | null;
          order_id?: string | null;
          refunded_at?: string | null;
          released_at?: string | null;
          status?: string;
          stripe_transfer_id?: string | null;
        };
        Update: {
          amount?: number;
          contract_id?: string | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          milestone_id?: string | null;
          order_id?: string | null;
          refunded_at?: string | null;
          released_at?: string | null;
          status?: string;
          stripe_transfer_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "escrow_holds_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "gig_contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "escrow_holds_milestone_id_fkey";
            columns: ["milestone_id"];
            isOneToOne: false;
            referencedRelation: "contract_milestones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "escrow_holds_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "service_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      extracted_jobs: {
        Row: {
          company: string;
          confidence_score: number | null;
          created_at: string | null;
          currency: string | null;
          employment_type: string | null;
          experience_level: string | null;
          extracted_at: string | null;
          extraction_method: string | null;
          id: string;
          job_description_clean: string | null;
          location: string | null;
          raw_job_id: string | null;
          remote_type: string | null;
          required_skills: string[] | null;
          salary_max: number | null;
          salary_min: number | null;
          source: string;
          source_job_id: string | null;
          title: string;
        };
        Insert: {
          company: string;
          confidence_score?: number | null;
          created_at?: string | null;
          currency?: string | null;
          employment_type?: string | null;
          experience_level?: string | null;
          extracted_at?: string | null;
          extraction_method?: string | null;
          id?: string;
          job_description_clean?: string | null;
          location?: string | null;
          raw_job_id?: string | null;
          remote_type?: string | null;
          required_skills?: string[] | null;
          salary_max?: number | null;
          salary_min?: number | null;
          source: string;
          source_job_id?: string | null;
          title: string;
        };
        Update: {
          company?: string;
          confidence_score?: number | null;
          created_at?: string | null;
          currency?: string | null;
          employment_type?: string | null;
          experience_level?: string | null;
          extracted_at?: string | null;
          extraction_method?: string | null;
          id?: string;
          job_description_clean?: string | null;
          location?: string | null;
          raw_job_id?: string | null;
          remote_type?: string | null;
          required_skills?: string[] | null;
          salary_max?: number | null;
          salary_min?: number | null;
          source?: string;
          source_job_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "extracted_jobs_raw_job_id_fkey";
            columns: ["raw_job_id"];
            isOneToOne: true;
            referencedRelation: "raw_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      extraction_accuracy: {
        Row: {
          accuracy_30d: number | null;
          accuracy_7d: number | null;
          id: string;
          last_retrain: string | null;
          prompt_override: string | null;
          prompt_version: number | null;
          source: string;
          total_corrections: number | null;
          total_extractions: number | null;
          updated_at: string | null;
        };
        Insert: {
          accuracy_30d?: number | null;
          accuracy_7d?: number | null;
          id?: string;
          last_retrain?: string | null;
          prompt_override?: string | null;
          prompt_version?: number | null;
          source: string;
          total_corrections?: number | null;
          total_extractions?: number | null;
          updated_at?: string | null;
        };
        Update: {
          accuracy_30d?: number | null;
          accuracy_7d?: number | null;
          id?: string;
          last_retrain?: string | null;
          prompt_override?: string | null;
          prompt_version?: number | null;
          source?: string;
          total_corrections?: number | null;
          total_extractions?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      extraction_feedback: {
        Row: {
          confidence_before: number | null;
          corrections: Json | null;
          extracted_job_id: string | null;
          feedback_at: string | null;
          id: string;
          is_correct: boolean | null;
          profile_id: string | null;
        };
        Insert: {
          confidence_before?: number | null;
          corrections?: Json | null;
          extracted_job_id?: string | null;
          feedback_at?: string | null;
          id?: string;
          is_correct?: boolean | null;
          profile_id?: string | null;
        };
        Update: {
          confidence_before?: number | null;
          corrections?: Json | null;
          extracted_job_id?: string | null;
          feedback_at?: string | null;
          id?: string;
          is_correct?: boolean | null;
          profile_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "extraction_feedback_extracted_job_id_fkey";
            columns: ["extracted_job_id"];
            isOneToOne: false;
            referencedRelation: "extracted_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          created_at: string;
          description: string | null;
          enabled: boolean;
          id: string;
          key: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          enabled?: boolean;
          id?: string;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          enabled?: boolean;
          id?: string;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      gig_bids: {
        Row: {
          amount: number;
          bidder_id: string;
          created_at: string;
          gig_id: string;
          id: string;
          message: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          bidder_id: string;
          created_at?: string;
          gig_id: string;
          id?: string;
          message?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          bidder_id?: string;
          created_at?: string;
          gig_id?: string;
          id?: string;
          message?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gig_bids_gig_id_fkey";
            columns: ["gig_id"];
            isOneToOne: false;
            referencedRelation: "gigs";
            referencedColumns: ["id"];
          },
        ];
      };
      gig_categories: {
        Row: {
          created_at: string | null;
          description: string | null;
          icon: string | null;
          id: string;
          name: string;
          parent_id: string | null;
          slug: string;
          sort_order: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          parent_id?: string | null;
          slug: string;
          sort_order?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          parent_id?: string | null;
          slug?: string;
          sort_order?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gig_categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "gig_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      gig_contracts: {
        Row: {
          amount: number;
          bid_id: string | null;
          client_id: string;
          completed_at: string | null;
          created_at: string;
          freelancer_id: string;
          gig_id: string;
          id: string;
          milestones: Json;
          started_at: string;
          status: string;
        };
        Insert: {
          amount?: number;
          bid_id?: string | null;
          client_id: string;
          completed_at?: string | null;
          created_at?: string;
          freelancer_id: string;
          gig_id: string;
          id?: string;
          milestones?: Json;
          started_at?: string;
          status?: string;
        };
        Update: {
          amount?: number;
          bid_id?: string | null;
          client_id?: string;
          completed_at?: string | null;
          created_at?: string;
          freelancer_id?: string;
          gig_id?: string;
          id?: string;
          milestones?: Json;
          started_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gig_contracts_bid_id_fkey";
            columns: ["bid_id"];
            isOneToOne: false;
            referencedRelation: "gig_bids";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gig_contracts_gig_id_fkey";
            columns: ["gig_id"];
            isOneToOne: false;
            referencedRelation: "gigs";
            referencedColumns: ["id"];
          },
        ];
      };
      gig_projects: {
        Row: {
          budget_currency: string | null;
          budget_max: number;
          budget_min: number;
          budget_type: string;
          category_id: string | null;
          created_at: string | null;
          deadline: string | null;
          description: string;
          duration_estimate: string | null;
          employer_id: string;
          experience_level: string;
          id: string;
          location_type: string;
          proposal_count: number | null;
          skills_required: string[] | null;
          status: string;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          budget_currency?: string | null;
          budget_max: number;
          budget_min: number;
          budget_type: string;
          category_id?: string | null;
          created_at?: string | null;
          deadline?: string | null;
          description: string;
          duration_estimate?: string | null;
          employer_id: string;
          experience_level: string;
          id?: string;
          location_type: string;
          proposal_count?: number | null;
          skills_required?: string[] | null;
          status?: string;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          budget_currency?: string | null;
          budget_max?: number;
          budget_min?: number;
          budget_type?: string;
          category_id?: string | null;
          created_at?: string | null;
          deadline?: string | null;
          description?: string;
          duration_estimate?: string | null;
          employer_id?: string;
          experience_level?: string;
          id?: string;
          location_type?: string;
          proposal_count?: number | null;
          skills_required?: string[] | null;
          status?: string;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gig_projects_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "gig_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      gig_proposals: {
        Row: {
          ai_analysis: Json | null;
          cover_letter: string;
          created_at: string | null;
          fit_score: number | null;
          id: string;
          portfolio_links: string[] | null;
          project_id: string;
          proposed_rate: number;
          proposed_timeline: string | null;
          reviewed_at: string | null;
          status: string;
          submitted_at: string | null;
          talent_id: string;
          updated_at: string | null;
        };
        Insert: {
          ai_analysis?: Json | null;
          cover_letter: string;
          created_at?: string | null;
          fit_score?: number | null;
          id?: string;
          portfolio_links?: string[] | null;
          project_id: string;
          proposed_rate: number;
          proposed_timeline?: string | null;
          reviewed_at?: string | null;
          status?: string;
          submitted_at?: string | null;
          talent_id: string;
          updated_at?: string | null;
        };
        Update: {
          ai_analysis?: Json | null;
          cover_letter?: string;
          created_at?: string | null;
          fit_score?: number | null;
          id?: string;
          portfolio_links?: string[] | null;
          project_id?: string;
          proposed_rate?: number;
          proposed_timeline?: string | null;
          reviewed_at?: string | null;
          status?: string;
          submitted_at?: string | null;
          talent_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gig_proposals_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "gig_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      gig_reviews: {
        Row: {
          comment: string | null;
          contract_id: string;
          created_at: string;
          id: string;
          rating: number;
          reviewee_id: string;
          reviewer_id: string;
        };
        Insert: {
          comment?: string | null;
          contract_id: string;
          created_at?: string;
          id?: string;
          rating?: number;
          reviewee_id: string;
          reviewer_id: string;
        };
        Update: {
          comment?: string | null;
          contract_id?: string;
          created_at?: string;
          id?: string;
          rating?: number;
          reviewee_id?: string;
          reviewer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gig_reviews_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "gig_contracts";
            referencedColumns: ["id"];
          },
        ];
      };
      gigs: {
        Row: {
          applications_count: number;
          budget_max: number | null;
          budget_min: number | null;
          budget_type: string;
          category: string;
          created_at: string;
          description: string;
          id: string;
          is_remote: boolean;
          location: string | null;
          skills_required: string[];
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          applications_count?: number;
          budget_max?: number | null;
          budget_min?: number | null;
          budget_type?: string;
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_remote?: boolean;
          location?: string | null;
          skills_required?: string[];
          status?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          applications_count?: number;
          budget_max?: number | null;
          budget_min?: number | null;
          budget_type?: string;
          category?: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_remote?: boolean;
          location?: string | null;
          skills_required?: string[];
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      helpful_votes: {
        Row: {
          created_at: string;
          id: string;
          is_helpful: boolean;
          review_id: string;
          voter_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_helpful: boolean;
          review_id: string;
          voter_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_helpful?: boolean;
          review_id?: string;
          voter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "helpful_votes_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      ignored_jobs: {
        Row: {
          company: string;
          created_at: string;
          id: string;
          job_title: string;
          job_url: string | null;
          user_id: string;
        };
        Insert: {
          company?: string;
          created_at?: string;
          id?: string;
          job_title?: string;
          job_url?: string | null;
          user_id: string;
        };
        Update: {
          company?: string;
          created_at?: string;
          id?: string;
          job_title?: string;
          job_url?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ingestion_runs: {
        Row: {
          completed_at: string | null;
          errors: Json | null;
          id: string;
          jobs_closed: number | null;
          jobs_fetched: number | null;
          jobs_inserted: number | null;
          jobs_updated: number | null;
          source_name: string;
          started_at: string | null;
          status: string | null;
        };
        Insert: {
          completed_at?: string | null;
          errors?: Json | null;
          id?: string;
          jobs_closed?: number | null;
          jobs_fetched?: number | null;
          jobs_inserted?: number | null;
          jobs_updated?: number | null;
          source_name: string;
          started_at?: string | null;
          status?: string | null;
        };
        Update: {
          completed_at?: string | null;
          errors?: Json | null;
          id?: string;
          jobs_closed?: number | null;
          jobs_fetched?: number | null;
          jobs_inserted?: number | null;
          jobs_updated?: number | null;
          source_name?: string;
          started_at?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      ingestion_sources: {
        Row: {
          attribution_req: string | null;
          base_url: string | null;
          consecutive_failures: number | null;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          last_success_at: string | null;
          refresh_hours: number | null;
          requires_key: boolean | null;
          source_name: string;
          source_type: string;
          tier: number;
        };
        Insert: {
          attribution_req?: string | null;
          base_url?: string | null;
          consecutive_failures?: number | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_success_at?: string | null;
          refresh_hours?: number | null;
          requires_key?: boolean | null;
          source_name: string;
          source_type: string;
          tier: number;
        };
        Update: {
          attribution_req?: string | null;
          base_url?: string | null;
          consecutive_failures?: number | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_success_at?: string | null;
          refresh_hours?: number | null;
          requires_key?: boolean | null;
          source_name?: string;
          source_type?: string;
          tier?: number;
        };
        Relationships: [];
      };
      interview_schedules: {
        Row: {
          candidate_email: string | null;
          candidate_name: string;
          candidate_profile_id: string | null;
          created_at: string;
          duration_minutes: number;
          feedback: string | null;
          id: string;
          interview_type: string;
          job_posting_id: string | null;
          location: string | null;
          meeting_link: string | null;
          notes: string | null;
          rating: number | null;
          scheduled_at: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          candidate_email?: string | null;
          candidate_name?: string;
          candidate_profile_id?: string | null;
          created_at?: string;
          duration_minutes?: number;
          feedback?: string | null;
          id?: string;
          interview_type?: string;
          job_posting_id?: string | null;
          location?: string | null;
          meeting_link?: string | null;
          notes?: string | null;
          rating?: number | null;
          scheduled_at: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          candidate_email?: string | null;
          candidate_name?: string;
          candidate_profile_id?: string | null;
          created_at?: string;
          duration_minutes?: number;
          feedback?: string | null;
          id?: string;
          interview_type?: string;
          job_posting_id?: string | null;
          location?: string | null;
          meeting_link?: string | null;
          notes?: string | null;
          rating?: number | null;
          scheduled_at?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_schedules_job_posting_id_fkey";
            columns: ["job_posting_id"];
            isOneToOne: false;
            referencedRelation: "job_postings";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_sessions: {
        Row: {
          created_at: string;
          id: string;
          job_title: string;
          messages: Json;
          readiness_score: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_title?: string;
          messages?: Json;
          readiness_score?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_title?: string;
          messages?: Json;
          readiness_score?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          invite_code: string | null;
          invite_type: string;
          invitee_email: string | null;
          inviter_id: string;
          status: string;
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          invite_code?: string | null;
          invite_type: string;
          invitee_email?: string | null;
          inviter_id: string;
          status?: string;
          token: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          invite_code?: string | null;
          invite_type?: string;
          invitee_email?: string | null;
          inviter_id?: string;
          status?: string;
          token?: string;
        };
        Relationships: [];
      };
      job_alerts: {
        Row: {
          created_at: string;
          frequency: string;
          id: string;
          is_active: boolean;
          is_remote: boolean | null;
          job_type: string | null;
          last_sent_at: string | null;
          location: string | null;
          match_count: number;
          min_fit_score: number | null;
          name: string;
          salary_min: number | null;
          search_query: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          frequency?: string;
          id?: string;
          is_active?: boolean;
          is_remote?: boolean | null;
          job_type?: string | null;
          last_sent_at?: string | null;
          location?: string | null;
          match_count?: number;
          min_fit_score?: number | null;
          name?: string;
          salary_min?: number | null;
          search_query?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          frequency?: string;
          id?: string;
          is_active?: boolean;
          is_remote?: boolean | null;
          job_type?: string | null;
          last_sent_at?: string | null;
          location?: string | null;
          match_count?: number;
          min_fit_score?: number | null;
          name?: string;
          salary_min?: number | null;
          search_query?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      job_applications: {
        Row: {
          applied_at: string;
          company: string;
          follow_up_date: string | null;
          follow_up_notes: string | null;
          followed_up: boolean;
          id: string;
          interview_stage: string | null;
          job_title: string;
          job_url: string | null;
          notes: string | null;
          outcome_detail: string | null;
          response_days: number | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          applied_at?: string;
          company?: string;
          follow_up_date?: string | null;
          follow_up_notes?: string | null;
          followed_up?: boolean;
          id?: string;
          interview_stage?: string | null;
          job_title?: string;
          job_url?: string | null;
          notes?: string | null;
          outcome_detail?: string | null;
          response_days?: number | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          applied_at?: string;
          company?: string;
          follow_up_date?: string | null;
          follow_up_notes?: string | null;
          followed_up?: boolean;
          id?: string;
          interview_stage?: string | null;
          job_title?: string;
          job_url?: string | null;
          notes?: string | null;
          outcome_detail?: string | null;
          response_days?: number | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      job_benefits: {
        Row: {
          benefit_id: string;
          created_at: string;
          id: string;
          job_id: string;
        };
        Insert: {
          benefit_id: string;
          created_at?: string;
          id?: string;
          job_id: string;
        };
        Update: {
          benefit_id?: string;
          created_at?: string;
          id?: string;
          job_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_benefits_benefit_id_fkey";
            columns: ["benefit_id"];
            isOneToOne: false;
            referencedRelation: "benefits_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      job_feed_log: {
        Row: {
          duration_ms: number | null;
          error: string | null;
          fetched_at: string;
          id: string;
          jobs_found: number;
          jobs_new: number;
          jobs_updated: number;
          source: string;
        };
        Insert: {
          duration_ms?: number | null;
          error?: string | null;
          fetched_at?: string;
          id?: string;
          jobs_found?: number;
          jobs_new?: number;
          jobs_updated?: number;
          source: string;
        };
        Update: {
          duration_ms?: number | null;
          error?: string | null;
          fetched_at?: string;
          id?: string;
          jobs_found?: number;
          jobs_new?: number;
          jobs_updated?: number;
          source?: string;
        };
        Relationships: [];
      };
      job_interactions: {
        Row: {
          action: string;
          created_at: string;
          external_job_id: string | null;
          id: string;
          job_id: string | null;
          metadata: Json | null;
          source_table: string;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string;
          external_job_id?: string | null;
          id?: string;
          job_id?: string | null;
          metadata?: Json | null;
          source_table?: string;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string;
          external_job_id?: string | null;
          id?: string;
          job_id?: string | null;
          metadata?: Json | null;
          source_table?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      job_postings: {
        Row: {
          apply_url: string | null;
          candidates_matched: number | null;
          company: string | null;
          created_at: string;
          date_posted: string | null;
          department: string | null;
          description: string | null;
          experience_level: string | null;
          expires_at: string | null;
          external_id: string | null;
          flag_reasons: string[] | null;
          id: string;
          is_flagged: boolean | null;
          is_remote: boolean | null;
          job_type: string | null;
          job_url: string | null;
          location: string | null;
          nice_to_haves: string | null;
          quality_score: number | null;
          remote_type: string | null;
          requirements: string | null;
          salary_currency: string | null;
          salary_max: number | null;
          salary_min: number | null;
          scraped_at: string | null;
          source: string | null;
          status: string;
          title: string;
          updated_at: string;
          url_valid: boolean | null;
          user_id: string | null;
          validated_at: string | null;
        };
        Insert: {
          apply_url?: string | null;
          candidates_matched?: number | null;
          company?: string | null;
          created_at?: string;
          date_posted?: string | null;
          department?: string | null;
          description?: string | null;
          experience_level?: string | null;
          expires_at?: string | null;
          external_id?: string | null;
          flag_reasons?: string[] | null;
          id?: string;
          is_flagged?: boolean | null;
          is_remote?: boolean | null;
          job_type?: string | null;
          job_url?: string | null;
          location?: string | null;
          nice_to_haves?: string | null;
          quality_score?: number | null;
          remote_type?: string | null;
          requirements?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          scraped_at?: string | null;
          source?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          url_valid?: boolean | null;
          user_id?: string | null;
          validated_at?: string | null;
        };
        Update: {
          apply_url?: string | null;
          candidates_matched?: number | null;
          company?: string | null;
          created_at?: string;
          date_posted?: string | null;
          department?: string | null;
          description?: string | null;
          experience_level?: string | null;
          expires_at?: string | null;
          external_id?: string | null;
          flag_reasons?: string[] | null;
          id?: string;
          is_flagged?: boolean | null;
          is_remote?: boolean | null;
          job_type?: string | null;
          job_url?: string | null;
          location?: string | null;
          nice_to_haves?: string | null;
          quality_score?: number | null;
          remote_type?: string | null;
          requirements?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          scraped_at?: string | null;
          source?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          url_valid?: boolean | null;
          user_id?: string | null;
          validated_at?: string | null;
        };
        Relationships: [];
      };
      job_queue: {
        Row: {
          completed_at: string | null;
          created_at: string;
          error: string | null;
          id: string;
          job_id: string;
          payload: Json | null;
          result: Json | null;
          started_at: string | null;
          status: string;
          type: string;
          user_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          job_id?: string;
          payload?: Json | null;
          result?: Json | null;
          started_at?: string | null;
          status?: string;
          type: string;
          user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          job_id?: string;
          payload?: Json | null;
          result?: Json | null;
          started_at?: string | null;
          status?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      job_scores: {
        Row: {
          created_at: string | null;
          deduplicated_job_id: string | null;
          experience_match_pct: number | null;
          fit_reasoning: string | null;
          fit_score: number | null;
          id: string;
          location_match_pct: number | null;
          profile_id: string | null;
          salary_match_pct: number | null;
          scored_at: string | null;
          skill_match_pct: number | null;
        };
        Insert: {
          created_at?: string | null;
          deduplicated_job_id?: string | null;
          experience_match_pct?: number | null;
          fit_reasoning?: string | null;
          fit_score?: number | null;
          id?: string;
          location_match_pct?: number | null;
          profile_id?: string | null;
          salary_match_pct?: number | null;
          scored_at?: string | null;
          skill_match_pct?: number | null;
        };
        Update: {
          created_at?: string | null;
          deduplicated_job_id?: string | null;
          experience_match_pct?: number | null;
          fit_reasoning?: string | null;
          fit_score?: number | null;
          id?: string;
          location_match_pct?: number | null;
          profile_id?: string | null;
          salary_match_pct?: number | null;
          scored_at?: string | null;
          skill_match_pct?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "job_scores_deduplicated_job_id_fkey";
            columns: ["deduplicated_job_id"];
            isOneToOne: false;
            referencedRelation: "deduplicated_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_scores_deduplicated_job_id_fkey";
            columns: ["deduplicated_job_id"];
            isOneToOne: false;
            referencedRelation: "user_job_feed";
            referencedColumns: ["id"];
          },
        ];
      };
      job_seeker_profiles: {
        Row: {
          automation_mode: string;
          career_goals_long: string | null;
          career_goals_short: string | null;
          career_level: string | null;
          certifications: string[] | null;
          daily_apply_cap: number;
          education: Json | null;
          email: string | null;
          full_name: string | null;
          id: string;
          last_active_at: string | null;
          linkedin_url: string | null;
          location: string | null;
          match_threshold: number;
          min_match_score: number | null;
          phone: string | null;
          preferred_job_types: string[] | null;
          remote_only: boolean | null;
          salary_max: string | null;
          salary_min: string | null;
          salary_target: string | null;
          search_mode: string | null;
          skills: string[] | null;
          summary: string | null;
          target_job_titles: string[] | null;
          updated_at: string;
          user_id: string;
          work_experience: Json | null;
        };
        Insert: {
          automation_mode?: string;
          career_goals_long?: string | null;
          career_goals_short?: string | null;
          career_level?: string | null;
          certifications?: string[] | null;
          daily_apply_cap?: number;
          education?: Json | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          last_active_at?: string | null;
          linkedin_url?: string | null;
          location?: string | null;
          match_threshold?: number;
          min_match_score?: number | null;
          phone?: string | null;
          preferred_job_types?: string[] | null;
          remote_only?: boolean | null;
          salary_max?: string | null;
          salary_min?: string | null;
          salary_target?: string | null;
          search_mode?: string | null;
          skills?: string[] | null;
          summary?: string | null;
          target_job_titles?: string[] | null;
          updated_at?: string;
          user_id: string;
          work_experience?: Json | null;
        };
        Update: {
          automation_mode?: string;
          career_goals_long?: string | null;
          career_goals_short?: string | null;
          career_level?: string | null;
          certifications?: string[] | null;
          daily_apply_cap?: number;
          education?: Json | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          last_active_at?: string | null;
          linkedin_url?: string | null;
          location?: string | null;
          match_threshold?: number;
          min_match_score?: number | null;
          phone?: string | null;
          preferred_job_types?: string[] | null;
          remote_only?: boolean | null;
          salary_max?: string | null;
          salary_min?: string | null;
          salary_target?: string | null;
          search_mode?: string | null;
          skills?: string[] | null;
          summary?: string | null;
          target_job_titles?: string[] | null;
          updated_at?: string;
          user_id?: string;
          work_experience?: Json | null;
        };
        Relationships: [];
      };
      job_source_config: {
        Row: {
          api_key_env_name: string | null;
          avg_job_quality: number | null;
          base_url: string | null;
          circuit_open: boolean | null;
          circuit_opened_at: string | null;
          circuit_recheck_after: string | null;
          consecutive_failures: number | null;
          created_at: string;
          enabled: boolean | null;
          hour_window_start: string | null;
          id: string;
          is_aggregator: boolean | null;
          last_error: string | null;
          last_failure_at: string | null;
          last_success_at: string | null;
          priority: number | null;
          rate_limit_per_hour: number | null;
          requests_this_hour: number | null;
          source_name: string;
          source_type: string;
          total_jobs_accepted: number | null;
          total_jobs_fetched: number | null;
          trust_score: number | null;
          updated_at: string;
        };
        Insert: {
          api_key_env_name?: string | null;
          avg_job_quality?: number | null;
          base_url?: string | null;
          circuit_open?: boolean | null;
          circuit_opened_at?: string | null;
          circuit_recheck_after?: string | null;
          consecutive_failures?: number | null;
          created_at?: string;
          enabled?: boolean | null;
          hour_window_start?: string | null;
          id?: string;
          is_aggregator?: boolean | null;
          last_error?: string | null;
          last_failure_at?: string | null;
          last_success_at?: string | null;
          priority?: number | null;
          rate_limit_per_hour?: number | null;
          requests_this_hour?: number | null;
          source_name: string;
          source_type: string;
          total_jobs_accepted?: number | null;
          total_jobs_fetched?: number | null;
          trust_score?: number | null;
          updated_at?: string;
        };
        Update: {
          api_key_env_name?: string | null;
          avg_job_quality?: number | null;
          base_url?: string | null;
          circuit_open?: boolean | null;
          circuit_opened_at?: string | null;
          circuit_recheck_after?: string | null;
          consecutive_failures?: number | null;
          created_at?: string;
          enabled?: boolean | null;
          hour_window_start?: string | null;
          id?: string;
          is_aggregator?: boolean | null;
          last_error?: string | null;
          last_failure_at?: string | null;
          last_success_at?: string | null;
          priority?: number | null;
          rate_limit_per_hour?: number | null;
          requests_this_hour?: number | null;
          source_name?: string;
          source_type?: string;
          total_jobs_accepted?: number | null;
          total_jobs_fetched?: number | null;
          trust_score?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          application_url: string | null;
          attribution_req: string | null;
          company: string;
          confidence_score: number | null;
          created_at: string | null;
          date_last_seen: string;
          date_posted: string | null;
          date_scraped: string;
          dedupe_key: string | null;
          description: string | null;
          description_normalized: string | null;
          employment_type: string | null;
          id: string;
          job_category: string | null;
          job_id: string;
          location: string | null;
          raw_source_reference: Json | null;
          remote_type: string | null;
          salary_currency: string | null;
          salary_max: number | null;
          salary_min: number | null;
          skills: string[] | null;
          source_name: string;
          source_type: string;
          status: string | null;
          title: string;
        };
        Insert: {
          application_url?: string | null;
          attribution_req?: string | null;
          company: string;
          confidence_score?: number | null;
          created_at?: string | null;
          date_last_seen?: string;
          date_posted?: string | null;
          date_scraped?: string;
          dedupe_key?: string | null;
          description?: string | null;
          description_normalized?: string | null;
          employment_type?: string | null;
          id?: string;
          job_category?: string | null;
          job_id: string;
          location?: string | null;
          raw_source_reference?: Json | null;
          remote_type?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          skills?: string[] | null;
          source_name: string;
          source_type: string;
          status?: string | null;
          title: string;
        };
        Update: {
          application_url?: string | null;
          attribution_req?: string | null;
          company?: string;
          confidence_score?: number | null;
          created_at?: string | null;
          date_last_seen?: string;
          date_posted?: string | null;
          date_scraped?: string;
          dedupe_key?: string | null;
          description?: string | null;
          description_normalized?: string | null;
          employment_type?: string | null;
          id?: string;
          job_category?: string | null;
          job_id?: string;
          location?: string | null;
          raw_source_reference?: Json | null;
          remote_type?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          skills?: string[] | null;
          source_name?: string;
          source_type?: string;
          status?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      known_issues: {
        Row: {
          ai_prevention_note: string | null;
          ai_root_cause: string | null;
          ai_suggested_fix: string | null;
          category: string;
          consecutive_recurrences: number | null;
          created_at: string | null;
          days_to_fix: number | null;
          description: string | null;
          first_seen_at: string | null;
          fix_pr_url: string | null;
          fix_status: string | null;
          fix_verified_at: string | null;
          fix_verified_by: string | null;
          github_issue_url: string | null;
          id: string;
          issue_key: string;
          last_seen_at: string | null;
          recurrence_count: number | null;
          related_probe_names: string[] | null;
          related_services: string[] | null;
          severity: string;
          tags: string[] | null;
          title: string;
          total_downtime_seconds: number | null;
          total_occurrences: number | null;
          updated_at: string | null;
          users_affected_total: number | null;
        };
        Insert: {
          ai_prevention_note?: string | null;
          ai_root_cause?: string | null;
          ai_suggested_fix?: string | null;
          category: string;
          consecutive_recurrences?: number | null;
          created_at?: string | null;
          days_to_fix?: number | null;
          description?: string | null;
          first_seen_at?: string | null;
          fix_pr_url?: string | null;
          fix_status?: string | null;
          fix_verified_at?: string | null;
          fix_verified_by?: string | null;
          github_issue_url?: string | null;
          id?: string;
          issue_key: string;
          last_seen_at?: string | null;
          recurrence_count?: number | null;
          related_probe_names?: string[] | null;
          related_services?: string[] | null;
          severity: string;
          tags?: string[] | null;
          title: string;
          total_downtime_seconds?: number | null;
          total_occurrences?: number | null;
          updated_at?: string | null;
          users_affected_total?: number | null;
        };
        Update: {
          ai_prevention_note?: string | null;
          ai_root_cause?: string | null;
          ai_suggested_fix?: string | null;
          category?: string;
          consecutive_recurrences?: number | null;
          created_at?: string | null;
          days_to_fix?: number | null;
          description?: string | null;
          first_seen_at?: string | null;
          fix_pr_url?: string | null;
          fix_status?: string | null;
          fix_verified_at?: string | null;
          fix_verified_by?: string | null;
          github_issue_url?: string | null;
          id?: string;
          issue_key?: string;
          last_seen_at?: string | null;
          recurrence_count?: number | null;
          related_probe_names?: string[] | null;
          related_services?: string[] | null;
          severity?: string;
          tags?: string[] | null;
          title?: string;
          total_downtime_seconds?: number | null;
          total_occurrences?: number | null;
          updated_at?: string | null;
          users_affected_total?: number | null;
        };
        Relationships: [];
      };
      learning_events: {
        Row: {
          application_id: string | null;
          created_at: string;
          features: Json;
          id: string;
          insights: Json | null;
          job_id: string | null;
          outcome: string;
          user_id: string;
        };
        Insert: {
          application_id?: string | null;
          created_at?: string;
          features?: Json;
          id?: string;
          insights?: Json | null;
          job_id?: string | null;
          outcome?: string;
          user_id: string;
        };
        Update: {
          application_id?: string | null;
          created_at?: string;
          features?: Json;
          id?: string;
          insights?: Json | null;
          job_id?: string | null;
          outcome?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_events_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "job_applications";
            referencedColumns: ["id"];
          },
        ];
      };
      milestone_comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string | null;
          id: string;
          milestone_id: string;
          updated_at: string | null;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string | null;
          id?: string;
          milestone_id: string;
          updated_at?: string | null;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string | null;
          id?: string;
          milestone_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "milestone_comments_milestone_id_fkey";
            columns: ["milestone_id"];
            isOneToOne: false;
            referencedRelation: "contract_milestones";
            referencedColumns: ["id"];
          },
        ];
      };
      milestones: {
        Row: {
          amount: number;
          contract_id: string;
          created_at: string;
          description: string;
          due_date: string;
          id: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          contract_id: string;
          created_at?: string;
          description: string;
          due_date: string;
          id?: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          contract_id?: string;
          created_at?: string;
          description?: string;
          due_date?: string;
          id?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "milestones_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          action_url: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          message: string;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          action_url?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message?: string;
          title?: string;
          type?: string;
          user_id: string;
        };
        Update: {
          action_url?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message?: string;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      offers: {
        Row: {
          base_salary: number | null;
          bonus: number | null;
          company: string;
          created_at: string;
          deadline: string | null;
          equity: number | null;
          id: string;
          job_title: string;
          market_rate: number | null;
          negotiation_strategy: Json | null;
          notes: string | null;
          status: string;
          total_comp: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          base_salary?: number | null;
          bonus?: number | null;
          company?: string;
          created_at?: string;
          deadline?: string | null;
          equity?: number | null;
          id?: string;
          job_title?: string;
          market_rate?: number | null;
          negotiation_strategy?: Json | null;
          notes?: string | null;
          status?: string;
          total_comp?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          base_salary?: number | null;
          bonus?: number | null;
          company?: string;
          created_at?: string;
          deadline?: string | null;
          equity?: number | null;
          id?: string;
          job_title?: string;
          market_rate?: number | null;
          negotiation_strategy?: Json | null;
          notes?: string | null;
          status?: string;
          total_comp?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      outreach_contacts: {
        Row: {
          company: string;
          contact_name: string;
          created_at: string;
          id: string;
          message_sent: string | null;
          notes: string | null;
          platform: string | null;
          response_status: string;
          role: string | null;
          sent_at: string | null;
          user_id: string;
        };
        Insert: {
          company?: string;
          contact_name?: string;
          created_at?: string;
          id?: string;
          message_sent?: string | null;
          notes?: string | null;
          platform?: string | null;
          response_status?: string;
          role?: string | null;
          sent_at?: string | null;
          user_id: string;
        };
        Update: {
          company?: string;
          contact_name?: string;
          created_at?: string;
          id?: string;
          message_sent?: string | null;
          notes?: string | null;
          platform?: string | null;
          response_status?: string;
          role?: string | null;
          sent_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      payment_transactions: {
        Row: {
          amount: number;
          contract_id: string | null;
          created_at: string | null;
          currency: string | null;
          id: string;
          milestone_id: string | null;
          order_id: string | null;
          payee_id: string;
          payer_id: string;
          platform_fee: number | null;
          status: string;
          stripe_payment_intent_id: string | null;
          stripe_transfer_id: string | null;
          type: string;
          updated_at: string | null;
        };
        Insert: {
          amount: number;
          contract_id?: string | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          milestone_id?: string | null;
          order_id?: string | null;
          payee_id: string;
          payer_id: string;
          platform_fee?: number | null;
          status?: string;
          stripe_payment_intent_id?: string | null;
          stripe_transfer_id?: string | null;
          type: string;
          updated_at?: string | null;
        };
        Update: {
          amount?: number;
          contract_id?: string | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          milestone_id?: string | null;
          order_id?: string | null;
          payee_id?: string;
          payer_id?: string;
          platform_fee?: number | null;
          status?: string;
          stripe_payment_intent_id?: string | null;
          stripe_transfer_id?: string | null;
          type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_transactions_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "gig_contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_transactions_milestone_id_fkey";
            columns: ["milestone_id"];
            isOneToOne: false;
            referencedRelation: "contract_milestones";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_transactions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "service_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_events: {
        Row: {
          consumed_by: string[] | null;
          created_at: string | null;
          event_type: string;
          id: string;
          payload: Json;
          processed: boolean;
          processed_at: string | null;
          published_at: string | null;
          source_service: string;
          status: string | null;
          user_id: string | null;
        };
        Insert: {
          consumed_by?: string[] | null;
          created_at?: string | null;
          event_type: string;
          id?: string;
          payload?: Json;
          processed?: boolean;
          processed_at?: string | null;
          published_at?: string | null;
          source_service: string;
          status?: string | null;
          user_id?: string | null;
        };
        Update: {
          consumed_by?: string[] | null;
          created_at?: string | null;
          event_type?: string;
          id?: string;
          payload?: Json;
          processed?: boolean;
          processed_at?: string | null;
          published_at?: string | null;
          source_service?: string;
          status?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      processing_jobs: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          progress: number;
          query: Json;
          result: Json | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          progress?: number;
          query?: Json;
          result?: Json | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          progress?: number;
          query?: Json;
          result?: Json | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          theme: string | null;
          theme_preference: string | null;
          updated_at: string;
          user_id: string;
          username: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          theme?: string | null;
          theme_preference?: string | null;
          updated_at?: string;
          user_id: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          theme?: string | null;
          theme_preference?: string | null;
          updated_at?: string;
          user_id?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      project_proposals: {
        Row: {
          cover_message: string;
          created_at: string;
          id: string;
          price: number;
          project_id: string;
          status: string;
          talent_id: string;
          timeline_days: number;
          updated_at: string;
        };
        Insert: {
          cover_message: string;
          created_at?: string;
          id?: string;
          price: number;
          project_id: string;
          status?: string;
          talent_id: string;
          timeline_days: number;
          updated_at?: string;
        };
        Update: {
          cover_message?: string;
          created_at?: string;
          id?: string;
          price?: number;
          project_id?: string;
          status?: string;
          talent_id?: string;
          timeline_days?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_proposals_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          budget_max: number;
          budget_min: number;
          created_at: string;
          description: string;
          employer_id: string;
          id: string;
          skills_required: string[];
          status: string;
          timeline_days: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          budget_max: number;
          budget_min: number;
          created_at?: string;
          description: string;
          employer_id: string;
          id?: string;
          skills_required?: string[];
          status?: string;
          timeline_days: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          budget_max?: number;
          budget_min?: number;
          created_at?: string;
          description?: string;
          employer_id?: string;
          id?: string;
          skills_required?: string[];
          status?: string;
          timeline_days?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      proposal_queue: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          payload: Json;
          project_id: string;
          retry_count: number;
          status: string;
          talent_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          payload: Json;
          project_id: string;
          retry_count?: number;
          status?: string;
          talent_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          payload?: Json;
          project_id?: string;
          retry_count?: number;
          status?: string;
          talent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposal_queue_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      query_cache: {
        Row: {
          cache_key: string;
          cached_at: string;
          data: Json;
          expires_at: string;
          hit_count: number;
        };
        Insert: {
          cache_key: string;
          cached_at?: string;
          data: Json;
          expires_at: string;
          hit_count?: number;
        };
        Update: {
          cache_key?: string;
          cached_at?: string;
          data?: Json;
          expires_at?: string;
          hit_count?: number;
        };
        Relationships: [];
      };
      ratings: {
        Row: {
          categories: Json | null;
          contract_id: string | null;
          created_at: string;
          helpful_count: number;
          id: string;
          is_anonymous: boolean;
          order_id: string | null;
          ratee_id: string;
          rater_id: string;
          rating: number;
          review_text: string | null;
          status: string;
          unhelpful_count: number;
          updated_at: string;
        };
        Insert: {
          categories?: Json | null;
          contract_id?: string | null;
          created_at?: string;
          helpful_count?: number;
          id?: string;
          is_anonymous?: boolean;
          order_id?: string | null;
          ratee_id: string;
          rater_id: string;
          rating: number;
          review_text?: string | null;
          status?: string;
          unhelpful_count?: number;
          updated_at?: string;
        };
        Update: {
          categories?: Json | null;
          contract_id?: string | null;
          created_at?: string;
          helpful_count?: number;
          id?: string;
          is_anonymous?: boolean;
          order_id?: string | null;
          ratee_id?: string;
          rater_id?: string;
          rating?: number;
          review_text?: string | null;
          status?: string;
          unhelpful_count?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ratings_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ratings_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "catalog_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      raw_jobs: {
        Row: {
          company: string | null;
          created_at: string | null;
          fetch_method: string | null;
          fetched_at: string | null;
          id: string;
          location: string | null;
          raw_html: string | null;
          raw_json: Json | null;
          remote_type: string | null;
          salary_max: number | null;
          salary_min: number | null;
          source: string;
          source_job_id: string;
          title: string | null;
          url: string;
        };
        Insert: {
          company?: string | null;
          created_at?: string | null;
          fetch_method?: string | null;
          fetched_at?: string | null;
          id?: string;
          location?: string | null;
          raw_html?: string | null;
          raw_json?: Json | null;
          remote_type?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          source: string;
          source_job_id: string;
          title?: string | null;
          url: string;
        };
        Update: {
          company?: string | null;
          created_at?: string | null;
          fetch_method?: string | null;
          fetched_at?: string | null;
          id?: string;
          location?: string | null;
          raw_html?: string | null;
          raw_json?: Json | null;
          remote_type?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          source?: string;
          source_job_id?: string;
          title?: string | null;
          url?: string;
        };
        Relationships: [];
      };
      recovery_attempts: {
        Row: {
          action: string;
          id: string;
          initiated_at: string;
          issue: string;
          notes: string | null;
          resolved_at: string | null;
          service: string;
          status: string;
        };
        Insert: {
          action: string;
          id?: string;
          initiated_at?: string;
          issue: string;
          notes?: string | null;
          resolved_at?: string | null;
          service: string;
          status?: string;
        };
        Update: {
          action?: string;
          id?: string;
          initiated_at?: string;
          issue?: string;
          notes?: string | null;
          resolved_at?: string | null;
          service?: string;
          status?: string;
        };
        Relationships: [];
      };
      recovery_rules: {
        Row: {
          action: string;
          condition: string;
          created_at: string;
          enabled: boolean;
          id: string;
          issue: string;
          playbook: string;
          priority: number;
        };
        Insert: {
          action: string;
          condition: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          issue: string;
          playbook?: string;
          priority?: number;
        };
        Update: {
          action?: string;
          condition?: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          issue?: string;
          playbook?: string;
          priority?: number;
        };
        Relationships: [];
      };
      referral_tree: {
        Row: {
          chain_path: string[];
          created_at: string;
          depth: number;
          id: string;
          invitation_id: string | null;
          invited_by: string | null;
          user_id: string;
        };
        Insert: {
          chain_path?: string[];
          created_at?: string;
          depth?: number;
          id?: string;
          invitation_id?: string | null;
          invited_by?: string | null;
          user_id: string;
        };
        Update: {
          chain_path?: string[];
          created_at?: string;
          depth?: number;
          id?: string;
          invitation_id?: string | null;
          invited_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "referral_tree_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
        ];
      };
      referrals: {
        Row: {
          converted_at: string | null;
          created_at: string;
          id: string;
          referral_code: string;
          referred_email: string;
          referred_user_id: string | null;
          referrer_id: string;
          status: string;
        };
        Insert: {
          converted_at?: string | null;
          created_at?: string;
          id?: string;
          referral_code: string;
          referred_email: string;
          referred_user_id?: string | null;
          referrer_id: string;
          status?: string;
        };
        Update: {
          converted_at?: string | null;
          created_at?: string;
          id?: string;
          referral_code?: string;
          referred_email?: string;
          referred_user_id?: string | null;
          referrer_id?: string;
          status?: string;
        };
        Relationships: [];
      };
      reputation_scores: {
        Row: {
          badges: string[] | null;
          calculated_at: string | null;
          completion_rate: number | null;
          id: string;
          on_time_rate: number | null;
          overall_rating: number | null;
          response_time_avg: number | null;
          total_reviews: number | null;
          trust_level: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          badges?: string[] | null;
          calculated_at?: string | null;
          completion_rate?: number | null;
          id?: string;
          on_time_rate?: number | null;
          overall_rating?: number | null;
          response_time_avg?: number | null;
          total_reviews?: number | null;
          trust_level?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          badges?: string[] | null;
          calculated_at?: string | null;
          completion_rate?: number | null;
          id?: string;
          on_time_rate?: number | null;
          overall_rating?: number | null;
          response_time_avg?: number | null;
          total_reviews?: number | null;
          trust_level?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      resume_versions: {
        Row: {
          created_at: string;
          id: string;
          job_type: string | null;
          resume_text: string;
          updated_at: string;
          user_id: string;
          version_name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_type?: string | null;
          resume_text?: string;
          updated_at?: string;
          user_id: string;
          version_name?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_type?: string | null;
          resume_text?: string;
          updated_at?: string;
          user_id?: string;
          version_name?: string;
        };
        Relationships: [];
      };
      review_reports: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          reason: string;
          reporter_id: string;
          review_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          reason: string;
          reporter_id: string;
          review_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          reason?: string;
          reporter_id?: string;
          review_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_reports_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          body: string;
          created_at: string;
          helpful_count: number;
          id: string;
          is_verified_purchase: boolean;
          rating_id: string;
          reviewee_id: string;
          reviewer_id: string;
          status: string;
          title: string | null;
          unhelpful_count: number;
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          helpful_count?: number;
          id?: string;
          is_verified_purchase?: boolean;
          rating_id: string;
          reviewee_id: string;
          reviewer_id: string;
          status?: string;
          title?: string | null;
          unhelpful_count?: number;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          helpful_count?: number;
          id?: string;
          is_verified_purchase?: boolean;
          rating_id?: string;
          reviewee_id?: string;
          reviewer_id?: string;
          status?: string;
          title?: string | null;
          unhelpful_count?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_rating_id_fkey";
            columns: ["rating_id"];
            isOneToOne: false;
            referencedRelation: "ratings";
            referencedColumns: ["id"];
          },
        ];
      };
      scraper_runs: {
        Row: {
          error_message: string | null;
          finished_at: string | null;
          http_status: number | null;
          id: string;
          jobs_found: number | null;
          jobs_inserted: number | null;
          jobs_skipped_duplicate: number | null;
          location: string | null;
          search_term: string | null;
          source_board: string;
          started_at: string | null;
          status: string | null;
        };
        Insert: {
          error_message?: string | null;
          finished_at?: string | null;
          http_status?: number | null;
          id?: string;
          jobs_found?: number | null;
          jobs_inserted?: number | null;
          jobs_skipped_duplicate?: number | null;
          location?: string | null;
          search_term?: string | null;
          source_board: string;
          started_at?: string | null;
          status?: string | null;
        };
        Update: {
          error_message?: string | null;
          finished_at?: string | null;
          http_status?: number | null;
          id?: string;
          jobs_found?: number | null;
          jobs_inserted?: number | null;
          jobs_skipped_duplicate?: number | null;
          location?: string | null;
          search_term?: string | null;
          source_board?: string;
          started_at?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      search_presets: {
        Row: {
          created_at: string | null;
          criteria: Json;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          criteria?: Json;
          id?: string;
          name?: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          criteria?: Json;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      search_queries: {
        Row: {
          id: string;
          is_remote: boolean | null;
          location: string | null;
          queried_at: string | null;
          result_count: number | null;
          search_term: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          is_remote?: boolean | null;
          location?: string | null;
          queried_at?: string | null;
          result_count?: number | null;
          search_term: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          is_remote?: boolean | null;
          location?: string | null;
          queried_at?: string | null;
          result_count?: number | null;
          search_term?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      service_catalog: {
        Row: {
          base_price: number;
          category: string;
          created_at: string;
          delivery_time_days: number;
          description: string;
          id: string;
          image_url: string | null;
          is_active: boolean;
          revisions_included: number;
          status: string;
          talent_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          base_price: number;
          category: string;
          created_at?: string;
          delivery_time_days: number;
          description: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          revisions_included?: number;
          status?: string;
          talent_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          base_price?: number;
          category?: string;
          created_at?: string;
          delivery_time_days?: number;
          description?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          revisions_included?: number;
          status?: string;
          talent_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_events: {
        Row: {
          created_at: string;
          emitted_by: string;
          event_name: string;
          id: string;
          payload: Json;
          processed: boolean;
        };
        Insert: {
          created_at?: string;
          emitted_by?: string;
          event_name: string;
          id?: string;
          payload?: Json;
          processed?: boolean;
        };
        Update: {
          created_at?: string;
          emitted_by?: string;
          event_name?: string;
          id?: string;
          payload?: Json;
          processed?: boolean;
        };
        Relationships: [];
      };
      service_health: {
        Row: {
          circuit_breaker_open: boolean;
          error_count: number;
          fallback_active: boolean | null;
          id: string;
          last_check: string;
          last_error: string | null;
          last_recovery_attempt: string | null;
          retry_count: number | null;
          service_name: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          circuit_breaker_open?: boolean;
          error_count?: number;
          fallback_active?: boolean | null;
          id?: string;
          last_check?: string;
          last_error?: string | null;
          last_recovery_attempt?: string | null;
          retry_count?: number | null;
          service_name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          circuit_breaker_open?: boolean;
          error_count?: number;
          fallback_active?: boolean | null;
          id?: string;
          last_check?: string;
          last_error?: string | null;
          last_recovery_attempt?: string | null;
          retry_count?: number | null;
          service_name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_listings: {
        Row: {
          base_price: number;
          category: string;
          created_at: string | null;
          currency: string | null;
          delivery_days: number;
          description: string;
          gallery_urls: string[] | null;
          id: string;
          order_count: number | null;
          pricing_type: string;
          rating_avg: number | null;
          review_count: number | null;
          revisions_included: number | null;
          status: string;
          subcategory: string | null;
          tags: string[] | null;
          talent_id: string;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          base_price: number;
          category: string;
          created_at?: string | null;
          currency?: string | null;
          delivery_days: number;
          description: string;
          gallery_urls?: string[] | null;
          id?: string;
          order_count?: number | null;
          pricing_type: string;
          rating_avg?: number | null;
          review_count?: number | null;
          revisions_included?: number | null;
          status?: string;
          subcategory?: string | null;
          tags?: string[] | null;
          talent_id: string;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          base_price?: number;
          category?: string;
          created_at?: string | null;
          currency?: string | null;
          delivery_days?: number;
          description?: string;
          gallery_urls?: string[] | null;
          id?: string;
          order_count?: number | null;
          pricing_type?: string;
          rating_avg?: number | null;
          review_count?: number | null;
          revisions_included?: number | null;
          status?: string;
          subcategory?: string | null;
          tags?: string[] | null;
          talent_id?: string;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      service_orders: {
        Row: {
          buyer_id: string;
          completed_at: string | null;
          created_at: string | null;
          delivered_at: string | null;
          delivery_deadline: string;
          id: string;
          listing_id: string;
          platform_fee: number;
          requirements_text: string | null;
          seller_amount: number;
          seller_id: string;
          status: string;
          tier_id: string | null;
          total_amount: number;
          updated_at: string | null;
        };
        Insert: {
          buyer_id: string;
          completed_at?: string | null;
          created_at?: string | null;
          delivered_at?: string | null;
          delivery_deadline: string;
          id?: string;
          listing_id: string;
          platform_fee: number;
          requirements_text?: string | null;
          seller_amount: number;
          seller_id: string;
          status?: string;
          tier_id?: string | null;
          total_amount: number;
          updated_at?: string | null;
        };
        Update: {
          buyer_id?: string;
          completed_at?: string | null;
          created_at?: string | null;
          delivered_at?: string | null;
          delivery_deadline?: string;
          id?: string;
          listing_id?: string;
          platform_fee?: number;
          requirements_text?: string | null;
          seller_amount?: number;
          seller_id?: string;
          status?: string;
          tier_id?: string | null;
          total_amount?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_orders_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "service_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_orders_tier_id_fkey";
            columns: ["tier_id"];
            isOneToOne: false;
            referencedRelation: "service_tiers";
            referencedColumns: ["id"];
          },
        ];
      };
      service_packages: {
        Row: {
          created_at: string;
          delivery_time_days: number;
          description: string | null;
          features: string[];
          id: string;
          is_featured: boolean;
          package_name: string;
          price: number;
          service_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          delivery_time_days: number;
          description?: string | null;
          features?: string[];
          id?: string;
          is_featured?: boolean;
          package_name: string;
          price: number;
          service_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          delivery_time_days?: number;
          description?: string | null;
          features?: string[];
          id?: string;
          is_featured?: boolean;
          package_name?: string;
          price?: number;
          service_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_packages_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "service_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      service_tiers: {
        Row: {
          created_at: string | null;
          delivery_days: number;
          description: string | null;
          features: string[] | null;
          id: string;
          listing_id: string;
          price: number;
          revisions: number;
          sort_order: number | null;
          tier_name: string;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          delivery_days: number;
          description?: string | null;
          features?: string[] | null;
          id?: string;
          listing_id: string;
          price: number;
          revisions: number;
          sort_order?: number | null;
          tier_name: string;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          delivery_days?: number;
          description?: string | null;
          features?: string[] | null;
          id?: string;
          listing_id?: string;
          price?: number;
          revisions?: number;
          sort_order?: number | null;
          tier_name?: string;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "service_tiers_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "service_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      skill_synonyms: {
        Row: {
          canonical: string;
          created_at: string;
          id: string;
          synonym: string;
        };
        Insert: {
          canonical: string;
          created_at?: string;
          id?: string;
          synonym: string;
        };
        Update: {
          canonical?: string;
          created_at?: string;
          id?: string;
          synonym?: string;
        };
        Relationships: [];
      };
      stripe_accounts: {
        Row: {
          account_type: string;
          charges_enabled: boolean | null;
          created_at: string | null;
          id: string;
          onboarding_complete: boolean | null;
          payouts_enabled: boolean | null;
          stripe_account_id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          account_type: string;
          charges_enabled?: boolean | null;
          created_at?: string | null;
          id?: string;
          onboarding_complete?: boolean | null;
          payouts_enabled?: boolean | null;
          stripe_account_id: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          account_type?: string;
          charges_enabled?: boolean | null;
          created_at?: string | null;
          id?: string;
          onboarding_complete?: boolean | null;
          payouts_enabled?: boolean | null;
          stripe_account_id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      support_faq: {
        Row: {
          answer: string;
          audience: string;
          category: string;
          created_at: string;
          display_order: number;
          id: string;
          is_published: boolean;
          question: string;
          updated_at: string;
        };
        Insert: {
          answer?: string;
          audience?: string;
          category?: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_published?: boolean;
          question?: string;
          updated_at?: string;
        };
        Update: {
          answer?: string;
          audience?: string;
          category?: string;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_published?: boolean;
          question?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      support_tickets: {
        Row: {
          assigned_to: string | null;
          created_at: string;
          description: string;
          email: string | null;
          id: string;
          priority: string;
          request_type: string;
          resolved_at: string | null;
          status: string;
          ticket_number: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          assigned_to?: string | null;
          created_at?: string;
          description?: string;
          email?: string | null;
          id?: string;
          priority?: string;
          request_type?: string;
          resolved_at?: string | null;
          status?: string;
          ticket_number?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          assigned_to?: string | null;
          created_at?: string;
          description?: string;
          email?: string | null;
          id?: string;
          priority?: string;
          request_type?: string;
          resolved_at?: string | null;
          status?: string;
          ticket_number?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      survey_responses: {
        Row: {
          created_at: string | null;
          id: string;
          responses: Json | null;
          survey_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          responses?: Json | null;
          survey_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          responses?: Json | null;
          survey_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "survey_responses_survey_id_fkey";
            columns: ["survey_id"];
            isOneToOne: false;
            referencedRelation: "surveys";
            referencedColumns: ["id"];
          },
        ];
      };
      surveys: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          title: string;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          title: string;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          title?: string;
        };
        Relationships: [];
      };
      talent_invites: {
        Row: {
          created_at: string | null;
          employer_id: string | null;
          id: string;
          job_id: string | null;
          message: string | null;
          status: string | null;
          talent_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          employer_id?: string | null;
          id?: string;
          job_id?: string | null;
          message?: string | null;
          status?: string | null;
          talent_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          employer_id?: string | null;
          id?: string;
          job_id?: string | null;
          message?: string | null;
          status?: string | null;
          talent_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "talent_invites_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_postings";
            referencedColumns: ["id"];
          },
        ];
      };
      talent_payouts: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          order_id: string | null;
          status: string;
          stripe_transfer_id: string | null;
          talent_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          order_id?: string | null;
          status?: string;
          stripe_transfer_id?: string | null;
          talent_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          order_id?: string | null;
          status?: string;
          stripe_transfer_id?: string | null;
          talent_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "talent_payouts_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "catalog_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      talent_stripe_accounts: {
        Row: {
          created_at: string;
          id: string;
          status: string;
          stripe_account_id: string;
          updated_at: string;
          user_id: string;
          verification_status: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          status?: string;
          stripe_account_id: string;
          updated_at?: string;
          user_id: string;
          verification_status?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          status?: string;
          stripe_account_id?: string;
          updated_at?: string;
          user_id?: string;
          verification_status?: string | null;
        };
        Relationships: [];
      };
      ticket_comments: {
        Row: {
          author_id: string | null;
          author_name: string;
          author_type: string;
          body: string;
          created_at: string;
          id: string;
          is_public: boolean;
          ticket_id: string;
        };
        Insert: {
          author_id?: string | null;
          author_name: string;
          author_type: string;
          body: string;
          created_at?: string;
          id?: string;
          is_public?: boolean;
          ticket_id: string;
        };
        Update: {
          author_id?: string | null;
          author_name?: string;
          author_type?: string;
          body?: string;
          created_at?: string;
          id?: string;
          is_public?: boolean;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "support_tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_notifications: {
        Row: {
          body_html: string;
          body_text: string;
          created_at: string;
          id: string;
          notification_type: string;
          recipient_email: string;
          recipient_name: string | null;
          sent_at: string | null;
          status: string;
          subject: string;
          ticket_id: string;
        };
        Insert: {
          body_html: string;
          body_text: string;
          created_at?: string;
          id?: string;
          notification_type: string;
          recipient_email: string;
          recipient_name?: string | null;
          sent_at?: string | null;
          status?: string;
          subject: string;
          ticket_id: string;
        };
        Update: {
          body_html?: string;
          body_text?: string;
          created_at?: string;
          id?: string;
          notification_type?: string;
          recipient_email?: string;
          recipient_name?: string | null;
          sent_at?: string | null;
          status?: string;
          subject?: string;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_notifications_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "support_tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_responses: {
        Row: {
          author_id: string;
          created_at: string;
          id: string;
          is_admin_response: boolean;
          message: string;
          ticket_id: string;
        };
        Insert: {
          author_id: string;
          created_at?: string;
          id?: string;
          is_admin_response?: boolean;
          message?: string;
          ticket_id: string;
        };
        Update: {
          author_id?: string;
          created_at?: string;
          id?: string;
          is_admin_response?: boolean;
          message?: string;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_responses_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "support_tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_status_history: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          from_status: string;
          id: string;
          note: string | null;
          ticket_id: string;
          to_status: string;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          from_status: string;
          id?: string;
          note?: string | null;
          ticket_id: string;
          to_status: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          from_status?: string;
          id?: string;
          note?: string | null;
          ticket_id?: string;
          to_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "support_tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      trust_blocklist: {
        Row: {
          active: boolean | null;
          created_at: string;
          description: string | null;
          id: string;
          list_type: string;
          penalty_points: number | null;
          severity: string | null;
          value: string;
        };
        Insert: {
          active?: boolean | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          list_type: string;
          penalty_points?: number | null;
          severity?: string | null;
          value: string;
        };
        Update: {
          active?: boolean | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          list_type?: string;
          penalty_points?: number | null;
          severity?: string | null;
          value?: string;
        };
        Relationships: [];
      };
      user_agent_instances: {
        Row: {
          agent_type: string;
          config: Json;
          created_at: string;
          last_error: string | null;
          last_profile_hash: string | null;
          last_run_at: string | null;
          match_count: number;
          next_run_at: string;
          run_count: number;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          agent_type?: string;
          config?: Json;
          created_at?: string;
          last_error?: string | null;
          last_profile_hash?: string | null;
          last_run_at?: string | null;
          match_count?: number;
          next_run_at?: string;
          run_count?: number;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          agent_type?: string;
          config?: Json;
          created_at?: string;
          last_error?: string | null;
          last_profile_hash?: string | null;
          last_run_at?: string | null;
          match_count?: number;
          next_run_at?: string;
          run_count?: number;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_interview_prep: {
        Row: {
          agent_run_at: string;
          company_bullets: string[] | null;
          expires_at: string;
          id: string;
          job_id: string | null;
          job_url: string | null;
          questions: Json | null;
          red_flags: string[] | null;
          suggested_ans: Json | null;
          user_id: string;
        };
        Insert: {
          agent_run_at?: string;
          company_bullets?: string[] | null;
          expires_at?: string;
          id?: string;
          job_id?: string | null;
          job_url?: string | null;
          questions?: Json | null;
          red_flags?: string[] | null;
          suggested_ans?: Json | null;
          user_id: string;
        };
        Update: {
          agent_run_at?: string;
          company_bullets?: string[] | null;
          expires_at?: string;
          id?: string;
          job_id?: string | null;
          job_url?: string | null;
          questions?: Json | null;
          red_flags?: string[] | null;
          suggested_ans?: Json | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_interview_prep_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_postings";
            referencedColumns: ["id"];
          },
        ];
      };
      user_market_intel: {
        Row: {
          agent_run_at: string;
          demand_by_city: Json | null;
          hot_companies: Json | null;
          id: string;
          remote_ratio: number | null;
          total_listings: number | null;
          trending_skills: Json | null;
          user_id: string;
        };
        Insert: {
          agent_run_at?: string;
          demand_by_city?: Json | null;
          hot_companies?: Json | null;
          id?: string;
          remote_ratio?: number | null;
          total_listings?: number | null;
          trending_skills?: Json | null;
          user_id: string;
        };
        Update: {
          agent_run_at?: string;
          demand_by_city?: Json | null;
          hot_companies?: Json | null;
          id?: string;
          remote_ratio?: number | null;
          total_listings?: number | null;
          trending_skills?: Json | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_portfolio_items: {
        Row: {
          created_at: string;
          description: string | null;
          display_order: number;
          id: string;
          image_url: string | null;
          is_public: boolean;
          item_type: string;
          tags: string[] | null;
          title: string;
          url: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          image_url?: string | null;
          is_public?: boolean;
          item_type?: string;
          tags?: string[] | null;
          title?: string;
          url?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          image_url?: string | null;
          is_public?: boolean;
          item_type?: string;
          tags?: string[] | null;
          title?: string;
          url?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          created_at: string;
          email_updates: boolean | null;
          id: string;
          language: string;
          notifications_enabled: boolean | null;
          theme: string | null;
          timezone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email_updates?: boolean | null;
          id?: string;
          language?: string;
          notifications_enabled?: boolean | null;
          theme?: string | null;
          timezone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email_updates?: boolean | null;
          id?: string;
          language?: string;
          notifications_enabled?: boolean | null;
          theme?: string | null;
          timezone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
          user_id: string;
          username: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          user_id: string;
          username?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          user_id?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      user_salary_snapshots: {
        Row: {
          agent_run_at: string;
          id: string;
          location: string | null;
          market_p25: number | null;
          market_p50: number | null;
          market_p75: number | null;
          percentile: number | null;
          raw_data: Json | null;
          sample_size: number | null;
          title: string | null;
          trend: string | null;
          user_id: string;
          your_max: number | null;
          your_min: number | null;
        };
        Insert: {
          agent_run_at?: string;
          id?: string;
          location?: string | null;
          market_p25?: number | null;
          market_p50?: number | null;
          market_p75?: number | null;
          percentile?: number | null;
          raw_data?: Json | null;
          sample_size?: number | null;
          title?: string | null;
          trend?: string | null;
          user_id: string;
          your_max?: number | null;
          your_min?: number | null;
        };
        Update: {
          agent_run_at?: string;
          id?: string;
          location?: string | null;
          market_p25?: number | null;
          market_p50?: number | null;
          market_p75?: number | null;
          percentile?: number | null;
          raw_data?: Json | null;
          sample_size?: number | null;
          title?: string | null;
          trend?: string | null;
          user_id?: string;
          your_max?: number | null;
          your_min?: number | null;
        };
        Relationships: [];
      };
      user_search_preferences: {
        Row: {
          alert_frequency: string | null;
          alert_min_score: number | null;
          alerts_enabled: boolean | null;
          auto_apply_threshold: number | null;
          autopilot_level: string | null;
          benefits_priorities: string[] | null;
          created_at: string;
          employment_types: string[] | null;
          experience_level: string | null;
          id: string;
          max_applications_per_day: number | null;
          preferred_locations: string[] | null;
          remote_preference: string | null;
          salary_currency: string | null;
          salary_max: number | null;
          salary_min: number | null;
          search_mode: string | null;
          target_skills: string[] | null;
          target_titles: string[] | null;
          updated_at: string;
          user_id: string;
          willing_to_relocate: boolean | null;
        };
        Insert: {
          alert_frequency?: string | null;
          alert_min_score?: number | null;
          alerts_enabled?: boolean | null;
          auto_apply_threshold?: number | null;
          autopilot_level?: string | null;
          benefits_priorities?: string[] | null;
          created_at?: string;
          employment_types?: string[] | null;
          experience_level?: string | null;
          id?: string;
          max_applications_per_day?: number | null;
          preferred_locations?: string[] | null;
          remote_preference?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          search_mode?: string | null;
          target_skills?: string[] | null;
          target_titles?: string[] | null;
          updated_at?: string;
          user_id: string;
          willing_to_relocate?: boolean | null;
        };
        Update: {
          alert_frequency?: string | null;
          alert_min_score?: number | null;
          alerts_enabled?: boolean | null;
          auto_apply_threshold?: number | null;
          autopilot_level?: string | null;
          benefits_priorities?: string[] | null;
          created_at?: string;
          employment_types?: string[] | null;
          experience_level?: string | null;
          id?: string;
          max_applications_per_day?: number | null;
          preferred_locations?: string[] | null;
          remote_preference?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          search_mode?: string | null;
          target_skills?: string[] | null;
          target_titles?: string[] | null;
          updated_at?: string;
          user_id?: string;
          willing_to_relocate?: boolean | null;
        };
        Relationships: [];
      };
      watchdog_daily_reports: {
        Row: {
          auto_repaired: number;
          created_at: string;
          failed: number;
          id: string;
          new_incidents: number;
          open_incidents: number;
          passed: number;
          report_date: string;
          summary_json: Json | null;
          total_probes: number;
          updated_at: string;
          warnings: number;
        };
        Insert: {
          auto_repaired?: number;
          created_at?: string;
          failed?: number;
          id?: string;
          new_incidents?: number;
          open_incidents?: number;
          passed?: number;
          report_date: string;
          summary_json?: Json | null;
          total_probes?: number;
          updated_at?: string;
          warnings?: number;
        };
        Update: {
          auto_repaired?: number;
          created_at?: string;
          failed?: number;
          id?: string;
          new_incidents?: number;
          open_incidents?: number;
          passed?: number;
          report_date?: string;
          summary_json?: Json | null;
          total_probes?: number;
          updated_at?: string;
          warnings?: number;
        };
        Relationships: [];
      };
      watchdog_incidents: {
        Row: {
          auto_repaired: boolean;
          consecutive_failures: number;
          created_at: string;
          error_summary: string | null;
          first_seen_at: string;
          github_issue_url: string | null;
          id: string;
          last_seen_at: string;
          probe_id: string;
          probe_name: string;
          resolved_at: string | null;
          sentry_event_id: string | null;
          severity: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          auto_repaired?: boolean;
          consecutive_failures?: number;
          created_at?: string;
          error_summary?: string | null;
          first_seen_at?: string;
          github_issue_url?: string | null;
          id?: string;
          last_seen_at?: string;
          probe_id: string;
          probe_name: string;
          resolved_at?: string | null;
          sentry_event_id?: string | null;
          severity: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          auto_repaired?: boolean;
          consecutive_failures?: number;
          created_at?: string;
          error_summary?: string | null;
          first_seen_at?: string;
          github_issue_url?: string | null;
          id?: string;
          last_seen_at?: string;
          probe_id?: string;
          probe_name?: string;
          resolved_at?: string | null;
          sentry_event_id?: string | null;
          severity?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watchdog_incidents_probe_id_fkey";
            columns: ["probe_id"];
            isOneToOne: false;
            referencedRelation: "watchdog_probes";
            referencedColumns: ["id"];
          },
        ];
      };
      watchdog_probes: {
        Row: {
          check_interval_seconds: number;
          created_at: string;
          enabled: boolean;
          failure_threshold: number;
          id: string;
          latency_threshold_ms: number;
          probe_name: string;
          probe_type: string;
          target_service: string;
          updated_at: string;
        };
        Insert: {
          check_interval_seconds?: number;
          created_at?: string;
          enabled?: boolean;
          failure_threshold?: number;
          id?: string;
          latency_threshold_ms?: number;
          probe_name: string;
          probe_type: string;
          target_service: string;
          updated_at?: string;
        };
        Update: {
          check_interval_seconds?: number;
          created_at?: string;
          enabled?: boolean;
          failure_threshold?: number;
          id?: string;
          latency_threshold_ms?: number;
          probe_name?: string;
          probe_type?: string;
          target_service?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      watchdog_results: {
        Row: {
          checked_at: string;
          error_code: string | null;
          error_detail: string | null;
          id: string;
          latency_ms: number | null;
          probe_id: string;
          probe_name: string;
          status: string;
        };
        Insert: {
          checked_at?: string;
          error_code?: string | null;
          error_detail?: string | null;
          id?: string;
          latency_ms?: number | null;
          probe_id: string;
          probe_name: string;
          status: string;
        };
        Update: {
          checked_at?: string;
          error_code?: string | null;
          error_detail?: string | null;
          id?: string;
          latency_ms?: number | null;
          probe_id?: string;
          probe_name?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watchdog_results_probe_id_fkey";
            columns: ["probe_id"];
            isOneToOne: false;
            referencedRelation: "watchdog_probes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      discovery_stats: {
        Row: {
          avg_duration_ms: number | null;
          failed_runs: number | null;
          successful_runs: number | null;
          total_accepted: number | null;
          total_fetched: number | null;
          total_runs: number | null;
          total_scored: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      enrichment_stats: {
        Row: {
          aggregator_postings: number | null;
          ai_scored_jobs: number | null;
          apply_fast_count: number | null;
          apply_now_count: number | null;
          avg_ai_legitimacy: number | null;
          avg_ai_score: number | null;
          avg_response_probability: number | null;
          direct_postings: number | null;
          enriched_jobs: number | null;
          improve_first_count: number | null;
          skip_count: number | null;
          total_jobs: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      invite_daily_usage: {
        Row: {
          inviter_id: string | null;
          invites_remaining_today: number | null;
          invites_sent_today: number | null;
        };
        Relationships: [];
      };
      pipeline_stats_24h: {
        Row: {
          avg_confidence: number | null;
          deduped: number | null;
          events_published: number | null;
          extracted: number | null;
          raw_fetched: number | null;
          scored: number | null;
        };
        Relationships: [];
      };
      user_job_feed: {
        Row: {
          company: string | null;
          currency: string | null;
          employment_type: string | null;
          experience_level: string | null;
          experience_match_pct: number | null;
          fit_reasoning: string | null;
          fit_score: number | null;
          id: string | null;
          job_description_clean: string | null;
          job_hash: string | null;
          location: string | null;
          profile_id: string | null;
          remote_type: string | null;
          required_skills: string[] | null;
          salary_match_pct: number | null;
          salary_max: number | null;
          salary_min: number | null;
          skill_match_pct: number | null;
          source_count: number | null;
          title: string | null;
        };
        Relationships: [];
      };
      user_opportunity_feed: {
        Row: {
          ai_legitimacy: number | null;
          ai_match_summary: string | null;
          ai_red_flags: string[] | null;
          ai_score: number | null;
          benefits_extracted: string[] | null;
          benefits_taxonomy: Json | null;
          company_name: string | null;
          company_url: string | null;
          created_at: string | null;
          dedup_hash: string | null;
          description: string | null;
          description_length: number | null;
          discovery_batch_id: string | null;
          effort_estimate: string | null;
          effort_minutes: number | null;
          employment_type: string | null;
          enriched_at: string | null;
          experience_level: string | null;
          expires_at: string | null;
          external_id: string | null;
          first_seen_at: string | null;
          flagged_reason: string | null;
          id: string | null;
          is_direct_posting: boolean | null;
          is_flagged: boolean | null;
          last_seen_at: string | null;
          location: string | null;
          location_type: string | null;
          normalized_url: string | null;
          original_url: string | null;
          parsed_company_info: string | null;
          parsed_requirements: string[] | null;
          posted_at: string | null;
          raw_data: Json | null;
          redirect_chain: string[] | null;
          relevance_score: number | null;
          remote_preference: string | null;
          response_factors: Json | null;
          response_probability: number | null;
          salary_currency: string | null;
          salary_max: number | null;
          salary_min: number | null;
          salary_text: string | null;
          score_breakdown: Json | null;
          score_explanation: string | null;
          scored_at: string | null;
          search_mode: string | null;
          skills_extracted: string[] | null;
          smart_tags: string[] | null;
          source_name: string | null;
          source_url: string | null;
          status: string | null;
          strategy: string | null;
          strategy_priority: number | null;
          strategy_reason: string | null;
          target_titles: string[] | null;
          title: string | null;
          title_normalized: string | null;
          trust_flags: string[] | null;
          trust_score: number | null;
          updated_at: string | null;
          user_id: string | null;
          user_salary_max: number | null;
          user_salary_min: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "discovered_jobs_source_name_fkey";
            columns: ["source_name"];
            isOneToOne: false;
            referencedRelation: "job_source_config";
            referencedColumns: ["source_name"];
          },
        ];
      };
      user_reputation_summary: {
        Row: {
          average_rating: number | null;
          five_star_count: number | null;
          four_star_count: number | null;
          id: string | null;
          last_review_date: string | null;
          one_star_count: number | null;
          three_star_count: number | null;
          total_ratings: number | null;
          two_star_count: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      _map_job_type: { Args: { p: string }; Returns: string };
      _map_location_type: { Args: { p_remote: boolean }; Returns: string };
      _norm_source: { Args: { p: string }; Returns: string };
      _score_job: {
        Args: {
          p_days_old: number;
          p_is_remote: boolean;
          p_remote_pref: string;
          p_sal_max: number;
          p_sal_min: number;
          p_source: string;
          p_target_titles: string[];
          p_title: string;
          p_u_sal_max: number;
          p_u_sal_min: number;
        };
        Returns: number;
      };
      archive_stale_jobs: { Args: never; Returns: number };
      bridge_jobs_to_discovered: {
        Args: {
          p_lookback_hours?: number;
          p_max_per_user?: number;
          p_user_id?: string;
        };
        Returns: {
          from_postings: number;
          from_scraped: number;
          out_user_id: string;
          skipped: number;
        }[];
      };
      check_and_increment_invite_limit: {
        Args: { p_inviter_id: string };
        Returns: Json;
      };
      check_registration_mode: { Args: never; Returns: Json };
      cleanup_expired_cache: { Args: never; Returns: number };
      cleanup_stale_discovered_jobs: { Args: never; Returns: undefined };
      generate_job_dedup_hash: {
        Args: { p_company: string; p_location: string; p_title: string };
        Returns: string;
      };
      generate_ticket_number: { Args: never; Returns: string };
      get_top_search_terms: {
        Args: { limit_count?: number };
        Returns: {
          location: string;
          search_count: number;
          search_term: string;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      increment_extraction_failure: {
        Args: { p_domain: string };
        Returns: undefined;
      };
      increment_extraction_success: {
        Args: { p_domain: string };
        Returns: undefined;
      };
      mark_events_consumed: {
        Args: { p_consumer: string; p_event_ids: string[] };
        Returns: undefined;
      };
      mark_job_interaction: {
        Args: { p_action: string; p_job_id: string; p_user_id: string };
        Returns: undefined;
      };
      mark_stale_jobs: { Args: never; Returns: undefined };
      normalize_job_title: { Args: { p_title: string }; Returns: string };
      record_source_failure: {
        Args: { p_source_name: string };
        Returns: undefined;
      };
      record_source_success: {
        Args: { p_source_name: string };
        Returns: undefined;
      };
      resolve_admin_email: { Args: { _username: string }; Returns: string };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      trigger_dedup_batch: { Args: never; Returns: undefined };
      trigger_extract_batch: { Args: never; Returns: undefined };
      trigger_score_batch: { Args: never; Returns: undefined };
      update_extraction_accuracy_stats: { Args: never; Returns: undefined };
    };
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "job_seeker"
        | "employer"
        | "talent";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "moderator",
        "user",
        "job_seeker",
        "employer",
        "talent",
      ],
    },
  },
} as const;
