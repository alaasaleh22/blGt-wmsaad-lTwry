import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

type InterviewEvaluation = {
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
};

export const interviewSessionsTable = pgTable("interview_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleTitle: varchar("role_title", { length: 120 }).notNull(),
  track: text("track").notNull(),
  experienceLevel: text("experience_level").notNull(),
  language: text("language").notNull(),
  mode: text("mode").notNull(),
  questionCount: integer("question_count").notNull(),
  status: text("status").notNull().default("active"),
  currentQuestion: text("current_question"),
  turnNumber: integer("turn_number").notNull().default(1),
  evaluation: jsonb("evaluation").$type<InterviewEvaluation | null>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type InterviewSession = typeof interviewSessionsTable.$inferSelect;

export const interviewTurnsTable = pgTable(
  "interview_turns",
  {
    id: serial("id").primaryKey(),
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interviewSessionsTable.id, { onDelete: "cascade" }),
    questionNumber: integer("question_number").notNull(),
    question: text("question").notNull(),
    answer: text("answer"),
    score: integer("score"),
    feedback: text("feedback"),
    strengths: jsonb("strengths").$type<string[]>().notNull().default([]),
    improvements: jsonb("improvements")
      .$type<string[]>()
      .notNull()
      .default([]),
    voiceReply: text("voice_reply"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("interview_turns_session_question_idx").on(
      table.interviewId,
      table.questionNumber,
    ),
  ],
);

export type InterviewTurn = typeof interviewTurnsTable.$inferSelect;
