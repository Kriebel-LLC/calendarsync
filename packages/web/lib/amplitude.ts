import { env } from "@/web-env";
import { nanoid } from "nanoid";
import { Environment } from "shared/src/environment";

const ampDeviceIdCookieKey = "AMP_device_id";
const amplitudeAPIKey = "f934d7ec33f9b8736f2e650814e94d6c";
const shouldTrack = env.NEXT_PUBLIC_ENVIRONMENT === Environment.Production;

type AmplitudeProperties = {
  [key: string]: string | boolean | number | null | undefined;
};

export enum EventNames {
  SIGN_IN = "Sign In",
  SIGN_UP = "Sign Up",

  PAGE_VIEWED = "Page Viewed",
  SETTINGS_OPENED = "Settings Opened",

  ORG_CREATED = "Org Created",
  ORG_MODIFIED = "Org Modified",
  ORG_CHECKOUT_STARTED = "Org Checkout Started",
  ORG_BILLING_PORTAL_VIEWED = "Org Billing Portal Viewed",
  ORG_UPGRADED = "Org Upgraded",
  ORG_SUBSCRIPTION_RENEWED = "Org Subscription Renewed",
  ORG_DOWNGRADED = "Org Downgraded",

  INVITE_CREATED = "Invite Created",
  INVITE_MODIFIED = "Invite Modified",
  INVITE_DELETED = "Invite Deleted",

  ORG_MEMBER_MODIFIED = "Org Member Modified",
  ORG_MEMBER_DELETED = "Org Member Removed",

  USER_CHECKOUT_STARTED = "User Checkout Started",
  USER_BILLING_PORTAL_VIEWED = "User Billing Portal Viewed",
  USER_UPGRADED = "User Upgraded",
  USER_SUBSCRIPTION_RENEWED = "User Subscription Renewed",
  USER_DOWNGRADED = "User Downgraded",
}

function setCookie(name: string, value: string, days: number) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }

  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name: string) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (var i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
  }

  return null;
}

const getDeviceId = (): string => {
  if (typeof window === "undefined") {
    // server-side has no device Id
    return "-1";
  }

  let deviceId: string | null;

  deviceId = getCookie(ampDeviceIdCookieKey);
  if (!deviceId) {
    deviceId = nanoid();
    setCookie(ampDeviceIdCookieKey, deviceId, 365);
  }

  return deviceId;
};

export async function track(
  eventName: string,
  userId?: string,
  eventProperties?: AmplitudeProperties,
  userProperties?: AmplitudeProperties
) {
  if (!shouldTrack) {
    return;
  }

  const deviceId = getDeviceId();

  return fetch("https://api2.amplitude.com/2/httpapi", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
    },
    body: JSON.stringify({
      api_key: amplitudeAPIKey,
      events: [
        {
          user_id: userId,
          device_id: deviceId,
          event_type: eventName,
          event_properties: eventProperties,
          user_properties: userProperties,
        },
      ],
    }),
  });
}

export async function identify(
  userId: string | null,
  properties: AmplitudeProperties
) {
  if (!shouldTrack) {
    return;
  }

  const deviceId = getDeviceId();

  const formBody = `api_key=${amplitudeAPIKey}&identification=${JSON.stringify([
    {
      user_id: userId,
      device_id: deviceId,
      user_properties: properties,
    },
  ])}`;

  return fetch("https://api2.amplitude.com/identify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "*/*",
    },
    body: formBody,
  });
}
