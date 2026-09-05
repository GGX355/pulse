import { createFileRoute, Link } from "@tanstack/react-router";
import { CreatePollForm } from "@/components/poll/create-poll";
import { VoterRoster } from "@/components/poll/voter-roster";

export const Route = createFileRoute("/new")({
  component: NewPage,
});

function NewPage() {
  return (
    <>
      <p className="mb-6 text-xs font-medium tracking-wide text-muted">后台</p>
      <CreatePollForm />
      <div className="mt-12">
        <VoterRoster />
      </div>
      <p className="mt-10 text-sm text-muted">
        要发起抽签(选人)?
        <Link to="/draw/new" className="ml-2 text-foreground underline">
          去抽签后台
        </Link>
      </p>
    </>
  );
}
