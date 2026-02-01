import { UserDetail } from "../types";
import { DestinationType } from "../types/destination";
import { Plan } from "../types/plan";
import { Role } from "../types/role";
import { SyncStatus } from "../types/sync-status";
import { InferSelectModel, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    stripeCustomerId: text("stripe_customer_id", { length: 191 }),
    stripeSubscriptionId: text("stripe_subscription_id", { length: 191 }),
    stripePriceId: text("stripe_price_id", { length: 191 }),
    stripeCurrentPeriodEnd: integer("stripe_current_period_end", {
      mode: "timestamp_ms",
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    createdAt: integer("created_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer("updated_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return {
      stripeCustomerIdKey: uniqueIndex("users_stripe_customer_id_key").on(
        table.stripeCustomerId
      ),
      stripeSubscriptionIdKey: uniqueIndex(
        "users_stripe_subscription_id_key"
      ).on(table.stripeSubscriptionId),
    };
  }
);

export const orgs = sqliteTable(
  "orgs",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    name: text("name", { length: 191 }).notNull(),
    plan: text("plan", { enum: [Plan.FREE, Plan.PAID] })
      .default(Plan.FREE)
      .notNull(),
    stripeCustomerId: text("stripe_customer_id", { length: 191 }),
    createdAt: integer("created_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer("updated_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return {
      stripeCustomerIdKey: uniqueIndex("orgs_stripe_customer_id_key").on(
        table.stripeCustomerId
      ),
      nameIdKey: uniqueIndex("orgs_name_id_key").on(table.name),
    };
  }
);

const rolesEnum = text("role", { enum: [Role.READ, Role.WRITE, Role.ADMIN] });

export const orgInvites = sqliteTable(
  "org_invites",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    email: text("email", { length: 191 }).notNull(),
    token: text("token", { length: 191 }).notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
    senderUserId: text("sender_user_id", { length: 191 }).notNull(),
    orgId: text("org_id", { length: 191 }).notNull(),
    role: rolesEnum.default(Role.READ).notNull(),
    createdAt: integer("created_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer("updated_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return {
      tokenIdKey: uniqueIndex("token_org_invites_id_key").on(table.token),
    };
  }
);

export const orgUsers = sqliteTable("org_users", {
  id: text("id", { length: 191 }).primaryKey().notNull(),
  role: rolesEnum.default(Role.READ).notNull(),
  orgId: text("org_id", { length: 191 }).notNull(),
  userId: text("user_id", { length: 191 }).notNull(),
  createdAt: integer("created_at", {
    mode: "timestamp",
  })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updated_at", {
    mode: "timestamp",
  })
    .default(sql`(unixepoch())`)
    .notNull()
    .$onUpdate(() => new Date()),
});

export type User = InferSelectModel<typeof users>;
export type Org = InferSelectModel<typeof orgs>;
export type OrgInvite = InferSelectModel<typeof orgInvites>;
export type OrgUser = InferSelectModel<typeof orgUsers>;
export type OrgUserWithDetail = OrgUser & UserDetail;

// ============================================================================
// CalendarSync Tables
// ============================================================================

/**
 * Stores Google OAuth tokens for calendar access.
 * Each user can have multiple calendar connections (e.g., personal + work accounts).
 */
export const calendarConnections = sqliteTable(
  "calendar_connections",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    userId: text("user_id", { length: 191 }).notNull(),
    // Google account email for identification
    googleEmail: text("google_email", { length: 191 }).notNull(),
    // OAuth tokens (encrypted at rest in production)
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    tokenExpiresAt: integer("token_expires_at", { mode: "timestamp" }).notNull(),
    // Optional: specific calendar IDs to sync (JSON array), null means all calendars
    selectedCalendarIds: text("selected_calendar_ids"),
    createdAt: integer("created_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer("updated_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return {
      userIdIdx: index("calendar_connections_user_id_idx").on(table.userId),
      userEmailKey: uniqueIndex("calendar_connections_user_email_key").on(
        table.userId,
        table.googleEmail
      ),
    };
  }
);

/**
 * Stores destination configurations for where calendar events are synced to.
 * Supports Google Sheets, Notion, and Airtable.
 */
export const destinations = sqliteTable(
  "destinations",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    userId: text("user_id", { length: 191 }).notNull(),
    name: text("name", { length: 191 }).notNull(),
    type: text("type", {
      enum: [
        DestinationType.GOOGLE_SHEETS,
        DestinationType.NOTION,
        DestinationType.AIRTABLE,
      ],
    }).notNull(),
    // Destination-specific configuration stored as JSON
    // Google Sheets: { spreadsheetId, sheetName }
    // Notion: { databaseId, accessToken }
    // Airtable: { baseId, tableId, apiKey }
    config: text("config").notNull(),
    createdAt: integer("created_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer("updated_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return {
      userIdIdx: index("destinations_user_id_idx").on(table.userId),
    };
  }
);

/**
 * Defines a sync configuration that maps a calendar connection to a destination.
 * Contains mapping rules and filters for what/how to sync.
 */
export const syncConfigs = sqliteTable(
  "sync_configs",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    userId: text("user_id", { length: 191 }).notNull(),
    calendarConnectionId: text("calendar_connection_id", {
      length: 191,
    }).notNull(),
    destinationId: text("destination_id", { length: 191 }).notNull(),
    // Human-readable name for this sync configuration
    name: text("name", { length: 191 }).notNull(),
    // Whether this sync is active
    enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
    // Field mapping configuration (JSON)
    // e.g., { "summary": "A", "start": "B", "end": "C", "description": "D" }
    fieldMapping: text("field_mapping").notNull(),
    // Optional filters (JSON)
    // e.g., { "excludeAllDay": true, "includeKeywords": ["meeting"], "excludeKeywords": ["personal"] }
    filters: text("filters"),
    // Sync frequency in minutes (0 = manual only)
    syncIntervalMinutes: integer("sync_interval_minutes").default(60).notNull(),
    // How far back to sync events (days)
    lookbackDays: integer("lookback_days").default(7).notNull(),
    // How far ahead to sync events (days)
    lookaheadDays: integer("lookahead_days").default(30).notNull(),
    createdAt: integer("created_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
      .notNull(),
    updatedAt: integer("updated_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return {
      userIdIdx: index("sync_configs_user_id_idx").on(table.userId),
      calendarConnectionIdIdx: index("sync_configs_calendar_connection_id_idx").on(
        table.calendarConnectionId
      ),
      destinationIdIdx: index("sync_configs_destination_id_idx").on(
        table.destinationId
      ),
    };
  }
);

/**
 * Records the history of sync operations for tracking and debugging.
 */
export const syncHistory = sqliteTable(
  "sync_history",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    syncConfigId: text("sync_config_id", { length: 191 }).notNull(),
    // Sync operation status
    status: text("status", {
      enum: [SyncStatus.SUCCESS, SyncStatus.FAILED, SyncStatus.PARTIAL],
    }).notNull(),
    // Number of events processed
    eventsProcessed: integer("events_processed").default(0).notNull(),
    // Number of events created in destination
    eventsCreated: integer("events_created").default(0).notNull(),
    // Number of events updated in destination
    eventsUpdated: integer("events_updated").default(0).notNull(),
    // Number of events deleted from destination
    eventsDeleted: integer("events_deleted").default(0).notNull(),
    // Error message if status is 'failed' or 'partial'
    errorMessage: text("error_message"),
    // When the sync started
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    // When the sync completed
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
      .notNull(),
  },
  (table) => {
    return {
      syncConfigIdIdx: index("sync_history_sync_config_id_idx").on(
        table.syncConfigId
      ),
      startedAtIdx: index("sync_history_started_at_idx").on(table.startedAt),
    };
  }
);

// CalendarSync Types
export type CalendarConnection = InferSelectModel<typeof calendarConnections>;
export type Destination = InferSelectModel<typeof destinations>;
export type SyncConfig = InferSelectModel<typeof syncConfigs>;
export type SyncHistory = InferSelectModel<typeof syncHistory>;
