import { pgTable, text, timestamp, jsonb, integer, pgEnum, uuid, real } from "drizzle-orm/pg-core";

// Enums
export const taskStatusEnum = pgEnum("task_status", [
  "posted",
  "matched",
  "claimed",
  "in_progress",
  "submitted",
  "verified",
  "settled",
  "rejected",
  "escalated",
  "cancelled",
]);

export const claimStatusEnum = pgEnum("claim_status", [
  "active",
  "completed",
  "failed",
  "abandoned",
]);

// Agent Registry
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKey: text("api_key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  trustScore: real("trust_score").notNull().default(0.5),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  tasksFailed: integer("tasks_failed").notNull().default(0),
  tasksClaimed: integer("tasks_claimed").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tasks
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  posterId: uuid("poster_id").notNull().references(() => agents.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requiredCapabilities: jsonb("required_capabilities").$type<string[]>().notNull().default([]),
  acceptanceCriteria: jsonb("acceptance_criteria").$type<Record<string, unknown>>().default({}),
  constraints: jsonb("constraints").$type<{
    timeoutMinutes?: number;
    maxBudget?: number;
    priority?: "low" | "normal" | "high" | "urgent";
  }>().default({}),
  attachments: jsonb("attachments").$type<Array<{ name: string; url: string; type: string }>>().default([]),
  status: taskStatusEnum("status").notNull().default("posted"),
  result: jsonb("result").$type<Record<string, unknown>>(),
  resolvedById: uuid("resolved_by_id").references(() => agents.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  claimedAt: timestamp("claimed_at"),
  completedAt: timestamp("completed_at"),
});

// Claims (task assignments)
export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  status: claimStatusEnum("status").notNull().default("active"),
  note: text("note"),
  result: jsonb("result").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});
