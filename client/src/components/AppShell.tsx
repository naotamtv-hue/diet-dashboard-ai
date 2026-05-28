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
  CalendarHeart,
  Camera,
  Dumbbell,
  Home,
  LogOut,
  ShoppingBag,
  Sparkles,
  Target,
  Bell,
} from "lucide-react";
import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { useReminderScheduler } from "@/hooks/useReminderScheduler";

const NAV_ITEMS = [
  { path: "/", label: "ホーム", icon: Home },
  { path: "/meals", label: "食事", icon: Apple },
  { path: "/weight", label: "体重", icon: CalendarHeart },
  { path: "/workouts", label: "運動", icon: Dumbbell },
  { path: "/coach", label: "AIコーチ", icon: Sparkles },
  { path: "/convenience", label: "コンビニ", icon: ShoppingBag },
  { path: "/photos", label: "体型写真", icon: Camera },
  { path: "/goal", label: "目標", icon: Target },
  { path: "/settings", label: "通知設定", icon: Bell },
];

/* ── Header height constants ── */
const HEADER_H = 64; // px — keep in sync with header py/h values below

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [location] = useLocation();

  useReminderScheduler(Boolean(user));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground tracking-wider-jp text-sm">
          読み込み中...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Sticky Header ── */}
      <header
        className="sticky top-0 z-30"
        style={{
          height: `${HEADER_H}px`,
          background: "oklch(1 0 0 / 0.72)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          borderBottom: "1px solid oklch(1 0 0 / 0.7)",
          boxShadow: "0 1px 0 oklch(0.35 0.08 290 / 0.06), 0 4px 16px oklch(0.35 0.08 290 / 0.04)",
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-full">
          {/* Brand */}
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer select-none">
              <DecorBracket />
              <div>
                <div className="font-display text-xl leading-none" style={{ color: "oklch(0.35 0.08 290)" }}>
                  Diet Atelier
                </div>
                <div className="text-[9px] tracking-wider-jp text-muted-foreground mt-0.5 font-medium">
                  GENTLE DAILY PROGRESS
                </div>
              </div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => (
              <Link key={item.path} href={item.path}>
                <button
                  className={`px-3.5 py-2 rounded-full text-xs tracking-wider-jp font-medium transition-all duration-150 ${
                    location === item.path
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/8"
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
              <button className="flex items-center gap-2 rounded-full transition-colors px-1.5 py-1.5 hover:bg-primary/8">
                <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
                  <AvatarFallback
                    className="text-xs font-semibold"
                    style={{ background: "oklch(0.93 0.04 290)", color: "oklch(0.38 0.09 290)" }}
                  >
                    {user.name?.charAt(0).toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2.5 border-b border-border/50">
                <div className="font-semibold text-sm text-foreground truncate">
                  {user.name ?? "ゲスト"}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{user.email ?? ""}</div>
              </div>
              <DropdownMenuItem
                onClick={() => logout()}
                className="cursor-pointer text-destructive focus:text-destructive mt-1"
              >
                <LogOut className="mr-2 h-4 w-4" />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Main Content ──
          pt-6 on mobile, pt-8 on md — provides breathing room below the sticky header */}
      <main className="flex-1 pb-28 md:pb-12">
        <div className="max-w-6xl mx-auto px-4 pt-8 md:pt-10">
          {children}
        </div>
      </main>

      {/* ── Bottom Nav (mobile only) ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40"
        style={{
          background: "oklch(1 0 0 / 0.82)",
          backdropFilter: "blur(24px) saturate(1.4)",
          WebkitBackdropFilter: "blur(24px) saturate(1.4)",
          borderTop: "1px solid oklch(1 0 0 / 0.7)",
          boxShadow: "0 -1px 0 oklch(0.35 0.08 290 / 0.06), 0 -4px 16px oklch(0.35 0.08 290 / 0.04)",
        }}
      >
        <div className="grid grid-cols-5 max-w-md mx-auto">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <button
                  className={`flex flex-col items-center gap-1 py-3 px-1 w-full transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                  aria-label={item.label}
                >
                  <div className={`p-1.5 rounded-xl transition-all ${active ? "bg-primary/10" : ""}`}>
                    <Icon className={`h-4.5 w-4.5 ${active ? "stroke-[2.2]" : "stroke-[1.8]"}`} style={{ width: "1.125rem", height: "1.125rem" }} />
                  </div>
                  <span className={`text-[9.5px] tracking-wider-jp font-medium ${active ? "text-primary" : ""}`}>
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

function DecorBracket() {
  return (
    <div className="relative w-6 h-6 flex-shrink-0">
      <span className="absolute left-0 top-0 w-2 h-px bg-primary/60" />
      <span className="absolute left-0 top-0 w-px h-2 bg-primary/60" />
      <span className="absolute right-0 top-0 w-2 h-px bg-primary/60" />
      <span className="absolute right-0 top-0 w-px h-2 bg-primary/60" />
      <span className="absolute left-0 bottom-0 w-2 h-px bg-primary/60" />
      <span className="absolute left-0 bottom-0 w-px h-2 bg-primary/60" />
      <span className="absolute right-0 bottom-0 w-2 h-px bg-primary/60" />
      <span className="absolute right-0 bottom-0 w-px h-2 bg-primary/60" />
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Landing Header */}
      <div
        className="sticky top-0 z-30 px-6 py-4 flex items-center gap-3"
        style={{
          background: "oklch(1 0 0 / 0.65)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid oklch(1 0 0 / 0.6)",
        }}
      >
        <DecorBracket />
        <div>
          <div className="font-display text-xl leading-none" style={{ color: "oklch(0.35 0.08 290)" }}>
            Diet Atelier
          </div>
          <div className="text-[9px] tracking-wider-jp text-muted-foreground mt-0.5 font-medium">
            GENTLE DAILY PROGRESS
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-16 pb-28">
        {/* Hero */}
        <div className="mb-14">
          <div className="page-label mb-4">AI-POWERED DIET MANAGEMENT</div>
          <h1
            className="font-display leading-tight mb-5"
            style={{ fontSize: "clamp(2.25rem, 7vw, 3.5rem)", color: "oklch(0.32 0.09 290)" }}
          >
            静かに、確かに。<br />
            続けられる<br className="sm:hidden" />減量習慣を。
          </h1>
          <p className="text-sm md:text-base text-muted-foreground tracking-wide max-w-lg leading-relaxed">
            食事の写真を送るだけでAIがPFCとカロリーを推定。体重・運動・体型写真まで一つに。
            目標から逆算した1日の目安カロリーと減量計画を、毎日そっと支えます。
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-14">
          {[
            { title: "AI食事解析", sub: "写真からPFC・カロリーを自動推定", icon: "✦" },
            { title: "減量計画の自動算出", sub: "BMR・TDEEから1日の目安kcalを提示", icon: "◈" },
            { title: "コンビニAI提案", sub: "残カロリーに合う1食を提案", icon: "◉" },
            { title: "ビフォーアフター", sub: "体型写真で変化を実感", icon: "◎" },
            { title: "AIパーソナルトレーナー", sub: "目標から週次メニューを提案", icon: "◆" },
            { title: "記録リマインド", sub: "未記録の日だけそっと通知", icon: "◇" },
          ].map(({ title, sub, icon }) => (
            <div
              key={title}
              className="glass-card px-5 py-4 group hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start gap-3">
                <span className="text-primary/60 text-lg mt-0.5 font-light">{icon}</span>
                <div>
                  <div className="font-display text-base" style={{ color: "oklch(0.35 0.08 290)" }}>
                    {title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 tracking-wide">{sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-start gap-3">
          <Button
            size="lg"
            className="rounded-full px-10 h-12 text-sm tracking-wider-jp font-medium shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => { window.location.href = getLoginUrl(); }}
          >
            無料で始める
          </Button>
          <p className="text-xs text-muted-foreground tracking-wider-jp">
            Manus アカウントでサインインするだけで利用できます。
          </p>
        </div>
      </div>
    </div>
  );
}
