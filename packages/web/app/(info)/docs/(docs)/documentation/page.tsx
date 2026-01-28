import DocTemplate from "@/app/(info)/docs/doc-template";
import Content, {
  // @ts-ignore
  meta,
} from "@/content/docs/documentation/index.mdx";
import { mapMetadata } from "@/lib/utils";

export async function generateMetadata() {
  return mapMetadata(meta);
}

export default async function Page() {
  return <DocTemplate content={Content} metadata={meta} />;
}
