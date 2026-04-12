export interface Student {
  id: number;
  name: string;
  age?: number;
  current_level?: string;
  final_goal?: string;
  future_concepts?: string;
  notes?: string | null;
  account_id?: number | null;
  current_class?: number | null;
  step?: number;
  classes_used?: number;
  classes_paid?: number;
}

export interface StudentClass {
  class_id: number;
  student_id: number;
  status: "current" | "completed" | "upcoming";
  name: string;
  class_type?: string | null;
  class_date?: string | null;
  accomplished?: string | null;
  methods: string;
  stretch_methods?: string | null;
  description?: string | null;
  classwork?: string | null;
  notes?: string | null;
  hw?: string | null;
  hw_notes?: string | null;
  classwork_submission?: string | null;
  homework_submission?: string | null;
  taught_methods?: string | null;
  needs_practice?: string | null;
}

export type ClassType = "traditional" | "experimental" | "self_directed";
export type ClassStatus = "current" | "completed" | "upcoming";

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  response_format?: ResponseFormat;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ResponseFormat {
  type: "json_object";
}

export interface ChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface GeneratedClasswork {
  classwork: string;
  homework: string;
  notes: string;
}

export type CliAction = "list" | "continue" | "new" | "exit";
export type ClassAction = "classwork" | "generate" | "new" | "skip";