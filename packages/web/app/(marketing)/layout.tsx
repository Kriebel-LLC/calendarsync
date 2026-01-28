import Link from "next/link";

import { marketingConfig } from "@/config/marketing";
import { MainNav } from "@/custom-components/main-nav";
import { SiteFooter } from "@/custom-components/site-footer";
import { authConfig } from "@/lib/auth";
import { cn } from "components/lib/utils";
import { buttonVariants } from "components/ui/button";
import { cookies } from "next/headers";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export default async function MarketingLayout({
  children,
}: MarketingLayoutProps) {
  const isLoggedIn = cookies().has(authConfig.cookieName);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container z-40 bg-background">
        <div className="flex h-20 items-center justify-between py-6">
          <MainNav items={marketingConfig.mainNav} />
          <nav>
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "px-4"
              )}
            >
              {isLoggedIn ? "Dashboard" : "Login"}
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
