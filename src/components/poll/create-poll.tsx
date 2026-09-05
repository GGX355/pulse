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

const NOTE_PRESETS = ["名字", "地点", "时间"] as const;

export function CreatePollForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isPending } = useCurrentUserState();
  const [question, setQuestion] = useState("午饭吃什么？");
  const [options, setOptions] = useState(["拉面", "便当", "沙拉", ""]);
  const [askNote, setAskNote] = useState(false);
  const [noteLabel, setNoteLabel] = useState("名字");
  const [choiceMode, setChoiceMode] = useState<"single" | "limited" | "unlimited">(
    "single",
  );
  const [choiceLimit, setChoiceLimit] = useState(2);
  const [includeWriteIn, setIncludeWriteIn] = useState(false);
  const [writeInLabel, setWriteInLabel] = useState("其他");

  const create = useMutation({
    mutationFn: () =>
      createLivePoll({
        data: {
          question,
          options: options.map((o) => o.trim()).filter(Boolean),
          voterNoteLabel: askNote ? noteLabel.trim() : "",
          maxChoices:
            choiceMode === "single"
              ? 1
              : choiceMode === "unlimited"
                ? 0
                : Math.min(Math.max(choiceLimit, 2), optionCount),
          writeInLabel: includeWriteIn ? writeInLabel.trim() || "其他" : "",
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
    return <p className="text-sm text-muted">加载中</p>;
  }
  if (!user) {
    return <RedirectToSignIn />;
  }

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const optionCount = filled.length + (includeWriteIn ? 1 : 0);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (optionCount < 2 || optionCount > 8 || !question.trim()) return;
        if (askNote && !noteLabel.trim()) return;
        if (includeWriteIn && !writeInLabel.trim()) return;
        create.mutate();
      }}
    >
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          新建投票
        </h1>
        <p className="mt-2 text-sm text-muted">发布后显示在投票页。</p>
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
              setAskNote(false);
              setNoteLabel("名字");
              setChoiceMode("single");
              setChoiceLimit(2);
              setIncludeWriteIn(false);
              setWriteInLabel("其他");
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
          placeholder="输入问题"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>参与登记</Label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={
              "h-9 rounded-full border px-3 text-sm touch-manipulation " +
              (!askNote
                ? "border-foreground text-foreground"
                : "border-border text-muted hover:text-foreground")
            }
            onClick={() => setAskNote(false)}
          >
            不需要
          </button>
          <button
            type="button"
            className={
              "h-9 rounded-full border px-3 text-sm touch-manipulation " +
              (askNote
                ? "border-foreground text-foreground"
                : "border-border text-muted hover:text-foreground")
            }
            onClick={() => {
              setAskNote(true);
              if (!noteLabel.trim()) setNoteLabel("名字");
            }}
          >
            需要填写
          </button>
        </div>
        {askNote ? (
          <>
            <div className="flex flex-wrap gap-2">
              {NOTE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="h-9 rounded-full border border-border px-3 text-sm text-muted touch-manipulation hover:text-foreground"
                  onClick={() => setNoteLabel(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <Input
              id="note-label"
              value={noteLabel}
              maxLength={20}
              onChange={(e) => setNoteLabel(e.target.value)}
              placeholder="比如：名字"
            />
          </>
        ) : (
          <p className="text-xs text-muted">参与者直接选择即可。</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>可选项数</Label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["single", "单选"],
              ["limited", "限项多选"],
              ["unlimited", "不限项数"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                "h-9 rounded-full border px-3 text-sm touch-manipulation " +
                (choiceMode === value
                  ? "border-foreground text-foreground"
                  : "border-border text-muted hover:text-foreground")
              }
              onClick={() => {
                setChoiceMode(value);
                if (value === "limited") {
                  setChoiceLimit((n) =>
                    Math.min(Math.max(n, 2), Math.max(optionCount, 2)),
                  );
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {choiceMode === "limited" ? (
          <>
            <Label htmlFor="choice-limit">选项上限</Label>
            <Input
              id="choice-limit"
              type="number"
              min={2}
              max={Math.max(optionCount, 2)}
              value={choiceLimit}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (!Number.isFinite(n)) return;
                setChoiceLimit(Math.min(Math.max(n, 2), 8));
              }}
            />
            <p className="text-xs text-muted">
              最多 {choiceLimit} 项。
            </p>
          </>
        ) : choiceMode === "unlimited" ? (
          <p className="text-xs text-muted">不限数量。</p>
        ) : (
          <p className="text-xs text-muted">选择后立即生效。</p>
        )}
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
        {options.length < (includeWriteIn ? 7 : 8) ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOptions((prev) => [...prev, ""])}
          >
            再加一项
          </Button>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={
              "h-9 rounded-full border px-3 text-sm touch-manipulation " +
              (includeWriteIn
                ? "border-foreground text-foreground"
                : "border-border text-muted hover:text-foreground")
            }
            onClick={() => setIncludeWriteIn((on) => !on)}
          >
            {includeWriteIn ? "已添加「其他」" : "添加「其他」"}
          </button>
        </div>
        {includeWriteIn ? (
          <>
            <Input
              id="write-in-label"
              value={writeInLabel}
              maxLength={40}
              onChange={(e) => setWriteInLabel(e.target.value)}
              placeholder="选项名称，如：其他"
            />
            <p className="text-xs text-muted">
              选择此项后需自行填写内容。
            </p>
          </>
        ) : null}
      </div>

      {create.isError ? (
        <p className="text-sm text-muted">创建失败，请重试。</p>
      ) : null}

      <Button
        type="submit"
        disabled={
          create.isPending ||
          optionCount < 2 ||
          optionCount > 8 ||
          !question.trim() ||
          (askNote && !noteLabel.trim()) ||
          (includeWriteIn && !writeInLabel.trim())
        }
      >
        {create.isPending ? (
          <>
            <span
              aria-hidden
              className="size-3.5 animate-spin rounded-full border border-current border-t-transparent"
            />
            创建中
          </>
        ) : (
          "创建"
        )}
      </Button>
    </form>
  );
}
