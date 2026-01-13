export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      consigners: {
        Row: {
          id: string;
          name: string;
          number: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          number?: string | null;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          number?: string | null;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      forms: {
        Row: {
          id: string;
          consigner_type: string;
          consigner_name: string;
          consigner_number: string | null;
          consigner_address: string | null;
          consigner_phone: string | null;
          consigner_email: string | null;
          intake_mode: string | null;
          status: string;
          items: Json;
          enabled_fields: Json | null;
          signature_data: string | null;
          initials_1: string | null;
          initials_2: string | null;
          initials_3: string | null;
          accepted_by: string | null;
          created_at: string;
          updated_at: string;
          signed_at: string | null;
          created_by: string | null;
          signed_by: string | null;
        };
        Insert: {
          id?: string;
          consigner_type: string;
          consigner_name: string;
          consigner_number?: string | null;
          consigner_address?: string | null;
          consigner_phone?: string | null;
          consigner_email?: string | null;
          intake_mode?: string | null;
          status?: string;
          items?: Json;
          enabled_fields?: Json | null;
          signature_data?: string | null;
          initials_1?: string | null;
          initials_2?: string | null;
          initials_3?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          updated_at?: string;
          signed_at?: string | null;
          created_by?: string | null;
          signed_by?: string | null;
        };
        Update: {
          id?: string;
          consigner_type?: string;
          consigner_name?: string;
          consigner_number?: string | null;
          consigner_address?: string | null;
          consigner_phone?: string | null;
          consigner_email?: string | null;
          intake_mode?: string | null;
          status?: string;
          items?: Json;
          enabled_fields?: Json | null;
          signature_data?: string | null;
          initials_1?: string | null;
          initials_2?: string | null;
          initials_3?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          updated_at?: string;
          signed_at?: string | null;
          created_by?: string | null;
          signed_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ConsignerRecord = Database['public']['Tables']['consigners']['Row'];
export type FormRecord = Database['public']['Tables']['forms']['Row'];
