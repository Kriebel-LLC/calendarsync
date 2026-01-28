import PageTemplate from "@/app/(marketing)/(pages)/page-template";
// @ts-ignore
import Terms, { meta } from "@/content/pages/terms.mdx";
import { mapMetadata } from "@/lib/utils";

export async function generateMetadata() {
  return mapMetadata(meta);
}

export default async function TermsPage() {
  return <PageTemplate content={Terms} metadata={meta} />;
}
