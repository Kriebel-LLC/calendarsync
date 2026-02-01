/**
 * Notion OAuth utilities for CalendarSync destination sync.
 * Handles OAuth flow and token management.
 */

import { env } from "@/web-env";

const NOTION_OAUTH_URL = "https://api.notion.com/v1/oauth/authorize";
const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";
const NOTION_API_VERSION = "2022-06-28";

export interface NotionTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name?: string;
  workspace_icon?: string;
  owner?: {
    type: string;
    user?: {
      id: string;
      name?: string;
      avatar_url?: string;
      type: string;
      person?: {
        email: string;
      };
    };
  };
  duplicated_template_id?: string;
}

export interface NotionOAuthState {
  userId: string;
  timestamp: number;
  nonce: string;
}

/**
 * Generates the Notion OAuth authorization URL.
 */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.NOTION_CLIENT_ID,
    redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/destinations/notion/callback`,
    response_type: "code",
    owner: "user",
    state,
  });

  return `${NOTION_OAUTH_URL}?${params.toString()}`;
}

/**
 * Exchanges an authorization code for access tokens.
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<NotionTokenResponse> {
  const credentials = Buffer.from(
    `${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(NOTION_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
      "Notion-Version": NOTION_API_VERSION,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/destinations/notion/callback`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

/**
 * Generates a secure state parameter for OAuth.
 */
export function generateOAuthState(userId: string): string {
  const state: NotionOAuthState = {
    userId,
    timestamp: Date.now(),
    nonce: crypto.randomUUID(),
  };
  return Buffer.from(JSON.stringify(state)).toString("base64");
}

/**
 * Validates and parses the OAuth state parameter.
 * Returns null if invalid or expired (10 minute timeout).
 */
export function validateOAuthState(
  state: string,
  expectedUserId: string
): NotionOAuthState | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64").toString("utf-8")
    ) as NotionOAuthState;

    // Check user ID matches
    if (decoded.userId !== expectedUserId) {
      return null;
    }

    // Check timestamp (10 minute expiry)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    if (decoded.timestamp < tenMinutesAgo) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}
