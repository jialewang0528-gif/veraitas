import { createContext, useContext, useState, type ReactNode } from "react";

const STORAGE_KEY = "veraitas.beginner-mode";

// Storage can be missing or throw (private windows, blocked site data), so the mode falls back to on.
export function readBeginnerMode(storage?: Pick<Storage, "getItem">): boolean {
  try {
    // Read the global inside the try: in some browsers merely touching localStorage throws.
    return (storage ?? globalThis.localStorage)?.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function writeBeginnerMode(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // The toggle still works for this visit.
  }
}

const BeginnerContext = createContext<{ beginner: boolean; setBeginner: (on: boolean) => void }>({
  beginner: true,
  setBeginner: () => {},
});

export function BeginnerModeProvider({ children }: { children: ReactNode }) {
  const [beginner, setState] = useState(() => readBeginnerMode());
  function setBeginner(on: boolean) {
    setState(on);
    writeBeginnerMode(on);
  }
  return <BeginnerContext.Provider value={{ beginner, setBeginner }}>{children}</BeginnerContext.Provider>;
}

export function useBeginnerMode() {
  return useContext(BeginnerContext);
}

export function BeginnerToggle() {
  const { beginner, setBeginner } = useBeginnerMode();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={beginner}
      onClick={() => setBeginner(!beginner)}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-edge bg-transparent px-4 py-3 text-left text-text transition-colors duration-200 hover:border-faint"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-[11px] font-bold tracking-[0.14em] uppercase">Beginner Mode</span>
        <span className="text-xs text-muted">{beginner ? "Costs and risks shown" : "Standard view"}</span>
      </span>
      <span
        aria-hidden
        className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 ${beginner ? "bg-text" : "bg-edge"}`}
      >
        <span
          className={`absolute top-[3px] size-4 rounded-full transition-[transform,background-color] duration-200 ease-[var(--ease-out)] ${
            beginner ? "translate-x-[19px] bg-ink" : "translate-x-[3px] bg-text"
          }`}
        />
      </span>
    </button>
  );
}
