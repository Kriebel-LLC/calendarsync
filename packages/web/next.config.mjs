import bundleAnalyzer from "@next/bundle-analyzer";
import withMdx from "@next/mdx";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import createJiti from "jiti";
import { withAxiom } from "next-axiom";
import { fileURLToPath } from "node:url";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
const jiti = createJiti(fileURLToPath(import.meta.url));

// Import env here to validate during build. Using jiti we can import .ts files :)
jiti("./web-env");

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["components"],
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { hostname: "avatars.githubusercontent.com" },
      { hostname: "lh3.googleusercontent.com" },
    ],
  },
  serverExternalPackages: ["jose"],
};

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev({
    persist: {
      path: "../shared/.wrangler/state/v3/",
    },
  });
}

export default withAxiom(
  withBundleAnalyzer(
    withMdx({
      options: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          [
            rehypePrettyCode,
            {
              theme: "github-dark",
              onVisitLine(node) {
                // Prevent lines from collapsing in `display: grid` mode, and allow empty
                // lines to be copy/pasted
                if (node.children.length === 0) {
                  node.children = [{ type: "text", value: " " }];
                }
              },
              onVisitHighlightedLine(node) {
                node.properties.className.push("line--highlighted");
              },
              onVisitHighlightedWord(node) {
                node.properties.className = ["word--highlighted"];
              },
            },
          ],
          [
            rehypeAutolinkHeadings,
            {
              properties: {
                className: ["subheading-anchor"],
                ariaLabel: "Link to section",
              },
            },
          ],
        ],
      },
    })(nextConfig)
  )
);
