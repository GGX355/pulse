import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createLivePoll, type LivePoll } from "@/lib/poll-api";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TEMPLATES = [
  { name: "午饭", question: "午饭吃什么？", options: ["拉面", "便当", "沙拉", "随便"] },
  { name: "团建", question: "团建去哪？", options: ["密室逃脱", "烧烤", "爬山", "看电影"] },
  { name: "会议", question: "会议定哪天？", options: ["周一", "周二", "周三", "周四"] },
] as const;

export function CreatePollForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isPending } = useCurrentUserState();
  const [question, setQuestion] = useState("午饭吃什么？");
  const [options, setOptions] = useState(["拉面", "便当", "沙拉", ""]);

  const create = useMutation({
    mutationFn: () =>
      createLivePoll({
        data: {
          question,
          options: options.map((o) => o.trim()).filter(Boolean),
        },
      }),
    onSuccess: (poll: LivePoll) => {
      queryClient.setQueryData(["live-poll"], poll);
      queryClient.setQueryData(["poll", poll.id], poll);
      void navigate({ to: "/poll/$pollId", params: { pollId: poll.id } });
    },
  });

  function setOption(index: number, value: string) {
    setOptions((prev) => prev.map((row, i) => (i === index ? value : row)));
  }

  // 发起/结束是管理动作,要登录;投票的人不受影响(见 README 的产品约定)。
  if (isPending) {
    return <p className="text-sm text-muted">正在确认登录状态…</p>;
  }
  if (!user) {
    return <RedirectToSignIn />;
  }

  const filled = options.map((o) => o.trim()).filter(Boolean);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (filled.length < 2 || !question.trim()) return;
        create.mutate();
      }}
    >
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          发起新投票
        </h1>
        <p className="mt-2 text-sm text-muted">
          新问题会替换现场投票。每人仍只能投一票。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.name}
            type="button"
            className="h-9 rounded-full border border-border px-3 text-sm text-muted touch-manipulation hover:text-foreground"
            onClick={() => {
              setQuestion(tpl.question);
              setOptions([...tpl.options]);
            }}
          >
            {tpl.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="q">问题</Label>
        <Input
          id="q"
          value={question}
          maxLength={80}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="问一句现场能立刻投的问题"
        />
      </div>

      <div className="flex flex-col gap-3">
        <Label>选项</Label>
        {options.map((value, index) => (
          <Input
            key={index}
            value={value}
            maxLength={40}
            placeholder={`选项 ${index + 1}`}
            onChange={(e) => setOption(index, e.target.value)}
          />
        ))}
        {options.length < 8 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOptions((prev) => [...prev, ""])}
          >
            加一个选项
          </Button>
        ) : null}
      </div>

      {create.isError ? (
        <p className="text-sm text-muted">没发出去，请再试一次。</p>
      ) : null}

      <Button type="submit" disabled={create.isPending || filled.length < 2 || !question.trim()}>
        {create.isPending ? (
          <>
            <span
              aria-hidden
              className="size-3.5 animate-spin rounded-full border border-current border-t-transparent"
            />
            发布中…
          </>
        ) : (
          "发布到现场"
        )}
      </Button>
    </form>
  );
}
