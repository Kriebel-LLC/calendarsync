import { DashboardHeader } from "@/custom-components/header";
import { DashboardShell } from "@/custom-components/shell";
import { Button } from "components/ui/button";
import { Skeleton } from "components/ui/skeleton";

function PostSkeleton() {
  return (
    <div className="p-4">
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

export function DashboardLoading({
  heading,
  subHeading,
  buttonText,
}: {
  heading: string;
  subHeading: string;
  buttonText?: string;
}) {
  return (
    <DashboardShell>
      <DashboardHeader heading={heading} text={subHeading}>
        {buttonText && (
          <Button disabled={true} size="lg">
            {buttonText}
          </Button>
        )}
      </DashboardHeader>
      <div className="divide-border-200 divide-y rounded-md border">
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </div>
    </DashboardShell>
  );
}
