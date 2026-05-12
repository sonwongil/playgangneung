import { pgTable, text } from "drizzle-orm/pg-core";

export const authTable = pgTable("auth_config", {
  id: text("id").primaryKey().default("main"),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
});
