import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLoginUrl } from "@/const";
import {
  Apple,
  CalendarDays,
  CalendarHeart,
  Camera,
  Dumbbell,
  Home,
  LogOut,
  ShoppingBag,
  Sparkles,
  Target,
  Bell,
  ChevronRight,
} from "lucide-react";
import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { useReminderScheduler } from "@/hooks/useReminderScheduler";

/* ─────────────────────────────────────────────
   Navigation items
───────────────────────────────────────────── */
const BOTTOM_NAV = [
  { path: "/",          label: "ホーム",   icon: Home },
  { path: "/meals",     label: "食事",     icon: Apple },
  { path: "/calendar",  label: "カレンダー", icon: CalendarDays },
  { path: "/weight",    label: "体重",     icon: CalendarHeart },
  { path: "/workouts",  label: "運動",     icon: Dumbbell },
];

const MORE_NAV = [
  { path: "/coach",       label: "AIコーチ",  icon: Sparkles },
  { path: "/convenience", label: "コンビニ",  icon: ShoppingBag },
  { path: "/photos",      label: "体型写真",  icon: Camera },
  { path: "/goal",        label: "目標設定",  icon: Target },
  { path: "/settings",    label: "通知設定",  icon: Bell },
];

const ALL_NAV = [...BOTTOM_NAV, ...MORE_NAV];

/* ─────────────────────────────────────────────
   Layout constants
   HEADER_H: fixed header height
   BOTTOM_NAV_H: fixed bottom nav height (mobile)
   CONTENT_PT: paddingTop for main content = HEADER_H + safe area
───────────────────────────────────────────── */
const HEADER_H = 56;       // px
const BOTTOM_NAV_H = 64;   // px (icon + label)
const CONTENT_PT = HEADER_H + 16; // 72px — header + breathing room

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [location] = useLocation();

  useReminderScheduler(Boolean(user));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const currentLabel = ALL_NAV.find(n => n.path === location)?.label ?? "";

  return (
    <div className="min-h-screen min-h-dvh flex flex-col bg-background">

      {/* ── Fixed Header ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: `${HEADER_H}px`,
          background: "oklch(0.17 0.05 240)",
          borderBottom: "1px solid oklch(0.28 0.04 240)",
          boxShadow: "0 2px 12px oklch(0 0 0 / 0.4)",
        }}
      >
        {/* Brand */}
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer select-none">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: "oklch(0.62 0.18 220)" }}
            >
              D
            </div>
            <span className="font-bold text-base text-white tracking-tight hidden sm:block">
              Diet Atelier
            </span>
            {currentLabel && (
              <span className="font-semibold text-base text-white sm:hidden">
                {currentLabel}
              </span>
            )}
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {ALL_NAV.map((item) => (
            <Link key={item.path} href={item.path}>
              <button
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                  location === item.path
                    ? "bg-primary text-white"
                    : "text-slate-300 hover:text-white hover:bg-white/10"
                }`}
              >
                {item.label}
              </button>
            </Link>
          ))}
        </nav>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="tap-target rounded-full hover:bg-white/10 transition-colors">
              <Avatar className="h-8 w-8 border-2 border-white/20">
                <AvatarFallback
                  className="text-xs font-bold text-white"
                  style={{ background: "oklch(0.62 0.18 220)" }}
                >
                  {user.name?.charAt(0).toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56"
            style={{
              background: "oklch(0.22 0.05 240)",
              border: "1px solid oklch(0.30 0.04 240)",
            }}
          >
            <div className="px-3 py-3 border-b border-border">
              <div className="font-semibold text-sm text-foreground truncate">
                {user.name ?? "ゲスト"}
              </div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {user.email ?? ""}
              </div>
            </div>
            <DropdownMenuItem
              onClick={() => logout()}
              className="cursor-pointer text-destructive focus:text-destructive mt-1 gap-2"
            >
              <LogOut className="h-4 w-4" />
              ログアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* ── Main Content ──
          paddingTop = HEADER_H + 16px = 72px (never hidden behind header)
          paddingBottom = BOTTOM_NAV_H + 8px = 72px (never hidden behind bottom nav on mobile) */}
      <main
        className="flex-1"
        style={{
          paddingTop: `${CONTENT_PT}px`,
          paddingBottom: `${BOTTOM_NAV_H + 8}px`,
        }}
      >
        <div className="max-w-2xl mx-auto px-4 md:px-6">
          {children}
        </div>
      </main>

      {/* ── Bottom Nav (mobile only) ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          height: `${BOTTOM_NAV_H}px`,
          background: "oklch(0.17 0.05 240)",
          borderTop: "1px solid oklch(0.28 0.04 240)",
          boxShadow: "0 -2px 12px oklch(0 0 0 / 0.4)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="grid grid-cols-5 h-full">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const active = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <button
                  className="flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors"
                  aria-label={item.label}
                  style={{ minHeight: "44px" }}
                >
                  <div
                    className={`p-1.5 rounded-xl transition-all duration-150 ${
                      active ? "bg-primary/20" : ""
                    }`}
                  >
                    <Icon
                      style={{
                        width: "1.25rem",
                        height: "1.25rem",
                        color: active ? "oklch(0.62 0.18 220)" : "oklch(0.55 0.03 220)",
                        strokeWidth: active ? 2.5 : 1.8,
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-medium"
                    style={{
                      color: active ? "oklch(0.62 0.18 220)" : "oklch(0.55 0.03 220)",
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Landing Page (unauthenticated)
───────────────────────────────────────────── */
function LandingPage() {
  return (
    <div className="min-h-screen min-h-dvh bg-background">
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center px-5"
        style={{
          height: `${HEADER_H}px`,
          background: "oklch(0.17 0.05 240)",
          borderBottom: "1px solid oklch(0.28 0.04 240)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "oklch(0.62 0.18 220)" }}
          >
            D
          </div>
          <span className="font-bold text-base text-white">Diet Atelier</span>
        </div>
      </header>

      <div
        className="max-w-lg mx-auto px-5 pb-16"
        style={{ paddingTop: `${CONTENT_PT + 24}px` }}
      >
        {/* Hero */}
        <div className="mb-12">
          <div className="section-label mb-3">AI-POWERED DIET MANAGEMENT</div>
          <h1 className="text-3xl font-bold text-white mb-4 leading-tight">
            毎日の食事を記録して、<br />
            理想の体型へ。
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            食事の写真を撮るだけでAIがカロリーとPFCを推定。体重・運動・体型写真まで一元管理。
            目標から逆算した1日の摂取カロリー計画で、着実に減量を進めましょう。
          </p>
        </div>

        {/* Feature List */}
        <div className="space-y-3 mb-12">
          {[
            { title: "AI食事解析", sub: "写真からカロリー・PFCを自動推定", color: "oklch(0.62 0.18 220)" },
            { title: "減量計画の自動算出", sub: "BMR・TDEEから1日の目安kcalを提示", color: "oklch(0.72 0.18 155)" },
            { title: "コンビニAI提案", sub: "残カロリーに合う商品を提案", color: "oklch(0.75 0.18 55)" },
            { title: "ビフォーアフター", sub: "体型写真で変化を実感", color: "oklch(0.68 0.14 290)" },
            { title: "AIパーソナルトレーナー", sub: "目標から週次トレーニングを提案", color: "oklch(0.62 0.18 220)" },
            { title: "記録リマインド", sub: "未記録の日だけそっと通知", color: "oklch(0.72 0.18 155)" },
          ].map(({ title, sub, color }) => (
            <div
              key={title}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
              style={{ background: "oklch(0.20 0.05 240)", border: "1px solid oklch(0.28 0.04 240)" }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">{title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* CTA */}
        <Button
          size="lg"
          className="w-full h-14 text-base font-bold rounded-xl shadow-lg"
          style={{ background: "oklch(0.62 0.18 220)" }}
          onClick={() => { window.location.href = getLoginUrl(); }}
        >
          無料で始める
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Manus アカウントでサインインするだけで利用できます
        </p>
      </div>
    </div>
  );
}
