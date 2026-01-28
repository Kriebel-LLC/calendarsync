import PageTemplate from "@/app/(marketing)/(pages)/page-template";
// @ts-ignore
import Privacy, { meta } from "@/content/pages/privacy.mdx";
import { mapMetadata } from "@/lib/utils";

export async function generateMetadata() {
  return mapMetadata(meta);
}

export default async function PrivacyPage() {
  return <PageTemplate content={Privacy} metadata={meta} />;
}
