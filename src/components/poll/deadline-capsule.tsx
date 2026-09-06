import { useEffect, useState } from "react";
import { beautOn } from "@/lib/beautify";

/** 截止倒计时胶囊(美化4):标题旁显示剩余 天/时/分,临近 1 小时变红。 */
export function DeadlineCapsule({ closesAt }: { closesAt: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const ms = closesAt - now;
  if (ms <= 0) return null;
  if (!beautOn("b4")) return null;

  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.ceil((ms % 3_600_000) / 60_000);
  const urgent = ms < 3_600_000;

  return (
    <span className="deadline-capsule">
      {days > 0 ? `${days} 天 ` : ""}
      {hours > 0 ? `${hours} 时 ` : ""}
      {!days && `${mins} 分`}
      <span className={urgent ? "urgent" : ""}>后截止</span>
    </span>
  );
}
