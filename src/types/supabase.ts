import type {
  CarouselDraft,
  CarouselEditorState,
  CarouselGenerationStatus
} from "@/lib/db/types";

export type Database = {
  public: {
    Views: Record<string, never>;
    Tables: {
      instance_settings: {
        Row: {
          id: number;
          initialized: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          initialized?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          initialized?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      super_admins: {
        Row: {
          user_id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          email: string;
        };
        Update: never;
        Relationships: [];
      };
      allowlisted_emails: {
        Row: {
          email: string;
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          email: string;
          invited_by?: string | null;
        };
        Update: {
          invited_by?: string | null;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          logo_path: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          logo_path?: string | null;
          created_by: string;
        };
        Update: {
          name?: string;
          logo_path?: string | null;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: "owner" | "member" | "admin";
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role?: "owner" | "member" | "admin";
        };
        Update: {
          role?: "owner" | "member" | "admin";
        };
        Relationships: [];
      };
      carousels: {
        Row: {
          id: string;
          workspace_id: string;
          owner_id: string;
          title: string | null;
          draft: CarouselDraft;
          element_locks: Record<string, unknown>;
          editor_state: CarouselEditorState;
          generation_status: CarouselGenerationStatus;
          generation_meta: Record<string, unknown>;
          generation_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          owner_id: string;
          title?: string | null;
          draft: CarouselDraft;
          element_locks?: Record<string, unknown>;
          editor_state?: CarouselEditorState;
          generation_status?: CarouselGenerationStatus;
          generation_meta?: Record<string, unknown>;
          generation_error?: string | null;
        };
        Update: {
          title?: string | null;
          draft?: CarouselDraft;
          element_locks?: Record<string, unknown>;
          editor_state?: CarouselEditorState;
          generation_status?: CarouselGenerationStatus;
          generation_meta?: Record<string, unknown>;
          generation_error?: string | null;
        };
        Relationships: [];
      };
      carousel_assets: {
        Row: {
          id: string;
          workspace_id: string;
          carousel_id: string;
          owner_id: string;
          asset_type: string;
          storage_bucket: string;
          storage_path: string;
          mime_type: string | null;
          status: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          carousel_id: string;
          owner_id: string;
          asset_type: string;
          storage_bucket: string;
          storage_path: string;
          mime_type?: string | null;
          status?: string;
          metadata?: Record<string, unknown>;
        };
        Update: never;
        Relationships: [];
      };
      carousel_templates: {
        Row: {
          id: string;
          workspace_id: string | null;
          owner_id: string | null;
          name: string;
          template_data: Record<string, unknown>;
          is_global: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          owner_id?: string | null;
          name: string;
          template_data?: Record<string, unknown>;
          is_global?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          workspace_id?: string | null;
          owner_id?: string | null;
          name?: string;
          template_data?: Record<string, unknown>;
          is_global?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      creator_profiles: {
        Row: {
          id: string;
          workspace_id: string;
          owner_id: string;
          display_name: string;
          handle: string | null;
          role_title: string | null;
          avatar_path: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          owner_id: string;
          display_name: string;
          handle?: string | null;
          role_title?: string | null;
          avatar_path?: string | null;
          is_default?: boolean;
        };
        Update: {
          display_name?: string;
          handle?: string | null;
          role_title?: string | null;
          avatar_path?: string | null;
          is_default?: boolean;
        };
        Relationships: [];
      };
      user_presets: {
        Row: {
          id: string;
          workspace_id: string;
          owner_id: string;
          name: string;
          preset_data: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          owner_id: string;
          name: string;
          preset_data?: Record<string, unknown>;
        };
        Update: {
          name?: string;
          preset_data?: Record<string, unknown>;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_super_admin: {
        Args: { user_id: string };
        Returns: boolean;
      };
      is_email_allowlisted: {
        Args: { p_email: string };
        Returns: boolean;
      };
      default_workspace_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      workspace_id_from_storage_path: {
        Args: { path: string };
        Returns: string | null;
      };
    };
    Enums: {
      workspace_role: "owner" | "member" | "admin";
    };
    CompositeTypes: Record<string, never>;
  };
};
