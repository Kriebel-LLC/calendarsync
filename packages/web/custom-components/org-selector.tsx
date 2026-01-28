"use client";

import React from "react";

import { PersonalDashboardRoute } from "@/lib/constants";
import { clientFetch } from "@/lib/fetch";
import { capitalizeFirstLetter } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "components/ui/select";
import { Skeleton } from "components/ui/skeleton";
import {
  usePathname,
  useRouter,
  useSelectedLayoutSegment,
} from "next/navigation";
import { Org } from "shared/src/db/schema";

export function OrgSelector() {
  // TODO: improve this so it's faster; current this is null for a render or 2 on first load
  const segment = useSelectedLayoutSegment();
  const router = useRouter();
  const pathname = usePathname();

  const [orgs, setOrgs] = React.useState<Org[]>();
  const [value, setValue] = React.useState<string | null>(segment);

  const fetchOrgs = () => {
    clientFetch<Org[]>("/api/orgs", undefined, {
      onRequestSuccess: (orgData) => setOrgs(orgData),
    });
  };

  React.useEffect(() => {
    if (!pathname) return;

    const pathSegments = pathname.split("/");
    setValue(pathSegments[1]);
  }, [pathname]);

  return (
    <Select
      value={value || undefined}
      onOpenChange={(open) => {
        if (open && !orgs) {
          fetchOrgs();
        }
      }}
      onValueChange={(newValue) => {
        setValue(newValue);
        if (!pathname) {
          return router.push(`/${newValue}`);
        }

        const pathSegments = pathname.split("/"); // Split the URL path by '/'
        pathSegments[1] = newValue; // Replace the second element (first directory) with the new directory
        router.push(pathSegments.join("/"));
      }}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Your Organization" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="dashboard">Personal Dashboard</SelectItem>
        </SelectGroup>
        <SelectGroup>
          {!!orgs ? (
            <>
              {orgs.map((org) => (
                <SelectItem value={org.name} key={org.id}>
                  {capitalizeFirstLetter(org.name)}
                </SelectItem>
              ))}
            </>
          ) : (
            <>
              {!!segment && segment !== PersonalDashboardRoute && (
                <SelectItem value={segment}>
                  {capitalizeFirstLetter(segment)}
                </SelectItem>
              )}
              <Skeleton className="h-[20px] w-full rounded-full" />
            </>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
