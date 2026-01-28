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
