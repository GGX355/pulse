import { createLivePoll as originalCreate } from "@/lib/poll-api";
import type { LivePoll } from "@/lib/poll-api";
type Input = Parameters<typeof originalCreate>[0]["data"] & {
  pollType: string;
  resultsPublic: boolean;
  scoreMin: number;
  scoreMax: number;
  scoreStep: number;
};
export async function pulseRequest<T>(operation: string, data: object): Promise<T> {
  const response = await fetch(`/api/pulse/${operation}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "same-origin",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "请求失败");
  return result;
}
export function createLivePoll({ data }: { data: Input }): Promise<LivePoll> {
  return import.meta.env.VITE_CF_APP
    ? pulseRequest("createLivePoll", data)
    : originalCreate({ data });
}
