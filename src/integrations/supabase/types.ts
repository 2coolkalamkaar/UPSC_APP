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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      books: {
        Row: {
          author: string | null
          created_at: string
          id: string
          is_official: boolean
          mime_type: string | null
          pages: number | null
          storage_path: string | null
          title: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          is_official?: boolean
          mime_type?: string | null
          pages?: number | null
          storage_path?: string | null
          title: string
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          is_official?: boolean
          mime_type?: string | null
          pages?: number | null
          storage_path?: string | null
          title?: string
        }
        Relationships: []
      }
      chapters: {
        Row: {
          book_id: string | null
          created_at: string
          id: string
          order: number
          slug: string
          title: string
        }
        Insert: {
          book_id?: string | null
          created_at?: string
          id?: string
          order: number
          slug: string
          title: string
        }
        Update: {
          book_id?: string | null
          created_at?: string
          id?: string
          order?: number
          slug?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          book_id: string | null
          chapter_id: string
          content: string
          created_at: string
          embedding: string | null
          heading: string | null
          id: string
          page_end: number | null
          page_start: number | null
        }
        Insert: {
          book_id?: string | null
          chapter_id: string
          content: string
          created_at?: string
          embedding?: string | null
          heading?: string | null
          id?: string
          page_end?: number | null
          page_start?: number | null
        }
        Update: {
          book_id?: string | null
          chapter_id?: string
          content?: string
          created_at?: string
          embedding?: string | null
          heading?: string | null
          id?: string
          page_end?: number | null
          page_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chunks_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      current_affairs: {
        Row: {
          chapter_id: string | null
          created_at: string
          embedding: string | null
          id: string
          published_on: string | null
          source: string
          summary: string
          title: string
          topic: string | null
        }
        Insert: {
          chapter_id?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          published_on?: string | null
          source?: string
          summary: string
          title: string
          topic?: string | null
        }
        Update: {
          chapter_id?: string | null
          created_at?: string
          embedding?: string | null
          id?: string
          published_on?: string | null
          source?: string
          summary?: string
          title?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "current_affairs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      mains_evaluations: {
        Row: {
          answer: string
          created_at: string
          id: string
          overall: number
          question: string
          rubric_json: Json
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          overall: number
          question: string
          rubric_json: Json
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          overall?: number
          question?: string
          rubric_json?: Json
        }
        Relationships: []
      }
      notifications: {
        Row: {
          chapter_id: string
          created_at: string
          current_affairs_id: string
          id: string
          read_at: string | null
          reason: string
          similarity: number
        }
        Insert: {
          chapter_id: string
          created_at?: string
          current_affairs_id: string
          id?: string
          read_at?: string | null
          reason: string
          similarity?: number
        }
        Update: {
          chapter_id?: string
          created_at?: string
          current_affairs_id?: string
          id?: string
          read_at?: string | null
          reason?: string
          similarity?: number
        }
        Relationships: [
          {
            foreignKeyName: "notifications_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_current_affairs_id_fkey"
            columns: ["current_affairs_id"]
            isOneToOne: false
            referencedRelation: "current_affairs"
            referencedColumns: ["id"]
          },
        ]
      }
      pyqs: {
        Row: {
          chapter_id: string | null
          correct_index: number | null
          created_at: string
          difficulty: string | null
          embedding: string | null
          explanation: string | null
          id: string
          options: Json
          question: string
          source: string
          subject: string
          topic: string | null
          year: number | null
        }
        Insert: {
          chapter_id?: string | null
          correct_index?: number | null
          created_at?: string
          difficulty?: string | null
          embedding?: string | null
          explanation?: string | null
          id?: string
          options?: Json
          question: string
          source?: string
          subject?: string
          topic?: string | null
          year?: number | null
        }
        Update: {
          chapter_id?: string | null
          correct_index?: number | null
          created_at?: string
          difficulty?: string | null
          embedding?: string | null
          explanation?: string | null
          id?: string
          options?: Json
          question?: string
          source?: string
          subject?: string
          topic?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pyqs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      question_results: {
        Row: {
          attempt_id: string
          correct: boolean
          correct_answer: number
          explanation: string | null
          id: string
          question: string
          user_answer: number | null
        }
        Insert: {
          attempt_id: string
          correct: boolean
          correct_answer: number
          explanation?: string | null
          id?: string
          question: string
          user_answer?: number | null
        }
        Update: {
          attempt_id?: string
          correct?: boolean
          correct_answer?: number
          explanation?: string | null
          id?: string
          question?: string
          user_answer?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "question_results_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          chapter_id: string
          id: string
          mode: string
          score: number
          taken_at: string
          total: number
        }
        Insert: {
          chapter_id: string
          id?: string
          mode?: string
          score: number
          taken_at?: string
          total: number
        }
        Update: {
          chapter_id?: string
          id?: string
          mode?: string
          score?: number
          taken_at?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      revision_schedule: {
        Row: {
          chapter_id: string
          created_at: string
          done_at: string | null
          due_at: string
          id: string
          stage: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          done_at?: string | null
          due_at: string
          id?: string
          stage: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          done_at?: string | null
          due_at?: string
          id?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_schedule_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_chapters_for_news: {
        Args: {
          match_threshold?: number
          max_chapters?: number
          query_embedding: string
        }
        Returns: {
          chapter_id: string
          similarity: number
        }[]
      }
      match_chunks: {
        Args: {
          match_count?: number
          official_only?: boolean
          query_embedding: string
        }
        Returns: {
          book_id: string
          book_title: string
          chapter_id: string
          chapter_slug: string
          chapter_title: string
          content: string
          heading: string
          id: string
          is_official: boolean
          page_end: number
          page_start: number
          similarity: number
        }[]
      }
      match_current_affairs: {
        Args: {
          filter_topic?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          id: string
          published_on: string
          similarity: number
          source: string
          summary: string
          title: string
          topic: string
        }[]
      }
      match_pyqs: {
        Args: {
          filter_subject?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          correct_index: number
          difficulty: string
          explanation: string
          id: string
          options: Json
          question: string
          similarity: number
          source: string
          topic: string
          year: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
