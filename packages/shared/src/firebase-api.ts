import { authConfig } from "./auth";
import { GoogleServiceAccountCredential } from "shared/src/google-auth";
import type { Env, UserDetail } from "shared/src/types";

type FirebaseApiUser = {
  localId: string;
  email: string;
  displayName: string;
  photoUrl: string;
};

export async function getUserDetails(
  env: Env,
  userIds: string[]
): Promise<{ [userId: string]: UserDetail }> {
  const credential = new GoogleServiceAccountCredential(
    authConfig(env).serviceAccount
  );
  const firebaseAccessToken = await credential.getAccessToken(false);

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/accounts:lookup`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firebaseAccessToken.accessToken}`,
      },
      body: JSON.stringify({
        localId: userIds,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Fetching users failed"); // TODO: make this based on the response
  }

  const json: {
    users: FirebaseApiUser[];
  } = await response.json();
  if (!json?.users || json.users.length <= 0) {
    return {};
  }

  return json.users.reduce((acc: Record<string, UserDetail>, user) => {
    acc[user.localId] = {
      userId: user.localId,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
    };
    return acc;
  }, {});
}
