import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createDrawLive, type RevealMode } from "@/lib/draw-api";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SegmentToggle } from "@/components/ui/segment-toggle";

type BlankMode = "count" | "unlimited" | "none";

const REVEAL_OPTIONS: Array<{ id: RevealMode; label: string; hint: string }> = [
  { id: "flip", label: "🂠 翻牌", hint: "点卡翻面" },
  { id: "scratch", label: "✦ 刮奖", hint: "刮开涂层" },
  { id: "grid", label: "▦ 九宫格", hint: "跑灯落格" },
];

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
  const [description, setDescription] = useState("");
  const [slots, setSlots] = useState<SlotRow[]>([
    { label: "一等奖", count: "1" },
    { label: "二等奖", count: "2" },
    { label: "谢谢参与", count: "5" },
  ]);
  const [blankMode, setBlankMode] = useState<BlankMode>("none");
  const [blankLabel, setBlankLabel] = useState("未中");
  const [blankCount, setBlankCount] = useState("10");
  const [askName, setAskName] = useState(false);
  const [noteLabel, setNoteLabel] = useState("姓名");
  const [rosterOn, setRosterOn] = useState(false);
  const [rosterText, setRosterText] = useState("");
  const [revealModes, setRevealModes] = useState<RevealMode[]>([
    "flip",
    "scratch",
    "grid",
  ]);
  const [error, setError] = useState<string | null>(null);

  function toggleRevealMode(id: RevealMode) {
    setRevealModes((prev) => {
      if (prev.includes(id)) {
        // 至少保留一种:试图关掉最后一种时原地不动。
        return prev.length > 1 ? prev.filter((m) => m !== id) : prev;
      }
      // 按固定顺序排列,发送与服务端存储都稳定。
      const order: RevealMode[] = ["flip", "scratch", "grid"];
      return order.filter((m) => prev.includes(m) || m === id);
    });
  }

  const rosterNames = rosterOn
    ? rosterText
        .split(/\r?\n|[，,、;；]/)
        .map((name) => name.trim())
        .filter(Boolean)
    : [];

  function setSlot(index: number, patch: Partial<SlotRow>) {
    setSlots((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const filled = slots.filter((slot) => slot.label.trim());

  const create = useMutation({
    mutationFn: () =>
      createDrawLive({
        data: {
          title: title.trim(),
          description: description.trim(),
          slots: filled.map((slot) => ({
            label: slot.label.trim(),
            count: Math.max(1, parseInt(slot.count, 10) || 1),
          })),
          blankMode,
          blankLabel: blankLabel.trim(),
          blankCount: Math.max(1, parseInt(blankCount, 10) || 1),
          voterNoteLabel: askName || rosterOn ? noteLabel.trim() : "",
          roster: rosterNames,
          revealModes,
        },
      }),
    onSuccess: (draw) => {
      void navigate({ to: "/draw/$drawId", params: { drawId: draw.id } });
    },
    onError: () => setError("发布失败，请重试。"),
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
      className="glass stage-panel flex flex-col gap-6 rounded-[var(--r-lg)] p-5 animate-in fade-in slide-in-from-bottom-3 duration-500"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!title.trim() || filled.length < 1) return;
        create.mutate();
      }}
    >
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          新建抽签
        </h1>
        <p className="mt-2 text-sm text-muted">
          设置各签位数量，每人限抽一次，抽完即止。参与者无需登录。
        </p>
        <p className="mt-1 text-xs text-subtle">
          盲选模式：参与者抽签前不可见任何数据，详情页提供实时统计。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.name}
            type="button"
            className="h-9 rounded-full border border-border px-3 text-sm text-muted touch-manipulation hover:text-foreground"
            onClick={() => {
              setTitle(tpl.name);
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
        <Input
          value={description}
          maxLength={120}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="备注(可选)：显示在标题下方，如规则、截止时间"
          aria-label="备注"
        />
      </div>

      <div className="flex flex-col gap-3">
        <Label>签位</Label>
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
        <Label>未中兜底</Label>
        <SegmentToggle
          ariaLabel="未中兜底"
          value={blankMode}
          onChange={(v) => setBlankMode(v as typeof blankMode)}
          options={[
            { value: "count", label: "固定数量" },
            { value: "unlimited", label: "不限量" },
            { value: "none", label: "不设置" },
          ]}
        />
        {blankMode !== "none" ? (
          <div className="flex items-center gap-2">
            <Input
              value={blankLabel}
              maxLength={10}
              placeholder="如：谢谢参与"
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

      <div className="flex flex-col gap-3">
        <Label>参与登记</Label>
        <SegmentToggle
          ariaLabel="参与登记"
          value={askName ? "on" : "off"}
          onChange={(v) => setAskName(v === "on")}
          options={[
            { value: "off", label: "不需要" },
            { value: "on", label: "需要填写" },
          ]}
        />
        {askName && !rosterOn ? (
          <div className="flex items-center gap-2">
            <Input
              value={noteLabel}
              maxLength={20}
              placeholder="如：姓名"
              aria-label="登记项名称"
              onChange={(e) => setNoteLabel(e.target.value)}
              className="flex-1"
            />
          </div>
        ) : null}
        {askName && !rosterOn ? (
          <p className="text-xs text-subtle">
            参与者抽签前需填写该项，用于名单核对。
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <Label>名单核对</Label>
        <SegmentToggle
          ariaLabel="名单核对"
          value={rosterOn ? "on" : "off"}
          onChange={(v) => {
            const on = v === "on";
            setRosterOn(on);
            if (on) setAskName(true);
          }}
          options={[
            { value: "off", label: "不使用名单" },
            { value: "on", label: "使用名单" },
          ]}
        />
        {rosterOn ? (
          <>
            <textarea
              value={rosterText}
              rows={4}
              maxLength={8000}
              placeholder={"每行一个姓名，粘贴名单即可，如：\n张三\n李四\n王五"}
              aria-label="名单"
              className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(e) => setRosterText(e.target.value)}
            />
            <p className="text-xs text-subtle">
              已识别 {rosterNames.length} 人。启用后仅名单内人员可抽签，后台实时显示参与情况。
            </p>
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <Label>揭晓方式</Label>
        <div className="flex flex-wrap gap-2">
          {REVEAL_OPTIONS.map((opt) => {
            const on = revealModes.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleRevealMode(opt.id)}
                className={cn(
                  "h-9 rounded-full border px-4 text-sm touch-manipulation transition-colors",
                  on
                    ? "border-accent/40 bg-surface-2 text-foreground"
                    : "border-border text-muted hover:text-foreground",
                )}
              >
                {opt.label}
                <span className="ml-1.5 text-xs text-subtle">{opt.hint}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-subtle">
          可多选，参与者任选其一揭晓；{revealModes.length > 1 ? `已选 ${revealModes.length} 种` : "只选一种时不显示切换条"}。
          无论哪种方式，中奖概率完全一致（结果由服务端统一抽取，动画只是演出）。
        </p>
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
          "发布"
        )}
      </Button>
    </form>
  );
}
