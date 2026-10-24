import { useEffect, useRef, useState } from "react";

export const HOLD_MS = 1200;

// Fraction of the hold completed, clamped to 0..1.
export function holdProgress(
  startedAt: number | null,
  now: number,
  duration = HOLD_MS,
): number {
  if (startedAt === null) return 0;
  return Math.min(1, Math.max(0, (now - startedAt) / duration));
}

// Press and hold for `duration` to fire `onComplete` once; releasing early cancels. Real money moves on
// completion, so the hold also cancels when the window loses focus or the page is hidden, when `resetKey`
// changes (a new amount, token or quote), and it fires at most once until `disabled` clears.
export function useHold(onComplete: () => void, disabled: boolean, resetKey = "", duration = HOLD_MS) {
  const [progress, setProgress] = useState(0);
  const started = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const fired = useRef(false);
  const done = useRef(onComplete);
  const blocked = useRef(disabled);
  done.current = onComplete;
  blocked.current = disabled;

  function stop() {
    started.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setProgress(0);
  }

  function tick() {
    const p = holdProgress(started.current, performance.now(), duration);
    setProgress(p);
    if (p >= 1) {
      stop();
      if (blocked.current || fired.current) return;
      fired.current = true;
      done.current();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  }

  function start() {
    if (blocked.current || fired.current || started.current !== null) return;
    started.current = performance.now();
    frame.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    const cancel = () => stop();
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      stop();
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", cancel);
    };
  }, []);
  useEffect(() => {
    if (disabled) stop();
    else fired.current = false;
  }, [disabled]);
  useEffect(() => {
    stop();
    fired.current = false;
  }, [resetKey]);

  return { progress, start, stop };
}
