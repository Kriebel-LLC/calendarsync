import { siteConfig } from "@/config/site";
import { routeHandler } from "@/lib/route";
import { env } from "@/web-env";
import { NextResponse } from "next/server";
import Email from "shared/src/email";
import * as z from "zod";

const feedbackRequestSchema = z.object({
  feedback: z.string().min(1),
});

export const POST = routeHandler(async (req, user) => {
  let feedback: string;
  try {
    const json = await req.json();
    const body = feedbackRequestSchema.parse(json);
    feedback = body.feedback;
  } catch (error) {
    return new NextResponse(null, { status: 400 });
  }

  if (!feedback) {
    return NextResponse.json(
      { error: `feedback must be included` },
      {
        status: 400,
      }
    );
  }

  const htmlEncodedFeedback = feedback.replace(
    /[\u00A0-\u9999<>\&]/gim,
    function (i: string) {
      return "&#" + i.charCodeAt(0) + ";";
    }
  );

  await Email.send(env, {
    to: "me@aleckriebel.com",
    from: "feedback@kriebel.io",
    subject: `${siteConfig.name} Feedback from ${user.email || user.uid}`,
    text: htmlEncodedFeedback,
    replyTo: user.email,
  });

  return new NextResponse(null);
});
