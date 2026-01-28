import Content, {
  // @ts-ignore
  meta,
} from "@/content/docs/index.mdx";
import { mapMetadata } from "@/lib/utils";
import DocTemplate from "./doc-template";

export async function generateMetadata() {
  return mapMetadata(meta);
}

export default async function Page() {
  return <DocTemplate content={Content} metadata={meta} />;
}
