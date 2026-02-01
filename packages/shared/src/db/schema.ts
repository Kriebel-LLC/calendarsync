import { UserDetail } from "../types";
import { Plan } from "../types/plan";
import { Role } from "../types/role";
import { InferSelectModel, sql } from "drizzle-orm";
import {
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
    plan: text("plan", { enum: [Plan.FREE, Plan.PRO] })
      .default(Plan.FREE)
      .notNull(),
    stripeCustomerId: text("stripe_customer_id", { length: 191 }),
    stripeSubscriptionId: text("stripe_subscription_id", { length: 191 }),
    stripeCurrentPeriodEnd: integer("stripe_current_period_end", {
      mode: "timestamp",
    }),
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
      stripeSubscriptionIdKey: uniqueIndex(
        "orgs_stripe_subscription_id_key"
      ).on(table.stripeSubscriptionId),
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

// Google OAuth connections - stores OAuth tokens for Google APIs
export const googleConnections = sqliteTable(
  "google_connections",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    orgId: text("org_id", { length: 191 }).notNull(),
    email: text("email", { length: 191 }).notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    scopes: text("scopes").notNull(), // JSON array of granted scopes
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
      orgEmailKey: uniqueIndex("google_connections_org_email_key").on(
        table.orgId,
        table.email
      ),
    };
  }
);

// Notion OAuth connections for destination sync
export const notionConnections = sqliteTable(
  "notion_connections",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    userId: text("user_id", { length: 191 }).notNull(),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    workspaceId: text("workspace_id", { length: 191 }),
    workspaceName: text("workspace_name", { length: 191 }),
    workspaceIcon: text("workspace_icon"),
    botId: text("bot_id", { length: 191 }),
    // Selected database for syncing calendar events
    selectedDatabaseId: text("selected_database_id", { length: 191 }),
    selectedDatabaseName: text("selected_database_name", { length: 191 }),
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
      userIdKey: uniqueIndex("notion_connections_user_id_key").on(table.userId),
    };
  }
);

// Airtable OAuth connections
export const airtableConnections = sqliteTable(
  "airtable_connections",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    orgId: text("org_id", { length: 191 }).notNull(),
    airtableUserId: text("airtable_user_id", { length: 191 }).notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    refreshExpiresAt: integer("refresh_expires_at", {
      mode: "timestamp",
    }).notNull(),
    scopes: text("scopes").notNull(), // JSON array of granted scopes
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
      orgUserIdKey: uniqueIndex("airtable_connections_org_user_id_key").on(
        table.orgId,
        table.airtableUserId
      ),
    };
  }
);

// Destination types enum
export enum DestinationType {
  GOOGLE_SHEETS = "google_sheets",
  NOTION = "notion",
  AIRTABLE = "airtable",
}

// Destinations - where calendar events are synced to
export const destinations = sqliteTable("destinations", {
  id: text("id", { length: 191 }).primaryKey().notNull(),
  orgId: text("org_id", { length: 191 }).notNull(),
  // For Google destinations
  googleConnectionId: text("google_connection_id", { length: 191 }),
  // For Notion destinations
  notionConnectionId: text("notion_connection_id", { length: 191 }),
  // For Airtable destinations
  airtableConnectionId: text("airtable_connection_id", { length: 191 }),
  type: text("type", {
    enum: [
      DestinationType.GOOGLE_SHEETS,
      DestinationType.NOTION,
      DestinationType.AIRTABLE,
    ],
  }).notNull(),
  name: text("name", { length: 191 }).notNull(),
  // Google Sheets specific config
  spreadsheetId: text("spreadsheet_id", { length: 191 }),
  spreadsheetName: text("spreadsheet_name", { length: 191 }),
  sheetId: integer("sheet_id"),
  sheetName: text("sheet_name", { length: 191 }),
  // Notion specific config
  notionDatabaseId: text("notion_database_id", { length: 191 }),
  notionDatabaseName: text("notion_database_name", { length: 191 }),
  // Airtable specific config
  airtableBaseId: text("airtable_base_id", { length: 191 }),
  airtableBaseName: text("airtable_base_name", { length: 191 }),
  airtableTableId: text("airtable_table_id", { length: 191 }),
  airtableTableName: text("airtable_table_name", { length: 191 }),
  isEnabled: integer("is_enabled", { mode: "boolean" }).default(true).notNull(),
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

// Calendars - Google Calendar sources
export const calendars = sqliteTable("calendars", {
  id: text("id", { length: 191 }).primaryKey().notNull(),
  orgId: text("org_id", { length: 191 }).notNull(),
  googleConnectionId: text("google_connection_id", { length: 191 }).notNull(),
  googleCalendarId: text("google_calendar_id", { length: 191 }).notNull(),
  name: text("name", { length: 191 }).notNull(),
  color: text("color", { length: 7 }), // hex color
  isEnabled: integer("is_enabled", { mode: "boolean" }).default(true).notNull(),
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

// Sync interval enum values (in minutes)
export enum SyncInterval {
  FIFTEEN_MINUTES = 15,
  HOURLY = 60,
  DAILY = 1440,
}

// Sync configurations - links calendars to destinations
export const syncConfigs = sqliteTable(
  "sync_configs",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    orgId: text("org_id", { length: 191 }).notNull(),
    calendarId: text("calendar_id", { length: 191 }).notNull(),
    destinationId: text("destination_id", { length: 191 }).notNull(),
    // Sync frequency in minutes (15, 60, or 1440 for daily)
    syncIntervalMinutes: integer("sync_interval_minutes")
      .default(SyncInterval.HOURLY)
      .notNull(),
    // Column mapping configuration (JSON string)
    // Maps calendar fields to destination columns, e.g. {"title": "A", "start": "B", "end": "C"}
    columnMapping: text("column_mapping"),
    // Filter configuration (JSON string)
    // e.g. {"timeRangeStart": "2024-01-01", "timeRangeEnd": "2024-12-31", "keywords": ["meeting", "call"]}
    filterConfig: text("filter_config"),
    // Incremental sync token from Google Calendar API
    syncToken: text("sync_token"),
    lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
    isEnabled: integer("is_enabled", { mode: "boolean" }).default(true).notNull(),
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
      calDestKey: uniqueIndex("sync_configs_cal_dest_key").on(
        table.calendarId,
        table.destinationId
      ),
    };
  }
);

// Event status enum
export enum SyncedEventStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
}

// Synced events - tracks events that have been synced for smart updates/deletes
export const syncedEvents = sqliteTable(
  "synced_events",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    syncConfigId: text("sync_config_id", { length: 191 }),
    userId: text("user_id", { length: 191 }),
    // External event ID from the calendar source (e.g., Google Calendar event ID)
    externalEventId: text("external_event_id", { length: 191 }).notNull(),
    // For Google Sheets: row number in the spreadsheet
    sheetRowNumber: integer("sheet_row_number"),
    // For Notion: page ID where this event was synced
    notionPageId: text("notion_page_id", { length: 191 }),
    // For Airtable: record ID
    airtableRecordId: text("airtable_record_id", { length: 191 }),
    // Calendar source info
    calendarId: text("calendar_id", { length: 191 }),
    calendarName: text("calendar_name", { length: 191 }),
    // Event details (cached for comparison during sync)
    eventTitle: text("event_title"),
    eventStart: integer("event_start", { mode: "timestamp" }),
    eventEnd: integer("event_end", { mode: "timestamp" }),
    // Event data hash for change detection
    eventHash: text("event_hash", { length: 64 }), // SHA-256 hash of event data
    status: text("status", {
      enum: [SyncedEventStatus.ACTIVE, SyncedEventStatus.CANCELLED],
    })
      .default(SyncedEventStatus.ACTIVE)
      .notNull(),
    // Sync metadata
    lastSyncedAt: integer("last_synced_at", {
      mode: "timestamp",
    })
      .default(sql`(unixepoch())`)
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
      // For Google Sheets/Airtable sync config lookups
      syncEventKey: uniqueIndex("synced_events_sync_event_key").on(
        table.syncConfigId,
        table.externalEventId
      ),
      // For Notion user event lookups
      userEventKey: uniqueIndex("synced_events_user_event_key").on(
        table.userId,
        table.externalEventId
      ),
      // Index for looking up by Notion page ID
      notionPageIdIdx: uniqueIndex("synced_events_notion_page_id_idx").on(
        table.notionPageId
      ),
    };
  }
);

export type User = InferSelectModel<typeof users>;
export type Org = InferSelectModel<typeof orgs>;
export type OrgInvite = InferSelectModel<typeof orgInvites>;
export type OrgUser = InferSelectModel<typeof orgUsers>;
export type OrgUserWithDetail = OrgUser & UserDetail;
export type GoogleConnection = InferSelectModel<typeof googleConnections>;
export type NotionConnection = InferSelectModel<typeof notionConnections>;
export type AirtableConnection = InferSelectModel<typeof airtableConnections>;
export type Destination = InferSelectModel<typeof destinations>;
export type Calendar = InferSelectModel<typeof calendars>;
export type SyncConfig = InferSelectModel<typeof syncConfigs>;
export type SyncedEvent = InferSelectModel<typeof syncedEvents>;
