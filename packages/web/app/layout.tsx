import { Inter as FontSans } from "next/font/google";
import localFont from "next/font/local";

import { siteConfig } from "@/config/site";
import { Analytics } from "@/custom-components/analytics";
import { GlobalToaster } from "@/custom-components/global-toaster";
import { TailwindIndicator } from "@/custom-components/tailwind-indicator";
import { ThemeProvider } from "@/custom-components/theme-provider";
import "@/styles/globals.css";
import { env } from "@/web-env";
import { cn } from "components/lib/utils";
import { Toaster } from "components/ui/toaster";
import { TooltipProvider } from "components/ui/tooltip";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

// Font files can be colocated inside of `pages`
const fontHeading = localFont({
  src: "../assets/fonts/CalSans-SemiBold.woff2",
  variable: "--font-heading",
});

interface RootLayoutProps {
  children: React.ReactNode;
}

import type { Viewport } from "next";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export const metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "Next.js",
    "React",
    "Tailwind CSS",
    "Server Components",
    "Radix UI",
  ],
  authors: [
    {
      name: "aleckriebel",
      url: "https://aleckriebel.com",
    },
  ],
  creator: "aleckriebel",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [`${siteConfig.url}/og.jpg`],
    creator: "@aleckriebel",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: `${siteConfig.url}/site.webmanifest`,
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
          fontHeading.variable
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider delayDuration={300}>
            {children}
            <Analytics />
            <Toaster />
            <GlobalToaster />
            <TailwindIndicator />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
