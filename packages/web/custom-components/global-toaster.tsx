"use client";

import React, { Suspense } from "react";

import { toastQueryParameterKey } from "@/lib/constants";
import { toast } from "components/ui/use-toast";
import { useRouter, useSearchParams } from "next/navigation";

function GlobalToasterUnsuspended() {
  const router = useRouter();
  const params = useSearchParams();

  React.useEffect(() => {
    const toastParam = params?.get(toastQueryParameterKey);
    if (!toastParam) {
      return;
    }

    toast({
      description: decodeURIComponent(toastParam),
    });

    let currentURL = new URL(window.location.href);
    const searchParams = new URLSearchParams(currentURL.search);
    searchParams.delete(toastQueryParameterKey);
    currentURL.search = searchParams.toString();
    router.replace(currentURL.toString());
  }, [router, params]);

  return null;
}

// Necessary due to https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
export function GlobalToaster() {
  return (
    <Suspense>
      <GlobalToasterUnsuspended />
    </Suspense>
  );
}
