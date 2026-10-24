import {
  doublePrecision,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const reportsTable = pgTable("emergency_reports", {
  id: serial("id").primaryKey(),
  trackingCode: varchar("tracking_code", { length: 32 }).notNull().unique(),
  incidentType: text("incident_type").notNull(),
  description: text("description").notNull(),
  locationText: varchar("location_text", { length: 300 }).notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  urgency: text("urgency").notNull(),
  status: text("status").notNull().default("received"),
  contactName: varchar("contact_name", { length: 100 }),
  contactPhone: varchar("contact_phone", { length: 30 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
