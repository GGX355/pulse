import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pulseRequest } from "@/lib/poll-submit";
import type { LivePoll } from "@/lib/poll-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ScorePoll({ poll }: { poll: LivePoll }) {
  const [value, setValue] = useState(""),
    [note, setNote] = useState("");
  const client = useQueryClient();
  const sent = poll.myScore != null,
    locked = sent || poll.closed || poll.deadlinePassed;
  const submit = useMutation({
    mutationFn: () =>
      pulseRequest<LivePoll>("castVote", { pollId: poll.id, score: Number(value), note }),
    onSuccess: async (result) => {
      client.setQueryData(["poll", poll.id], result);
      client.setQueryData(["live-poll"], result);
      await client.invalidateQueries({ queryKey: ["home-content"] });
    },
  });
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked && value.trim()) submit.mutate();
      }}
    >
      <h1 className="font-display text-2xl font-semibold text-center">{poll.question}</h1>
      {poll.description && <p className="text-center text-muted">{poll.description}</p>}
      {poll.voterNoteLabel && (
        <label>
          {poll.voterNoteLabel}
          <Input
            required
            maxLength={40}
            value={sent ? poll.myNote || "" : note}
            readOnly={locked}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      )}
      <label className="flex flex-col gap-2">
        {sent ? "我的评分" : "评分"}
        <Input
          type="number"
          inputMode="decimal"
          required
          min={poll.scoreMin}
          max={poll.scoreMax}
          step={poll.scoreStep}
          placeholder={`${poll.scoreMin}–${poll.scoreMax}`}
          value={sent ? String(poll.myScore) : value}
          readOnly={locked}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      {!locked && (
        <Button disabled={submit.isPending || !value.trim()}>
          {submit.isPending ? "提交中" : "提交"}
        </Button>
      )}
      {locked && (
        <p role="status" className="text-center text-muted">
          {sent ? "已提交" : "已结束"}
        </p>
      )}
      {poll.resultsVisible && poll.scoreCount != null && (
        <p className="text-center tabular-nums">
          {poll.scoreAverage == null
            ? "暂无评分"
            : `平均 ${Number(poll.scoreAverage.toFixed(2))} 分 · ${poll.scoreCount} 人`}
        </p>
      )}
      {submit.isError && <p role="alert">{submit.error.message}</p>}
    </form>
  );
}
