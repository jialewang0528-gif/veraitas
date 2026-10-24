import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeftRight, House, LogOut, Plus, Send, Waves, type LucideIcon } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router";
import { api, ApiError, useMe } from "../api.ts";
import { BeginnerToggle, useBeginnerMode } from "../beginner.tsx";
import type { Profile } from "../types.ts";
import { Banner, Button, Logo, Spinner, Wordmark } from "./ui.tsx";

// Beginner screens only show in Beginner Mode; with it off this is a plain trading app.
const NAV: { to: string; label: string; icon: LucideIcon; beginner?: true }[] = [
  { to: "/", label: "Home", icon: House },
  { to: "/trade", label: "Trade", icon: ArrowLeftRight },
  { to: "/swing-check", label: "Swing Check", icon: Waves, beginner: true },
  { to: "/add-funds", label: "Add funds", icon: Plus },
  { to: "/send", label: "Send", icon: Send },
  { to: "/activity", label: "Activity", icon: Activity },
];

function CustomerCard({ email }: { email: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await api("/api/logout", { method: "POST" });
    queryClient.clear();
    navigate("/login", { replace: true });
  }

  return (
    <div className="mt-auto flex items-center gap-2.5 rounded-[18px] border border-edge bg-panel p-3.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-edge text-[13px] font-bold uppercase">
        {email.slice(0, 2)}
      </div>
      <span className="min-w-0 flex-1 truncate text-xs text-muted" title={email}>
        {email}
      </span>
      <button type="button" onClick={signOut} aria-label="Sign out" className="flex text-muted hover:text-text">
        <LogOut aria-hidden className="size-[18px]" />
      </button>
    </div>
  );
}

export function AppShell() {
  const me = useMe();
  const { beginner } = useBeginnerMode();

  if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to="/login" replace />;
  if (me.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (me.error) {
    return (
      <div className="mx-auto max-w-lg p-12">
        <Banner tone="error" title="VerAItas is unreachable">
          {me.error.message}
        </Banner>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-[1100px]">
      <aside className="flex w-[232px] shrink-0 flex-col gap-7 border-r border-line bg-night px-4 py-6">
        <Logo />
        <nav className="flex flex-col gap-1">
          {NAV.filter((item) => beginner || !item.beginner).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `group relative flex h-11 items-center gap-3 rounded-full px-4 text-[11px] font-bold tracking-[0.1em] whitespace-nowrap uppercase no-underline transition-colors duration-200 ${
                  isActive ? "bg-line text-text hover:text-text" : "text-muted hover:text-text"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon aria-hidden strokeWidth={1.5} className="size-[17px]" />
                  {label}
                  <span
                    aria-hidden
                    className={`ml-auto text-sm transition-[opacity,transform] duration-300 ease-[var(--ease-out)] ${
                      isActive ? "opacity-100" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60"
                    }`}
                  >
                    →
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <BeginnerToggle />
          <CustomerCard email={me.data.email} />
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="page-enter flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// Obys-style corner captions pinned to a full-bleed panel.
function Corner({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`absolute text-[10px] leading-3 font-medium tracking-[0.18em] text-muted uppercase ${className}`}>{children}</span>
  );
}

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-full grid-cols-[1.25fr_1fr]">
      <section className="relative flex flex-col justify-end overflow-hidden border-r border-line bg-night px-14 pt-24 pb-16">
        <div aria-hidden className="dot-grid absolute inset-0" />
        <Corner className="top-8 left-14">Trading, said plainly</Corner>
        <Corner className="top-8 right-10">Solana · Base</Corner>
        <Corner className="right-10 bottom-8">On True Markets Gateway</Corner>
        <h1 className="relative m-0 text-[clamp(64px,8vw,124px)]">
          <Wordmark animate />
        </h1>
        <p className="relative m-0 mt-8 max-w-[22ch] text-[clamp(26px,2.6vw,40px)] leading-[1.08] font-bold tracking-[-0.03em]">
          Know the full cost <span className="text-muted">before</span> your money moves.
        </p>
      </section>
      <section className="flex items-center justify-center p-12">
        <div className="page-enter flex w-[380px] flex-col gap-7">
          <div className="flex flex-col gap-2">
            <h2 className="m-0 font-display text-[30px] leading-[1.1] font-bold tracking-[-0.02em]">{title}</h2>
            <p className="m-0 text-[15px] text-muted">{subtitle}</p>
          </div>
          {children}
          <p className="m-0 text-xs leading-relaxed text-faint">VerAItas is a demo neobank running on True Markets gateway rails.</p>
        </div>
      </section>
    </div>
  );
}

const INPUT =
  "h-12 rounded-[14px] border border-edge bg-transparent px-4 text-base text-text outline-none transition-colors duration-200 hover:border-faint focus:border-text";

export function CredentialsForm({
  endpoint,
  submitLabel,
  newPassword,
}: {
  endpoint: "/api/signup" | "/api/login";
  submitLabel: string;
  newPassword: boolean;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const submit = useMutation({
    mutationFn: (body: { email: string; password: string }) => api<Profile>(endpoint, { method: "POST", body }),
    onSuccess: (profile) => {
      queryClient.setQueryData(["me"], profile);
      navigate("/", { replace: true });
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submit.mutate({ email: String(form.get("email")), password: String(form.get("password")) });
  }

  return (
    <form onSubmit={onSubmit} className="m-0 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-[11px] font-bold tracking-[0.14em] text-muted uppercase">
        Email
        <input name="email" type="email" required autoComplete="email" className={INPUT} />
      </label>
      <label className="flex flex-col gap-2 text-[11px] font-bold tracking-[0.14em] text-muted uppercase">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={newPassword ? 8 : undefined}
          autoComplete={newPassword ? "new-password" : "current-password"}
          className={INPUT}
        />
      </label>
      {submit.error && <p role="alert" className="m-0 text-sm text-down">{submit.error.message}</p>}
      <Button type="submit" disabled={submit.isPending} className="h-[52px]">
        {submit.isPending ? "One moment…" : submitLabel}
      </Button>
    </form>
  );
}

export function Page({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <>
      <header className="flex items-center justify-between gap-6">
        <div className="flex items-baseline gap-4">
          <h1 className="m-0 font-display text-[26px] leading-none font-bold tracking-[-0.02em]">{title}</h1>
          <p className="m-0 text-[13px] text-muted">{subtitle}</p>
        </div>
        <span className="flex h-8 shrink-0 items-center gap-2.5 rounded-full border border-edge px-3.5 text-[10px] font-bold tracking-[0.14em] text-text uppercase">
          <span className="live-dot" />
          Markets open · 24/7
        </span>
      </header>
      {children}
    </>
  );
}
