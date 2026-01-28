import { orgNameNotCharacterRegex } from "@/lib/validations/orgs";
import { env } from "@/web-env";
import { Metadata } from "next";

export function formatDate(input: string | number): string {
  const date = new Date(input);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function absoluteUrl(path: string) {
  return `${env.NEXT_PUBLIC_APP_URL}${path}`;
}

export function mapMetadata(metadata: any): Metadata {
  return {
    title: metadata.title,
    description: metadata.description,
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      type: "article",
      url: absoluteUrl(metadata.slug),
      // images: [
      //   {
      //     url: ogUrl.toString(),
      //     width: 1200,
      //     height: 630,
      //     alt: page.title,
      //   },
      // ],
    },
    twitter: {
      card: "summary_large_image",
      title: metadata.title,
      description: metadata.description,
      // images: [ogUrl.toString()],
    },
  };
}

export function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function daysUntilDate(targetDate: Date): number {
  // Convert the targetDate to a Date object
  const targetDateTime = new Date(targetDate).getTime();

  // Get the current date and time
  const now = new Date().getTime();

  // Calculate the difference in milliseconds between the target date and now
  const timeDifference = targetDateTime - now;

  // Calculate the number of days from milliseconds
  const daysUntil = Math.floor(timeDifference / (1000 * 60 * 60 * 24));

  return daysUntil;
}

export function sanitizeOrgName(inputString: string): string {
  return inputString.toLocaleLowerCase().replace(orgNameNotCharacterRegex, "");
}
