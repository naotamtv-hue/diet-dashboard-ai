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
  UtensilsCrossed,
  BookOpen,
  TrendingUp,
  LayoutGrid,
  Plus,
  Scale,
  Salad,
  X,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import ThunderIcon from "./ThunderIcon";
import { trpc } from "@/lib/trpc";
import { todayDateString } from "@/lib/labels";
import { useReminderScheduler } from "@/hooks/useReminderScheduler";

/* ─────────────────────────────────────────────
   Navigation items
───────────────────────────────────────────── */
// MyFitnessPal風ボトムナビ: ホーム / 日記 / 中央＋ / 進捗 / その他
const BOTTOM_NAV = [
  { path: "/",         label: "ホーム", icon: Home },
  { path: "/meals",    label: "日記",   icon: BookOpen },
  { path: "/mypersol", label: "MYPERSOL", icon: Salad },
];

// 中央＋のクイック追加メニュー
const QUICK_ADD = [
  { path: "/meals",    label: "食事を記録", icon: Apple,    color: "oklch(0.38 0.14 268)" },
  { path: "/workouts", label: "運動を記録", icon: Dumbbell, color: "oklch(0.72 0.18 130)" },
  { path: "/weight",   label: "体重を記録", icon: Scale,    color: "oklch(0.75 0.18 55)" },
  { path: "/photos",   label: "体型写真",   icon: Camera,   color: "oklch(0.68 0.14 290)" },
];

// 「その他」シートに並べる全機能
const MORE_NAV = [
  { path: "/mypersol",    label: "MYPERSOL", icon: Salad },
  { path: "/weight",      label: "進捗（体重）", icon: TrendingUp },
  { path: "/trainer",     label: "AI食事トレーナー", icon: UtensilsCrossed },
  { path: "/coach",       label: "AIパーソナルトレーナー", icon: Sparkles },
  { path: "/workouts",    label: "運動",     icon: Dumbbell },
  { path: "/strength",    label: "筋トレ",    icon: Dumbbell },
  { path: "/convenience", label: "コンビニ",  icon: ShoppingBag },
  { path: "/calendar",    label: "カレンダー", icon: CalendarDays },
  { path: "/photos",      label: "体型写真",  icon: Camera },
  { path: "/goal",        label: "目標設定",  icon: Target },
  { path: "/settings",    label: "設定",  icon: Bell },
];

const ALL_NAV = [
  ...BOTTOM_NAV,
  { path: "/workouts", label: "運動" },
  ...MORE_NAV,
];

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
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const streakQ = trpc.stats.streak.useQuery(
    { today: todayDateString() },
    { enabled: Boolean(user), staleTime: 60_000 }
  );

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
          background: "oklch(1 0 0)",
          borderBottom: "1px solid oklch(0.92 0.006 250)",
          boxShadow: "0 2px 12px oklch(0 0 0 / 0.08)",
        }}
      >
        {/* Brand */}
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer select-none">
            <img src="/kalon-logo.png" alt="Kalon" className="w-8 h-8 object-contain" />
            <span className="font-bold text-base tracking-tight hidden sm:block" style={{ color: "#1e2a78" }}>
              Kalon
            </span>
            {currentLabel && (
              <span className="font-semibold text-base text-slate-900 sm:hidden">
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
                    ? "bg-primary text-slate-900"
                    : "text-slate-300 hover:text-slate-900 hover:bg-white/10"
                }`}
              >
                {item.label}
              </button>
            </Link>
          ))}
        </nav>

        {/* 右上：連続記録日数 ＋ User Menu */}
        <div className="flex items-center gap-2">
          {streakQ.data && streakQ.data.streak > 0 && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full"
              style={{ background: "oklch(0.96 0.03 55)", border: "1px solid oklch(0.88 0.06 55)" }}
              title={`${streakQ.data.streak}日連続で記録中`}
            >
              <ThunderIcon className="h-4 w-4" />
              <span className="text-xs font-bold" style={{ color: "oklch(0.58 0.16 45)" }}>{streakQ.data.streak}</span>
            </div>
          )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="tap-target rounded-full hover:bg-white/10 transition-colors">
              <Avatar className="h-8 w-8 border-2 border-white/20">
                <AvatarFallback
                  className="text-xs font-bold text-white"
                  style={{ background: "oklch(0.38 0.14 268)" }}
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
              background: "oklch(1 0 0)",
              border: "1px solid oklch(0.92 0.006 250)",
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
        </div>
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

      {/* ── Bottom Nav (mobile only) — MyFitnessPal風 ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          height: `${BOTTOM_NAV_H}px`,
          background: "oklch(1 0 0)",
          borderTop: "1px solid oklch(0.92 0.006 250)",
          boxShadow: "0 -2px 12px oklch(0 0 0 / 0.08)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="grid grid-cols-5 h-full items-center">
          {/* 左2つ: ホーム / 日記 */}
          {BOTTOM_NAV.slice(0, 2).map((item) => (
            <NavTab key={item.path} item={item} active={location === item.path} />
          ))}

          {/* 中央: ＋ クイック追加（浮き出しFAB） */}
          <div className="flex items-center justify-center">
            <button
              onClick={() => setQuickOpen(true)}
              aria-label="追加"
              className="flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-transform"
              style={{
                width: "52px",
                height: "52px",
                marginTop: "-22px",
                background: "oklch(0.38 0.14 268)",
                boxShadow: "0 6px 16px oklch(0.58 0.19 254 / 0.45)",
              }}
            >
              <Plus className="h-7 w-7 text-white" strokeWidth={2.5} />
            </button>
          </div>

          {/* 右2つ: 進捗 / その他 */}
          <NavTab item={BOTTOM_NAV[2]} active={location === BOTTOM_NAV[2].path} />
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 w-full h-full"
            aria-label="その他"
            style={{ minHeight: "44px" }}
          >
            <div className="p-1.5 rounded-xl">
              <LayoutGrid style={{ width: "1.25rem", height: "1.25rem", color: "oklch(0.58 0.02 252)", strokeWidth: 1.8 }} />
            </div>
            <span className="text-[10px] font-medium" style={{ color: "oklch(0.58 0.02 252)" }}>その他</span>
          </button>
        </div>
      </nav>

      {/* ── クイック追加シート ── */}
      <BottomSheet open={quickOpen} onClose={() => setQuickOpen(false)} title="記録する">
        <div className="grid grid-cols-4 gap-3 px-2 pb-2">
          {QUICK_ADD.map((q) => {
            const Icon = q.icon;
            return (
              <Link key={q.label} href={q.path}>
                <button
                  onClick={() => setQuickOpen(false)}
                  className="flex flex-col items-center gap-2 w-full"
                >
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: q.color }}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 text-center leading-tight">{q.label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </BottomSheet>

      {/* ── その他シート ── */}
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="メニュー">
        <div className="grid grid-cols-3 gap-3 px-1 pb-2">
          {MORE_NAV.map((item) => {
            const Icon = item.icon;
            const active = location === item.path;
            return (
              <Link key={item.label} href={item.path}>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-2 w-full py-3 rounded-2xl"
                  style={active ? { background: "oklch(0.95 0.03 268)" } : undefined}
                >
                  <Icon className="h-6 w-6" style={{ color: active ? "oklch(0.38 0.14 268)" : "oklch(0.45 0.02 252)" }} />
                  <span className="text-[11px] font-medium text-slate-700 text-center leading-tight">{item.label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}

/* ── ボトムナビのタブ ── */
function NavTab({ item, active }: { item: { path: string; label: string; icon: typeof Home }; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.path}>
      <button
        className="flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors"
        aria-label={item.label}
        style={{ minHeight: "44px" }}
      >
        <div className={`p-1.5 rounded-xl transition-all duration-150 ${active ? "bg-primary/20" : ""}`}>
          <Icon
            style={{
              width: "1.25rem",
              height: "1.25rem",
              color: active ? "oklch(0.38 0.14 268)" : "oklch(0.58 0.02 252)",
              strokeWidth: active ? 2.5 : 1.8,
            }}
          />
        </div>
        <span className="text-[10px] font-medium" style={{ color: active ? "oklch(0.38 0.14 268)" : "oklch(0.58 0.02 252)" }}>
          {item.label}
        </span>
      </button>
    </Link>
  );
}

/* ── 下から出るシート ── */
function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-3xl px-4 pt-3 pb-8 animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 px-1">
          <span className="text-base font-bold text-slate-900">{title}</span>
          <button onClick={onClose} aria-label="閉じる" className="p-1 text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
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
          background: "oklch(1 0 0)",
          borderBottom: "1px solid oklch(0.92 0.006 250)",
        }}
      >
        <div className="flex items-center gap-2">
          <img src="/kalon-logo.png" alt="Kalon" className="w-8 h-8 object-contain" />
          <span className="font-bold text-base" style={{ color: "#1e2a78" }}>Kalon</span>
        </div>
      </header>

      <div
        className="max-w-lg mx-auto px-5 pb-16"
        style={{ paddingTop: `${CONTENT_PT + 24}px` }}
      >
        {/* Hero */}
        <div className="mb-12">
          <div className="section-label mb-3">KALON · 食べる・鍛える・整える</div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4 leading-tight">
            食事とトレーニングを、<br />
            ひとつに。
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            理想の身体を、記録からつくる。食事の写真やパッケージからAIがカロリー・PFCを推定し、
            体重・運動・筋トレまで一元管理。目標から逆算した毎日のプランで、無理なく整えていきましょう。
          </p>
        </div>

        {/* Feature List */}
        <div className="space-y-3 mb-12">
          {[
            { title: "AI食事解析", sub: "写真からカロリー・PFCを自動推定", color: "oklch(0.38 0.14 268)" },
            { title: "減量計画の自動算出", sub: "基礎代謝から1日の目安カロリーを自動計算", color: "oklch(0.72 0.18 130)" },
            { title: "コンビニAI提案", sub: "残カロリーに合う商品を提案", color: "oklch(0.75 0.18 55)" },
            { title: "ビフォーアフター", sub: "体型写真で変化を実感", color: "oklch(0.68 0.14 290)" },
            { title: "AIパーソナルトレーナー", sub: "目標から週次トレーニングを提案", color: "oklch(0.38 0.14 268)" },
            { title: "記録リマインド", sub: "未記録の日だけそっと通知", color: "oklch(0.72 0.18 130)" },
          ].map(({ title, sub, color }) => (
            <div
              key={title}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
              style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 250)" }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* Auth card */}
        <AuthCard />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Auth card — email + password sign in / sign up
───────────────────────────────────────────── */
function AuthCard() {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      setError(null);
      await utils.auth.me.invalidate();
    },
    onError: (e) => setError(e.message),
  });
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      setError(null);
      // 新規登録直後は目標設定へ誘導（最初に目標を入れると以降の数字が活きる）
      navigate("/goal");
      await utils.auth.me.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const pending = loginMutation.isPending || registerMutation.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "login") {
      loginMutation.mutate({ email, password });
    } else {
      registerMutation.mutate({ email, password, name: name || undefined });
    }
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 250)" }}
    >
      {/* ブランド */}
      <div className="flex flex-col items-center text-center mb-5">
        <img src="/kalon-logo.png" alt="Kalon" className="w-16 h-16 object-contain" />
        <div className="text-xl font-bold mt-1" style={{ color: "#1e2a78" }}>Kalon</div>
        <div className="text-xs text-muted-foreground mt-1">食事とトレーニングを、ひとつに。</div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 mb-5 rounded-xl" style={{ background: "oklch(1 0 0)" }}>
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); }}
            className="py-2 rounded-lg text-sm font-semibold transition-colors"
            style={
              mode === m
                ? { background: "oklch(0.38 0.14 268)", color: "white" }
                : { color: "oklch(0.55 0.02 252)" }
            }
          >
            {m === "login" ? "ログイン" : "新規登録"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "register" && (
          <Input
            type="text"
            placeholder="ニックネーム（任意）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
          />
        )}
        <Input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Input
          type="password"
          placeholder={mode === "register" ? "パスワード（6文字以上）" : "パスワード"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          required
        />

        {error && (
          <p className="text-xs text-center" style={{ color: "oklch(0.7 0.18 25)" }}>
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="w-full h-13 text-base font-bold rounded-xl shadow-lg"
          style={{ background: "oklch(0.38 0.14 268)" }}
        >
          {pending ? "処理中..." : mode === "login" ? "ログイン" : "無料で始める"}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-3">
        {mode === "login" ? "アカウントをお持ちでない方は「新規登録」へ" : "登録するだけですぐに使えます"}
      </p>
    </div>
  );
}
