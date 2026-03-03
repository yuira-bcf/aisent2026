import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// ---------------------------------------------------------------------------
// Creator Application status
// ---------------------------------------------------------------------------

export const applicationStatusEnum = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ApplicationStatus = (typeof applicationStatusEnum)[number];

// ---------------------------------------------------------------------------
// Creator Applications (クリエーター申請)
// ---------------------------------------------------------------------------

export const creatorApplications = pgTable('creator_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  creatorIdSlug: varchar('creator_id_slug', { length: 20 }).notNull(),
  bio: text('bio').notNull(),
  specialties: jsonb('specialties').notNull().$type<string[]>(),
  portfolioDescription: text('portfolio_description'),
  motivation: text('motivation').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('PENDING').$type<ApplicationStatus>(),
  rejectionReason: text('rejection_reason'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_creator_applications_user').on(table.userId),
  index('idx_creator_applications_status').on(table.status),
]);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const creatorApplicationsRelations = relations(creatorApplications, ({ one }) => ({
  user: one(users, { fields: [creatorApplications.userId], references: [users.id] }),
  reviewer: one(users, { fields: [creatorApplications.reviewedBy], references: [users.id] }),
}));
