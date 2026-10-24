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

// Press and hold for `duration` to fire `onComplete` once; releasing early cancels.
export function useHold(
  onComplete: () => void,
  disabled: boolean,
  duration = HOLD_MS,
) {
  const [progress, setProgress] = useState(0);
  const started = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const done = useRef(onComplete);
  done.current = onComplete;

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
      done.current();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  }

  function start() {
    if (disabled || started.current !== null) return;
    started.current = performance.now();
    frame.current = requestAnimationFrame(tick);
  }

  useEffect(() => stop, []);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);

  return { progress, start, stop };
}
