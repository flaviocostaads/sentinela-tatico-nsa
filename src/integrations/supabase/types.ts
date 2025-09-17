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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      api_integrations: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          integration_name: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          integration_name: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          integration_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      checkpoint_visits: {
        Row: {
          checkpoint_id: string
          duration: number
          id: string
          lat: number | null
          lng: number | null
          round_id: string
          status: Database["public"]["Enums"]["checkpoint_status"]
          visit_time: string
        }
        Insert: {
          checkpoint_id: string
          duration?: number
          id?: string
          lat?: number | null
          lng?: number | null
          round_id: string
          status?: Database["public"]["Enums"]["checkpoint_status"]
          visit_time?: string
        }
        Update: {
          checkpoint_id?: string
          duration?: number
          id?: string
          lat?: number | null
          lng?: number | null
          round_id?: string
          status?: Database["public"]["Enums"]["checkpoint_status"]
          visit_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkpoint_visits_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkpoint_visits_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      checkpoints: {
        Row: {
          active: boolean
          checklist_items: Json | null
          client_id: string
          created_at: string
          description: string | null
          geofence_radius: number | null
          id: string
          lat: number | null
          lng: number | null
          manual_code: string | null
          name: string
          order_index: number
          qr_code: string | null
        }
        Insert: {
          active?: boolean
          checklist_items?: Json | null
          client_id: string
          created_at?: string
          description?: string | null
          geofence_radius?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          manual_code?: string | null
          name: string
          order_index?: number
          qr_code?: string | null
        }
        Update: {
          active?: boolean
          checklist_items?: Json | null
          client_id?: string
          created_at?: string
          description?: string | null
          geofence_radius?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          manual_code?: string | null
          name?: string
          order_index?: number
          qr_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkpoints_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean
          address: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          description: string | null
          email: string | null
          favicon_url: string | null
          header_logo_url: string | null
          id: string
          login_logo_url: string | null
          logo_url: string | null
          phone: string | null
          qr_logo_url: string | null
          report_logo_url: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          favicon_url?: string | null
          header_logo_url?: string | null
          id?: string
          login_logo_url?: string | null
          logo_url?: string | null
          phone?: string | null
          qr_logo_url?: string | null
          report_logo_url?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          favicon_url?: string | null
          header_logo_url?: string | null
          id?: string
          login_logo_url?: string | null
          logo_url?: string | null
          phone?: string | null
          qr_logo_url?: string | null
          report_logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          description: string | null
          id: string
          investigated_by: string | null
          investigation_completed_at: string | null
          investigation_report: string | null
          lat: number | null
          lng: number | null
          priority: Database["public"]["Enums"]["incident_priority"]
          reported_at: string
          resolution_comment: string | null
          resolved_at: string | null
          resolved_by: string | null
          round_id: string
          status: string
          title: string
          type: Database["public"]["Enums"]["incident_type"]
        }
        Insert: {
          description?: string | null
          id?: string
          investigated_by?: string | null
          investigation_completed_at?: string | null
          investigation_report?: string | null
          lat?: number | null
          lng?: number | null
          priority?: Database["public"]["Enums"]["incident_priority"]
          reported_at?: string
          resolution_comment?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          round_id: string
          status?: string
          title: string
          type?: Database["public"]["Enums"]["incident_type"]
        }
        Update: {
          description?: string | null
          id?: string
          investigated_by?: string | null
          investigation_completed_at?: string | null
          investigation_report?: string | null
          lat?: number | null
          lng?: number | null
          priority?: Database["public"]["Enums"]["incident_priority"]
          reported_at?: string
          resolution_comment?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          round_id?: string
          status?: string
          title?: string
          type?: Database["public"]["Enums"]["incident_type"]
        }
        Relationships: [
          {
            foreignKeyName: "incidents_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          content: string | null
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          integration_type: string
          metadata: Json | null
          recipient: string
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          integration_type: string
          metadata?: Json | null
          recipient: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          integration_type?: string
          metadata?: Json | null
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          active: boolean
          content: string
          created_at: string
          id: string
          subject: string | null
          template_name: string
          template_type: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          active?: boolean
          content: string
          created_at?: string
          id?: string
          subject?: string | null
          template_name: string
          template_type: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          active?: boolean
          content?: string
          created_at?: string
          id?: string
          subject?: string | null
          template_name?: string
          template_type?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
      odometer_records: {
        Row: {
          created_at: string | null
          id: string
          odometer_reading: number
          photo_url: string
          record_type: string
          recorded_at: string | null
          round_id: string | null
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          odometer_reading: number
          photo_url: string
          record_type: string
          recorded_at?: string | null
          round_id?: string | null
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          odometer_reading?: number
          photo_url?: string
          record_type?: string
          recorded_at?: string | null
          round_id?: string | null
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "odometer_records_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odometer_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          checkpoint_visit_id: string | null
          created_at: string
          id: string
          incident_id: string | null
          lat: number | null
          lng: number | null
          metadata: Json | null
          round_id: string | null
          url: string
        }
        Insert: {
          checkpoint_visit_id?: string | null
          created_at?: string
          id?: string
          incident_id?: string | null
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
          round_id?: string | null
          url: string
        }
        Update: {
          checkpoint_visit_id?: string | null
          created_at?: string
          id?: string
          incident_id?: string | null
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
          round_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_checkpoint_visit_id_fkey"
            columns: ["checkpoint_visit_id"]
            isOneToOne: false
            referencedRelation: "checkpoint_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          alternative_email: string | null
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          alternative_email?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          alternative_email?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      round_assignments: {
        Row: {
          assigned_at: string
          id: string
          round_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          round_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_assignments_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      round_schedules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          shift_end: string
          shift_start: string
          template_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          shift_end: string
          shift_start: string
          template_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          shift_end?: string
          shift_start?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_schedules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "round_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      round_template_checkpoints: {
        Row: {
          client_id: string
          created_at: string
          estimated_duration_minutes: number | null
          id: string
          order_index: number
          required_signature: boolean | null
          template_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          estimated_duration_minutes?: number | null
          id?: string
          order_index: number
          required_signature?: boolean | null
          template_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          estimated_duration_minutes?: number | null
          id?: string
          order_index?: number
          required_signature?: boolean | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_template_checkpoints_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_template_checkpoints_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "round_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      round_templates: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          requires_signature: boolean
          shift_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          requires_signature?: boolean
          shift_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          requires_signature?: boolean
          shift_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          checklist_completed: boolean | null
          client_id: string
          created_at: string
          created_by: string | null
          current_checkpoint_index: number | null
          end_odometer: number | null
          end_time: string | null
          final_odometer: number | null
          id: string
          initial_odometer: number | null
          requires_signature: boolean
          round_number: number | null
          route_map_data: Json | null
          start_odometer: number | null
          start_time: string | null
          status: Database["public"]["Enums"]["round_status"]
          template_id: string | null
          updated_at: string
          user_id: string
          vehicle: Database["public"]["Enums"]["vehicle_type"]
          vehicle_id: string | null
        }
        Insert: {
          checklist_completed?: boolean | null
          client_id: string
          created_at?: string
          created_by?: string | null
          current_checkpoint_index?: number | null
          end_odometer?: number | null
          end_time?: string | null
          final_odometer?: number | null
          id?: string
          initial_odometer?: number | null
          requires_signature?: boolean
          round_number?: number | null
          route_map_data?: Json | null
          start_odometer?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["round_status"]
          template_id?: string | null
          updated_at?: string
          user_id: string
          vehicle: Database["public"]["Enums"]["vehicle_type"]
          vehicle_id?: string | null
        }
        Update: {
          checklist_completed?: boolean | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          current_checkpoint_index?: number | null
          end_odometer?: number | null
          end_time?: string | null
          final_odometer?: number | null
          id?: string
          initial_odometer?: number | null
          requires_signature?: boolean
          round_number?: number | null
          route_map_data?: Json | null
          start_odometer?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["round_status"]
          template_id?: string | null
          updated_at?: string
          user_id?: string
          vehicle?: Database["public"]["Enums"]["vehicle_type"]
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "round_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "rounds_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_points: {
        Row: {
          id: string
          lat: number
          lng: number
          recorded_at: string
          round_id: string
          speed: number | null
        }
        Insert: {
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          round_id: string
          speed?: number | null
        }
        Update: {
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          round_id?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "route_points_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      user_locations: {
        Row: {
          accuracy: number | null
          heading: number | null
          id: string
          is_active: boolean
          lat: number
          lng: number
          recorded_at: string
          round_id: string | null
          speed: number | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          is_active?: boolean
          lat: number
          lng: number
          recorded_at?: string
          round_id?: string | null
          speed?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          is_active?: boolean
          lat?: number
          lng?: number
          recorded_at?: string
          round_id?: string | null
          speed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_fuel_logs: {
        Row: {
          created_at: string
          created_by: string
          fuel_amount: number
          fuel_cost: number | null
          fuel_station: string | null
          id: string
          odometer_reading: number
          round_id: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          fuel_amount: number
          fuel_cost?: number | null
          fuel_station?: string | null
          id?: string
          odometer_reading: number
          round_id?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          fuel_amount?: number
          fuel_cost?: number | null
          fuel_station?: string | null
          id?: string
          odometer_reading?: number
          round_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_fuel_logs_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenance_logs: {
        Row: {
          cost: number | null
          created_at: string
          created_by: string
          description: string
          end_time: string | null
          id: string
          location: string | null
          maintenance_type: string
          odometer_reading: number
          parts_replaced: string[] | null
          round_id: string | null
          service_provider: string | null
          service_type: string
          start_time: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          created_by: string
          description: string
          end_time?: string | null
          id?: string
          location?: string | null
          maintenance_type: string
          odometer_reading: number
          parts_replaced?: string[] | null
          round_id?: string | null
          service_provider?: string | null
          service_type: string
          start_time?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          created_by?: string
          description?: string
          end_time?: string | null
          id?: string
          location?: string | null
          maintenance_type?: string
          odometer_reading?: number
          parts_replaced?: string[] | null
          round_id?: string | null
          service_provider?: string | null
          service_type?: string
          start_time?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicle_maintenance_schedules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          interval_days: number | null
          interval_km: number | null
          last_service_date: string | null
          last_service_km: number | null
          next_service_date: string | null
          next_service_km: number | null
          service_type: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          last_service_date?: string | null
          last_service_km?: number | null
          next_service_date?: string | null
          next_service_km?: number | null
          service_type: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          interval_days?: number | null
          interval_km?: number | null
          last_service_date?: string | null
          last_service_km?: number | null
          next_service_date?: string | null
          next_service_km?: number | null
          service_type?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          active: boolean
          brand: string
          created_at: string
          current_odometer: number
          fuel_capacity: number | null
          id: string
          initial_odometer: number
          license_plate: string
          model: string
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at: string
          year: number
        }
        Insert: {
          active?: boolean
          brand: string
          created_at?: string
          current_odometer?: number
          fuel_capacity?: number | null
          id?: string
          initial_odometer?: number
          license_plate: string
          model: string
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          year: number
        }
        Update: {
          active?: boolean
          brand?: string
          created_at?: string
          current_odometer?: number
          fuel_capacity?: number | null
          id?: string
          initial_odometer?: number
          license_plate?: string
          model?: string
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_admin_or_operator_role: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      check_admin_role: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      delete_incident_with_audit: {
        Args: {
          p_admin_name: string
          p_admin_user_id: string
          p_incident_id: string
        }
        Returns: string
      }
      delete_round_with_audit: {
        Args: {
          p_admin_name: string
          p_admin_user_id: string
          p_round_id: string
        }
        Returns: string
      }
      delete_user_permanently: {
        Args: {
          p_admin_name: string
          p_admin_user_id: string
          p_user_id: string
        }
        Returns: string
      }
      is_user_assigned_to_round: {
        Args: { p_round_id: string; p_user_id: string }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_new_values?: Json
          p_old_values?: Json
          p_record_id?: string
          p_table_name: string
          p_user_id: string
          p_user_name: string
        }
        Returns: string
      }
    }
    Enums: {
      checkpoint_status: "completed" | "skipped" | "delayed"
      incident_priority: "low" | "medium" | "high" | "critical"
      incident_type: "security" | "maintenance" | "emergency" | "other"
      round_status: "pending" | "active" | "completed" | "incident"
      user_role: "admin" | "operador" | "tatico"
      vehicle_type: "car" | "motorcycle"
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
      checkpoint_status: ["completed", "skipped", "delayed"],
      incident_priority: ["low", "medium", "high", "critical"],
      incident_type: ["security", "maintenance", "emergency", "other"],
      round_status: ["pending", "active", "completed", "incident"],
      user_role: ["admin", "operador", "tatico"],
      vehicle_type: ["car", "motorcycle"],
    },
  },
} as const
