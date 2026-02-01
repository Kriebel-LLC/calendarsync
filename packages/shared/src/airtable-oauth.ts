// Airtable OAuth 2.0 with PKCE support
// Airtable OAuth uses authorization code flow with PKCE (Proof Key for Code Exchange)

export const AIRTABLE_OAUTH_SCOPES = [
  "data.records:read",
  "data.records:write",
  "schema.bases:read",
  "schema.bases:write",
] as const;

export interface AirtableOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface AirtableTokenResponse {
  access_token: string;
  expires_in: number; // seconds
  refresh_token: string;
  refresh_expires_in: number; // seconds (60 days by default)
  token_type: "Bearer";
  scope: string;
}

export interface AirtableUserInfo {
  id: string;
  email?: string;
}

// Generate a code verifier for PKCE (43-128 characters)
export function generateCodeVerifier(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const length = 64;
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

// Generate code challenge from verifier (S256 method)
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  // Base64 URL encode
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function buildAirtableOAuthUrl(
  config: AirtableOAuthConfig,
  state: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: AIRTABLE_OAUTH_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `https://airtable.com/oauth2/v1/authorize?${params.toString()}`;
}

export async function exchangeAirtableCodeForTokens(
  config: AirtableOAuthConfig,
  code: string,
  codeVerifier: string
): Promise<AirtableTokenResponse> {
  // Airtable uses Basic auth with client_id:client_secret for confidential clients
  const credentials = btoa(`${config.clientId}:${config.clientSecret}`);

  const response = await fetch("https://airtable.com/oauth2/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

export async function refreshAirtableAccessToken(
  config: AirtableOAuthConfig,
  refreshToken: string
): Promise<AirtableTokenResponse> {
  const credentials = btoa(`${config.clientId}:${config.clientSecret}`);

  const response = await fetch("https://airtable.com/oauth2/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh access token: ${error}`);
  }

  return response.json();
}

export async function getAirtableUserInfo(accessToken: string): Promise<AirtableUserInfo> {
  const response = await fetch("https://api.airtable.com/v0/meta/whoami", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get user info from Airtable");
  }

  return response.json();
}

export async function revokeAirtableToken(
  config: AirtableOAuthConfig,
  token: string
): Promise<void> {
  const credentials = btoa(`${config.clientId}:${config.clientSecret}`);

  await fetch("https://airtable.com/oauth2/v1/revoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      token,
    }),
  });
}
