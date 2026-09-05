import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createDrawLive } from "@/lib/draw-api";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type BlankMode = "count" | "unlimited" | "none";

type SlotRow = { label: string; count: string };

const TEMPLATES = [
  {
    name: "团建抽奖",
    slots: [
      { label: "一等奖", count: "1" },
      { label: "二等奖", count: "2" },
      { label: "三等奖", count: "3" },
    ],
    blankMode: "count" as BlankMode,
    blankLabel: "谢谢参与",
    blankCount: "10",
  },
  {
    name: "值班抽签",
    slots: [
      { label: "周一", count: "1" },
      { label: "周三", count: "1" },
      { label: "周五", count: "1" },
    ],
    blankMode: "none" as BlankMode,
    blankLabel: "",
    blankCount: "",
  },
] as const;

export function CreateDrawForm() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [title, setTitle] = useState("抽签决定谁去？");
  const [slots, setSlots] = useState<SlotRow[]>([
    { label: "一等奖", count: "1" },
    { label: "二等奖", count: "2" },
    { label: "谢谢参与", count: "5" },
  ]);
  const [blankMode, setBlankMode] = useState<BlankMode>("none");
  const [blankLabel, setBlankLabel] = useState("未中");
  const [blankCount, setBlankCount] = useState("10");
  const [error, setError] = useState<string | null>(null);

  function setSlot(index: number, patch: Partial<SlotRow>) {
    setSlots((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const filled = slots.filter((slot) => slot.label.trim());

  const create = useMutation({
    mutationFn: () =>
      createDrawLive({
        data: {
          title: title.trim(),
          slots: filled.map((slot) => ({
            label: slot.label.trim(),
            count: Math.max(1, parseInt(slot.count, 10) || 1),
          })),
          blankMode,
          blankLabel: blankLabel.trim(),
          blankCount: Math.max(1, parseInt(blankCount, 10) || 1),
        },
      }),
    onSuccess: (draw) => {
      void navigate({ to: "/poll/$pollId", params: { pollId: draw.id } });
    },
    onError: () => setError("没发出去,请再试一次。"),
  });

  // 发起是管理动作,要登录;抽签的人不需要登录。
  if (isPending) {
    return <p className="text-sm text-muted">正在确认登录状态…</p>;
  }
  if (!user) {
    return <RedirectToSignIn />;
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!title.trim() || filled.length < 1) return;
        create.mutate();
      }}
    >
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          发起抽签
        </h1>
        <p className="mt-2 text-sm text-muted">
          每个签位设一个数量,每人抽一次,抽完即止。抽签的人不需要登录。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.name}
            type="button"
            className="h-9 rounded-full border border-border px-3 text-sm text-muted touch-manipulation hover:text-foreground"
            onClick={() => {
              setTitle(
                tpl.name === "团建抽奖" ? "团建抽奖！" : tpl.name + "看看谁值",
              );
              setSlots(tpl.slots.map((slot) => ({ ...slot })));
              setBlankMode(tpl.blankMode);
              setBlankLabel(tpl.blankLabel);
              setBlankCount(tpl.blankCount);
            }}
          >
            {tpl.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="draw-title">标题</Label>
        <Input
          id="draw-title"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="抽什么?"
        />
      </div>

      <div className="flex flex-col gap-3">
        <Label>签位与数量</Label>
        {slots.map((slot, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={slot.label}
              maxLength={40}
              placeholder={`签位 ${index + 1}`}
              onChange={(e) => setSlot(index, { label: e.target.value })}
              className="flex-1"
            />
            <Input
              value={slot.count}
              inputMode="numeric"
              aria-label={`签位 ${index + 1} 数量`}
              onChange={(e) =>
                setSlot(index, { count: e.target.value.replace(/\D/g, "") })
              }
              className="w-20 shrink-0 text-center tabular-nums"
            />
            {slots.length > 1 ? (
              <button
                type="button"
                aria-label="删除签位"
                className="shrink-0 px-2 py-1 text-sm text-muted hover:text-foreground"
                onClick={() =>
                  setSlots((prev) => prev.filter((_, i) => i !== index))
                }
              >
                ✕
              </button>
            ) : null}
          </div>
        ))}
        {slots.length < 12 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSlots((prev) => [...prev, { label: "", count: "1" }])}
          >
            加一个签位
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <Label>没抽中的人</Label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["count", "设数量"],
              ["unlimited", "不限量"],
              ["none", "不设未中"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setBlankMode(value)}
              className={cn(
                "h-9 rounded-full border px-4 text-sm touch-manipulation transition-colors",
                blankMode === value
                  ? "border-accent/40 bg-surface-2 text-foreground"
                  : "border-border text-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {blankMode !== "none" ? (
          <div className="flex items-center gap-2">
            <Input
              value={blankLabel}
              maxLength={10}
              placeholder="未中文案,如「谢谢参与」"
              onChange={(e) => setBlankLabel(e.target.value)}
              className="flex-1"
            />
            {blankMode === "count" ? (
              <Input
                value={blankCount}
                inputMode="numeric"
                aria-label="未中数量"
                onChange={(e) =>
                  setBlankCount(e.target.value.replace(/\D/g, ""))
                }
                className="w-20 shrink-0 text-center tabular-nums"
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <p className="form-error text-sm text-muted">{error}</p> : null}

      <Button
        type="submit"
        disabled={
          create.isPending || filled.length < 1 || !title.trim()
        }
      >
        {create.isPending ? (
          <>
            <span
              aria-hidden
              className="size-3.5 animate-spin rounded-full border border-current border-t-transparent"
            />
            发布中…
          </>
        ) : (
          "发布抽签"
        )}
      </Button>
    </form>
  );
}
