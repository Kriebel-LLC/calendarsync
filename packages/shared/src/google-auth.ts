import { SignJWT, importPKCS8 } from "jose";

const GOOGLE_TOKEN_AUDIENCE = "https://accounts.google.com/o/oauth2/token";
const GOOGLE_AUTH_TOKEN_HOST = "accounts.google.com";
const GOOGLE_AUTH_TOKEN_PATH = "/o/oauth2/token";
const ONE_HOUR_IN_SECONDS = 60 * 60;
const TOKEN_EXPIRY_THRESHOLD_MILLIS = 5 * 60 * 1000;
const ALGORITHM_RS256 = "RS256";

interface ServiceAccount {
  privateKey: string;
  clientEmail: string;
}

interface AccessToken {
  accessToken: string;
  expirationTime: number;
}

interface GoogleOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

interface GoogleOAuthErrorResponse {
  error: {
    code?: number;
    message?: string;
    status?: string;
  };
}

class AuthError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}

// Simple in-memory cache for access tokens
const accessTokenCache = new Map<string, AccessToken>();

export class GoogleServiceAccountCredential {
  private privateKey: string;
  private clientEmail: string;

  constructor(serviceAccount: ServiceAccount) {
    this.privateKey = serviceAccount.privateKey;
    this.clientEmail = serviceAccount.clientEmail;
  }

  private async createJwt(): Promise<string> {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + ONE_HOUR_IN_SECONDS;

    let key;
    try {
      key = await importPKCS8(this.privateKey, ALGORITHM_RS256);
    } catch (e) {
      throw new AuthError(
        "It looks like the value provided for `serviceAccount.privateKey` is incorrectly formatted. " +
          "Please double-check if private key has correct format.",
        "auth/invalid-credential"
      );
    }

    const jwt = await new SignJWT({
      scope: [
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/firebase.database",
        "https://www.googleapis.com/auth/firebase.messaging",
        "https://www.googleapis.com/auth/identitytoolkit",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" "),
    })
      .setProtectedHeader({ alg: ALGORITHM_RS256 })
      .setIssuer(this.clientEmail)
      .setSubject(this.clientEmail)
      .setAudience(GOOGLE_TOKEN_AUDIENCE)
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(key);

    return jwt;
  }

  private async fetchAccessToken(url: string): Promise<AccessToken> {
    const jwt = await this.createJwt();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({
        error: { message: response.statusText },
      }))) as GoogleOAuthErrorResponse;
      throw new AuthError(
        `Failed to fetch access token: ${
          error.error?.message || response.statusText
        }`,
        "auth/invalid-credential"
      );
    }

    const data = (await response.json()) as GoogleOAuthTokenResponse;
    if (!data.access_token || !data.expires_in) {
      throw new AuthError(
        `Unexpected response while fetching access token: ${JSON.stringify(
          data
        )}`,
        "auth/invalid-credential"
      );
    }

    return {
      accessToken: data.access_token,
      expirationTime: Date.now() + data.expires_in * 1000,
    };
  }

  private async fetchAndCacheAccessToken(url: string): Promise<AccessToken> {
    const response = await this.fetchAccessToken(url);
    accessTokenCache.set(url, response);
    return response;
  }

  async getAccessToken(forceRefresh = false): Promise<AccessToken> {
    const url = `https://${GOOGLE_AUTH_TOKEN_HOST}${GOOGLE_AUTH_TOKEN_PATH}`;

    if (forceRefresh) {
      return this.fetchAndCacheAccessToken(url);
    }

    const cachedToken = accessTokenCache.get(url);
    if (
      !cachedToken ||
      cachedToken.expirationTime - Date.now() <= TOKEN_EXPIRY_THRESHOLD_MILLIS
    ) {
      return this.fetchAndCacheAccessToken(url);
    }

    return cachedToken;
  }
}
