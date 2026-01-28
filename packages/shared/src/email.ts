import { Env } from "./types";
import { z } from "zod";

const iContactSchema = z.union([
  z.string(),
  z.object({
    email: z.string(),
    name: z.union([z.string(), z.undefined()]),
  }),
]);

const iEmailSchema = z.object({
  to: z.union([iContactSchema, z.array(iContactSchema)]),
  replyTo: z.union([iContactSchema, z.array(iContactSchema)]).optional(),
  cc: z.union([iContactSchema, z.array(iContactSchema)]).optional(),
  bcc: z.union([iContactSchema, z.array(iContactSchema)]).optional(),
  from: iContactSchema,
  subject: z.string(),
  text: z.union([z.string(), z.undefined()]),
  html: z.union([z.string(), z.undefined()]),
});

export type IContact = z.infer<typeof iContactSchema>;
export type IEmail = z.infer<typeof iEmailSchema>;

class Email {
  static async send(env: Env, email: IEmail) {
    const region = "us-west-1";
    const accessKeyId = env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = env.AWS_SECRET_ACCESS_KEY;
    const sesEndpoint = `https://email.${region}.amazonaws.com/`;

    const params = Email.convertToSESParams(email);

    const body = new URLSearchParams({
      Action: "SendEmail",
      Source: params.Source,
      "Destination.ToAddresses.member.1": params.Destination.ToAddresses[0],
      "Message.Subject.Data": params.Message.Subject.Data,
      "Message.Body.Text.Data": params.Message.Body.Text?.Data || "",
    });

    if (params.Message.Body.Html) {
      body.append("Message.Body.Html.Data", params.Message.Body.Html.Data);
    }

    if (params.Destination.CcAddresses) {
      params.Destination.CcAddresses.forEach((cc, index) => {
        body.append(`Destination.CcAddresses.member.${index + 1}`, cc);
      });
    }

    if (params.Destination.BccAddresses) {
      params.Destination.BccAddresses.forEach((bcc, index) => {
        body.append(`Destination.BccAddresses.member.${index + 1}`, bcc);
      });
    }

    if (params.ReplyToAddresses) {
      params.ReplyToAddresses.forEach((replyTo, index) => {
        body.append(`ReplyToAddresses.member.${index + 1}`, replyTo);
      });
    }

    const headers = await Email.getSignedHeaders(
      "POST",
      sesEndpoint,
      body.toString(),
      accessKeyId,
      secretAccessKey,
      region
    );

    try {
      const response = await fetch(sesEndpoint, {
        method: "POST",
        headers,
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error sending email: ${response.status} ${errorText}`);
      }

      console.log(`Email to ${email.to} submitted`);
    } catch (error) {
      console.error(error);
      throw new Error(`Error sending email: ${error.message}`);
    }
  }

  protected static convertToSESParams(email: IEmail) {
    const destinations: {
      ToAddresses: string[];
      CcAddresses?: string[];
      BccAddresses?: string[];
    } = {
      ToAddresses: Email.convertContactsToEmails(email.to),
    };

    if (email.cc) {
      destinations.CcAddresses = Email.convertContactsToEmails(email.cc);
    }

    if (email.bcc) {
      destinations.BccAddresses = Email.convertContactsToEmails(email.bcc);
    }

    const from = Email.convertContactToEmail(email.from);
    const replyToAddresses = email.replyTo
      ? Email.convertContactsToEmails(email.replyTo)
      : undefined;

    const subject = { Charset: "UTF-8", Data: email.subject };
    const body: {
      Html?: { Charset: string; Data: string };
      Text?: { Charset: string; Data: string };
    } = {};

    if (email.text) {
      body.Text = { Charset: "UTF-8", Data: email.text };
    }

    if (email.html) {
      body.Html = { Charset: "UTF-8", Data: email.html };
    }

    return {
      Source: from,
      Destination: destinations,
      Message: { Subject: subject, Body: body },
      ReplyToAddresses: replyToAddresses,
    };
  }

  protected static convertContactsToEmails(
    contacts: IContact | IContact[]
  ): string[] {
    if (!contacts) {
      return [];
    }

    const contactArray: IContact[] = Array.isArray(contacts)
      ? contacts
      : [contacts];
    return contactArray.map((contact) =>
      typeof contact === "string" ? contact : contact.email
    );
  }

  protected static convertContactToEmail(contact: IContact): string {
    return typeof contact === "string" ? contact : contact.email;
  }

  protected static async getSignedHeaders(
    method: string,
    endpoint: string,
    body: string,
    accessKeyId: string,
    secretAccessKey: string,
    region: string
  ) {
    const service = "ses";
    const host = `email.${region}.amazonaws.com`;
    const endpointPath = "/";
    const contentType = "application/x-www-form-urlencoded; charset=utf-8";

    // Use UTC time
    const date = new Date();
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);

    // Canonical headers for signing
    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-date";
    const payloadHash = await Email.hash(body);

    // Create canonical request
    const canonicalRequest = `${method}\n${endpointPath}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await Email.hash(
      canonicalRequest
    )}`;

    // Generate the signing key
    const signingKey = await Email.getSignatureKey(
      secretAccessKey,
      dateStamp,
      region,
      service
    );
    const signature = await Email.hmac(signingKey, stringToSign);

    // Return signed headers
    return {
      "Content-Type": contentType,
      "X-Amz-Date": amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  protected static async hash(value: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  protected static async hmac(key: CryptoKey, value: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
    return Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  protected static async getSignatureKey(
    key: string,
    dateStamp: string,
    regionName: string,
    serviceName: string
  ) {
    const kDate = await Email.hmacKey(`AWS4${key}`, dateStamp);
    const kRegion = await Email.hmacKey(kDate, regionName);
    const kService = await Email.hmacKey(kRegion, serviceName);
    return Email.hmacKey(kService, "aws4_request");
  }

  protected static async hmacKey(key: string | CryptoKey, value: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    let cryptoKey;

    if (typeof key === "string") {
      const keyData = encoder.encode(key);
      cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["sign", "verify"]
      );
    } else {
      cryptoKey = key;
    }

    return crypto.subtle.sign("HMAC", cryptoKey, data).then((sigBuffer) => {
      const keyBuffer = new Uint8Array(sigBuffer);
      return crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["sign", "verify"]
      );
    });
  }
}

export default Email;
