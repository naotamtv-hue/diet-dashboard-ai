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

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [location] = useLocation();

  // ブラウザ通知のスケジューラーは認証済み時のみ動かす
  useReminderScheduler(Boolean(user));

  useEffect(() => {
    // ページ遷移時にトップへ
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
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/40 border-b border-white/40">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <DecorBracket />
              <div>
                <div className="font-display text-xl leading-none text-primary">
                  Diet Atelier
                </div>
                <div className="text-[10px] tracking-wider-jp text-muted-foreground mt-1">
                  GENTLE DAILY PROGRESS
                </div>
              </div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link key={item.path} href={item.path}>
                <button
                  className={`px-3 py-2 rounded-full text-xs tracking-wider-jp transition-all ${
                    location === item.path
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-primary hover:bg-white/60"
                  }`}
                >
                  {item.label}
                </button>
              </Link>
            ))}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full hover:bg-white/60 transition-colors px-1.5 py-1.5">
                <Avatar className="h-8 w-8 border border-white/80 shadow-sm">
                  <AvatarFallback className="text-xs font-medium bg-secondary text-primary">
                    {user.name?.charAt(0).toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-2 text-xs text-muted-foreground">
                <div className="font-medium text-foreground truncate">
                  {user.name ?? "ゲスト"}
                </div>
                <div className="truncate">{user.email ?? ""}</div>
              </div>
              <DropdownMenuItem
                onClick={() => logout()}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 pb-24 md:pb-10">
        <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
      </main>

      {/* Bottom Nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl bg-white/70 border-t border-white/60">
        <div className="grid grid-cols-5 max-w-md mx-auto">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <button
                  className={`flex flex-col items-center gap-1 py-2.5 px-1 w-full transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] tracking-wider-jp">{item.label}</span>
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
    <div className="relative w-7 h-7">
      <span className="absolute left-0 top-0 w-2 h-px bg-primary/70" />
      <span className="absolute left-0 top-0 w-px h-2 bg-primary/70" />
      <span className="absolute right-0 top-0 w-2 h-px bg-primary/70" />
      <span className="absolute right-0 top-0 w-px h-2 bg-primary/70" />
      <span className="absolute left-0 bottom-0 w-2 h-px bg-primary/70" />
      <span className="absolute left-0 bottom-0 w-px h-2 bg-primary/70" />
      <span className="absolute right-0 bottom-0 w-2 h-px bg-primary/70" />
      <span className="absolute right-0 bottom-0 w-px h-2 bg-primary/70" />
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-24">
        <div className="flex items-center gap-3 mb-10">
          <DecorBracket />
          <div>
            <div className="font-display text-2xl text-primary leading-none">
              Diet Atelier
            </div>
            <div className="text-[10px] tracking-wider-jp text-muted-foreground mt-1">
              GENTLE DAILY PROGRESS
            </div>
          </div>
        </div>

        <h1 className="font-display text-4xl md:text-6xl leading-tight text-primary mb-4">
          静かに、確かに。
          <br />
          続けられる減量習慣を。
        </h1>
        <p className="text-sm md:text-base text-muted-foreground tracking-wide max-w-xl mb-10 leading-relaxed">
          食事の写真を送るだけでAIがPFCとカロリーを推定。体重・運動・体型写真まで一つに。
          目標から逆算した1日の目安カロリーと減量計画を、毎日そっと支えます。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
          {[
            ["AI食事解析", "写真からPFCを自動推定"],
            ["減量計画の自動算出", "BMR・TDEEから1日の目安kcalを提示"],
            ["コンビニAI提案", "残カロリーに合う1食を提案"],
            ["ビフォーアフター", "体型写真で変化を実感"],
            ["AIパーソナルトレーナー", "目標から週次メニューを提案"],
            ["記録リマインド", "未記録の日だけそっと通知"],
          ].map(([t, s]) => (
            <div
              key={t}
              className="bg-white/60 border border-white/70 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-sm"
            >
              <div className="font-display text-lg text-primary">{t}</div>
              <div className="text-xs text-muted-foreground mt-1 tracking-wide">{s}</div>
            </div>
          ))}
        </div>

        <Button
          size="lg"
          className="rounded-full px-8 shadow-lg"
          onClick={() => {
            window.location.href = getLoginUrl();
          }}
        >
          無料で始める
        </Button>
        <div className="text-xs text-muted-foreground mt-3 tracking-wider-jp">
          Manus アカウントでサインインするだけで利用できます。
        </div>
      </div>
    </div>
  );
}
