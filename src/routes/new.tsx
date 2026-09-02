import { createFileRoute } from "@tanstack/react-router";
import { CreatePollForm } from "@/components/poll/create-poll";
import { SiteShell } from "@/components/site-shell";

export const Route = createFileRoute("/new")({
  component: NewPage,
});

function NewPage() {
  return (
    <SiteShell>
      <CreatePollForm />
    </SiteShell>
  );
}
