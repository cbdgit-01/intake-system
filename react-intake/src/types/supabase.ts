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
          role: 'staff' | 'admin';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          role?: 'staff' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          role?: 'staff' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
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
      };
      forms: {
        Row: {
          id: string;
          consigner_type: 'new' | 'existing';
          consigner_name: string;
          consigner_number: string | null;
          consigner_address: string | null;
          consigner_phone: string | null;
          consigner_email: string | null;
          intake_mode: 'detection' | 'general' | 'email' | null;
          status: 'draft' | 'signed';
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
          consigner_type: 'new' | 'existing';
          consigner_name: string;
          consigner_number?: string | null;
          consigner_address?: string | null;
          consigner_phone?: string | null;
          consigner_email?: string | null;
          intake_mode?: 'detection' | 'general' | 'email' | null;
          status?: 'draft' | 'signed';
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
          consigner_type?: 'new' | 'existing';
          consigner_name?: string;
          consigner_number?: string | null;
          consigner_address?: string | null;
          consigner_phone?: string | null;
          consigner_email?: string | null;
          intake_mode?: 'detection' | 'general' | 'email' | null;
          status?: 'draft' | 'signed';
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
      };
    };
  };
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Consigner = Database['public']['Tables']['consigners']['Row'];
export type FormRecord = Database['public']['Tables']['forms']['Row'];


