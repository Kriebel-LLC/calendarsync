import { env } from "@/web-env";
import { GoogleServiceAccountCredential } from "shared/src/google-auth";
import { authConfig } from "./auth";

// Documentation on this API here: https://cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/sendOobCode
export async function getEmailAuthLink(
  email: string,
  continueUrl: string
): Promise<string> {
  const credential = new GoogleServiceAccountCredential(
    authConfig.serviceAccount
  );
  const firebaseAccessToken = await credential.getAccessToken(false);

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/accounts:sendOobCode`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firebaseAccessToken.accessToken}`,
      },
      body: JSON.stringify({
        requestType: "EMAIL_SIGNIN",
        email,
        returnOobLink: true,
        continueUrl,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Creating email link failed"); // TODO: make this based on the response
  }

  const json: { oobLink: string } = await response.json();

  return json.oobLink;
}
