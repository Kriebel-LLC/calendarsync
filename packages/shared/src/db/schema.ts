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

// Destination types enum
export enum DestinationType {
  GOOGLE_SHEETS = "google_sheets",
}

// Destinations - where calendar events are synced to
export const destinations = sqliteTable("destinations", {
  id: text("id", { length: 191 }).primaryKey().notNull(),
  orgId: text("org_id", { length: 191 }).notNull(),
  googleConnectionId: text("google_connection_id", { length: 191 }).notNull(),
  type: text("type", { enum: [DestinationType.GOOGLE_SHEETS] }).notNull(),
  name: text("name", { length: 191 }).notNull(),
  // Google Sheets specific config
  spreadsheetId: text("spreadsheet_id", { length: 191 }),
  spreadsheetName: text("spreadsheet_name", { length: 191 }),
  sheetId: integer("sheet_id"),
  sheetName: text("sheet_name", { length: 191 }),
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

// Sync configurations - links calendars to destinations
export const syncConfigs = sqliteTable(
  "sync_configs",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    orgId: text("org_id", { length: 191 }).notNull(),
    calendarId: text("calendar_id", { length: 191 }).notNull(),
    destinationId: text("destination_id", { length: 191 }).notNull(),
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
    syncConfigId: text("sync_config_id", { length: 191 }).notNull(),
    googleEventId: text("google_event_id", { length: 191 }).notNull(),
    // Row number in the spreadsheet for updates
    sheetRowNumber: integer("sheet_row_number"),
    // Event data for comparison to detect changes
    eventHash: text("event_hash", { length: 64 }), // SHA-256 hash of event data
    status: text("status", { enum: [SyncedEventStatus.ACTIVE, SyncedEventStatus.CANCELLED] })
      .default(SyncedEventStatus.ACTIVE)
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
      syncEventKey: uniqueIndex("synced_events_sync_event_key").on(
        table.syncConfigId,
        table.googleEventId
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
export type Destination = InferSelectModel<typeof destinations>;
export type Calendar = InferSelectModel<typeof calendars>;
export type SyncConfig = InferSelectModel<typeof syncConfigs>;
export type SyncedEvent = InferSelectModel<typeof syncedEvents>;
