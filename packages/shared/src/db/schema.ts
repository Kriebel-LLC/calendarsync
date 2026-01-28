import { UserDetail } from "../types";
import { Plan } from "../types/plan";
import { Role } from "../types/role";
import { InferSelectModel, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Sync-related enums
export enum SyncStatus {
  ACTIVE = "active",
  PAUSED = "paused",
  ERROR = "error",
}

export enum DestinationType {
  GOOGLE_SHEETS = "google_sheets",
  NOTION = "notion",
}

export enum SyncFrequency {
  EVERY_15_MINUTES = "every_15_minutes",
  HOURLY = "hourly",
  DAILY = "daily",
}

export enum SyncRunStatus {
  PENDING = "pending",
  RUNNING = "running",
  SUCCESS = "success",
  FAILED = "failed",
}

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

// OAuth credentials for Google Calendar and destination APIs
export const oauthCredentials = sqliteTable(
  "oauth_credentials",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    userId: text("user_id", { length: 191 }).notNull(),
    provider: text("provider", {
      enum: ["google"],
    }).notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    scope: text("scope"),
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
      userProviderIdx: uniqueIndex("oauth_credentials_user_provider_idx").on(
        table.userId,
        table.provider
      ),
    };
  }
);

// Sync configuration - defines what calendar to sync and where
export const syncConfigs = sqliteTable(
  "sync_configs",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    userId: text("user_id", { length: 191 }).notNull(),
    name: text("name", { length: 191 }).notNull(),
    // Source - Google Calendar
    calendarId: text("calendar_id", { length: 191 }).notNull(),
    calendarName: text("calendar_name", { length: 191 }),
    // Destination
    destinationType: text("destination_type", {
      enum: [DestinationType.GOOGLE_SHEETS, DestinationType.NOTION],
    }).notNull(),
    destinationId: text("destination_id", { length: 191 }).notNull(), // Spreadsheet ID or Notion database ID
    destinationName: text("destination_name", { length: 191 }),
    // Sync settings
    syncFrequency: text("sync_frequency", {
      enum: [
        SyncFrequency.EVERY_15_MINUTES,
        SyncFrequency.HOURLY,
        SyncFrequency.DAILY,
      ],
    })
      .default(SyncFrequency.DAILY)
      .notNull(),
    status: text("status", {
      enum: [SyncStatus.ACTIVE, SyncStatus.PAUSED, SyncStatus.ERROR],
    })
      .default(SyncStatus.ACTIVE)
      .notNull(),
    // Google Calendar sync token for incremental updates
    syncToken: text("sync_token"),
    // Scheduling
    nextSyncAt: integer("next_sync_at", { mode: "timestamp" }),
    lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
    lastErrorMessage: text("last_error_message"),
    // Timestamps
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
      nextSyncAtIdx: index("sync_configs_next_sync_at_idx").on(table.nextSyncAt),
      statusIdx: index("sync_configs_status_idx").on(table.status),
    };
  }
);

// Sync history - tracks each sync run
export const syncHistory = sqliteTable(
  "sync_history",
  {
    id: text("id", { length: 191 }).primaryKey().notNull(),
    syncConfigId: text("sync_config_id", { length: 191 }).notNull(),
    status: text("status", {
      enum: [
        SyncRunStatus.PENDING,
        SyncRunStatus.RUNNING,
        SyncRunStatus.SUCCESS,
        SyncRunStatus.FAILED,
      ],
    })
      .default(SyncRunStatus.PENDING)
      .notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    eventsProcessed: integer("events_processed").default(0),
    eventsCreated: integer("events_created").default(0),
    eventsUpdated: integer("events_updated").default(0),
    eventsDeleted: integer("events_deleted").default(0),
    errorMessage: text("error_message"),
    // Timestamps
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
      statusIdx: index("sync_history_status_idx").on(table.status),
    };
  }
);

export type User = InferSelectModel<typeof users>;
export type Org = InferSelectModel<typeof orgs>;
export type OrgInvite = InferSelectModel<typeof orgInvites>;
export type OrgUser = InferSelectModel<typeof orgUsers>;
export type OrgUserWithDetail = OrgUser & UserDetail;
export type OAuthCredential = InferSelectModel<typeof oauthCredentials>;
export type SyncConfig = InferSelectModel<typeof syncConfigs>;
export type SyncHistoryEntry = InferSelectModel<typeof syncHistory>;
