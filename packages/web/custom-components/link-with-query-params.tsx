"use client";

import Link from "next/link";
import React from "react";

import { useSearchParams } from "next/navigation";
import { UrlObject } from "url";

interface LinkWithQueryParamsProps extends React.ComponentProps<typeof Link> {
  href: UrlObject;
}

export function LinkWithQueryParams(props: LinkWithQueryParamsProps) {
  const { href } = props;
  const params = useSearchParams();

  return (
    <Link
      {...props}
      href={{
        ...href,
        query: params?.toString(),
      }}
    />
  );
}
