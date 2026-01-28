import { EmptyPlaceholder } from "@/custom-components/empty-placeholder";

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center p-8 text-center animate-in fade-in-50">
      <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
        <EmptyPlaceholder.Icon name="warning" />
        <EmptyPlaceholder.Title>Uh oh! Not Found</EmptyPlaceholder.Title>
        <EmptyPlaceholder.Description>
          This page cound not be found. Please try again.
        </EmptyPlaceholder.Description>
      </div>
    </div>
  );
}
