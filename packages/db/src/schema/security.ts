import { pgTable, uuid, varchar, text, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// ---------------------------------------------------------------------------
// 監査ログ アクション種別
// ---------------------------------------------------------------------------

export const auditActionEnum = [
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'ROLE_CHANGE',
  'ORDER_STATUS_CHANGE',
  'PAYMENT',
  'ADMIN_ACTION',
  'PASSWORD_RESET',
  'PASSWORD_RESET_REQUEST',
  'RECIPE_PUBLISH',
  'RECIPE_UNPUBLISH',
  'ACCOUNT_CREATE',
  'ACCOUNT_DELETE',
] as const;
export type AuditAction = (typeof auditActionEnum)[number];

// ---------------------------------------------------------------------------
// パスワードリセットトークン
// ---------------------------------------------------------------------------

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_password_reset_tokens_user_id').on(table.userId),
  index('idx_password_reset_tokens_expires_at').on(table.expiresAt),
]);

// ---------------------------------------------------------------------------
// 監査ログ
// ---------------------------------------------------------------------------

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 50 }).notNull().$type<AuditAction>(),
  resource: varchar('resource', { length: 50 }).notNull(),
  resourceId: uuid('resource_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_audit_logs_user_id').on(table.userId),
  index('idx_audit_logs_action').on(table.action),
  index('idx_audit_logs_created_at').on(table.createdAt),
  index('idx_audit_logs_resource').on(table.resource),
]);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// 型エクスポート
// ---------------------------------------------------------------------------

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
