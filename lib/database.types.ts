// lib/database.types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          pass_hash: string;
          created_at?: string | null;
        };
        Insert: {
          id?: string;
          username: string;
          pass_hash: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          username?: string;
          pass_hash?: string;
          created_at?: string | null;
        };
      };

      player_state: {
        Row: {
          profile_id: string;
          state: Json;
          updated_at?: string | null;
        };
        Insert: {
          profile_id: string;
          state: Json;
          updated_at?: string | null;
        };
        Update: {
          state?: Json;
          updated_at?: string | null;
        };
      };

      battle_reports: {
        Row: {
          id: string;
          profile_id: string;
          raw_storage_path?: string | null;
          parsed: Json;
          consent_scope?: string | null;
          created_at?: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          raw_storage_path?: string | null;
          parsed: Json;
          consent_scope?: string | null;
          created_at?: string | null;
        };
        Update: {
          raw_storage_path?: string | null;
          parsed?: Json;
          consent_scope?: string | null;
          created_at?: string | null;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
