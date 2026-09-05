import { createFileRoute } from "@tanstack/react-router";
import { CreateDrawForm } from "@/components/poll/create-draw";

export const Route = createFileRoute("/draw/new")({
  component: NewDrawPage,
});

function NewDrawPage() {
  return <CreateDrawForm />;
}
