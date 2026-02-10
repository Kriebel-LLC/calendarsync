import "@/styles/mdx.css";

interface PageProps {
  metadata: any;
  content: React.ComponentType;
}

export default function PageTemplate(props: PageProps) {
  return (
    <article className="container max-w-3xl py-6 lg:py-12">
      <div className="space-y-4">
        <h1 className="inline-block font-heading text-4xl lg:text-5xl">
          {props.metadata.title}
        </h1>
        {props.metadata.description && (
          <p className="text-xl text-muted-foreground">
            {props.metadata.description}
          </p>
        )}
      </div>
      <hr className="my-4" />
      <div className="mdx">
        <props.content />
      </div>
    </article>
  );
}
