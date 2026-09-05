import { useEffect, useRef, useState } from "react";

/**
 * Tween a number toward `target` so live vote counts glide instead of jump.
 * Rounding is applied per frame, so the rendered value always lands exactly
 * on `target`. Server render and first client render show `target` directly —
 * no hydration mismatch.
 */
export function useCountUp(target: number, duration = 400): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (target - from) * eased);
      fromRef.current = current;
      setValue(current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
