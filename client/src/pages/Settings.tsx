import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Bell, Copy, KeyRound, Loader2, LogOut, RefreshCw, ShieldCheck, Watch } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const CARD = {
  background: "oklch(1 0 0)",
  border: "1px solid oklch(0.92 0.006 250)",
} as const;

const INNER = {
  background: "oklch(0.965 0.004 250)",
  border: "1px solid oklch(0.92 0.006 250)",
} as const;

export default function Settings() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const reminderQ = trpc.reminders.get.useQuery();

  const [mealEnabled, setMealEnabled] = useState(true);
  const [mealTime, setMealTime] = useState("20:00");
  const [weightEnabled, setWeightEnabled] = useState(true);
  const [weightTime, setWeightTime] = useState("08:00");

  useEffect(() => {
    const r = reminderQ.data;
    if (r) {
      setMealEnabled(Boolean(r.mealEnabled));
      setMealTime(r.mealReminderTime ?? "20:00");
      setWeightEnabled(Boolean(r.weightEnabled));
      setWeightTime(r.weightReminderTime ?? "08:00");
    }
  }, [reminderQ.data]);

  const updateM = trpc.reminders.update.useMutation({
    onSuccess: () => {
      utils.reminders.get.invalidate();
      toast.success("リマインダー設定を更新しました");
    },
  });

  const save = async () => {
    await updateM.mutateAsync({
      mealEnabled,
      mealReminderTime: mealTime,
      weightEnabled,
      weightReminderTime: weightTime,
    });
  };

  const requestPerm = async () => {
    if (!("Notification" in window)) {
      toast.error("このブラウザは通知に対応していません");
      return;
    }
    const r = await Notification.requestPermission();
    if (r === "granted") {
      toast.success("通知を許可しました");
      new Notification("通知が有効になりました", {
        body: "毎日この時間にやさしくお知らせします。",
      });
    } else {
      toast.error("通知が許可されませんでした");
    }
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Page Header */}
      <div className="pt-1">
        <div className="section-label mb-1">SETTINGS</div>
        <h1 className="text-2xl font-bold text-slate-900">設定</h1>
      </div>

      {/* アカウント */}
      <div className="rounded-xl px-4 py-4 space-y-3" style={CARD}>
        <div className="flex items-center gap-2 section-label">
          <ShieldCheck className="h-3.5 w-3.5" />
          アカウント
        </div>
        <div className="rounded-xl px-4 py-3" style={INNER}>
          <div className="text-sm font-semibold text-slate-900">{user?.name ?? user?.email ?? "ゲスト"}</div>
          {user?.email && <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>}
        </div>
        <Button
          variant="outline"
          className="h-11 font-medium rounded-xl"
          onClick={() => logout()}
          style={{ background: "oklch(0.965 0.004 250)", border: "1px solid oklch(0.92 0.006 250)", color: "oklch(0.50 0.02 252)" }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          ログアウト
        </Button>
      </div>

      {/* パスワード変更 */}
      <PasswordChangeCard />

      {/* Apple Watch 連携 */}
      <AppleWatchCard />

      {/* 通知リマインダー */}
      <div className="rounded-xl px-4 py-4 space-y-4" style={CARD}>
        <div className="flex items-center gap-2 section-label">
          <Bell className="h-3.5 w-3.5" />
          記録リマインダー
        </div>

        <div
          className="rounded-xl px-4 py-3 text-xs text-muted-foreground leading-relaxed"
          style={{ background: "oklch(0.62 0.18 220 / 0.08)", border: "1px solid oklch(0.58 0.19 254 / 0.12)" }}
        >
          ブラウザを開いている時間に、設定時刻でまだ記録がなければやさしくお知らせします。まずは通知の許可をお願いします。
        </div>

        <Button
          variant="outline"
          className="w-full h-11 font-medium rounded-xl"
          onClick={requestPerm}
          style={{ background: "oklch(0.965 0.004 250)", border: "1px solid oklch(0.92 0.006 250)", color: "oklch(0.50 0.02 252)" }}
        >
          <Bell className="h-4 w-4 mr-2" />
          通知を許可する
        </Button>

        <ReminderRow
          label="食事の記録リマインド"
          enabled={mealEnabled}
          time={mealTime}
          onToggle={setMealEnabled}
          onTimeChange={setMealTime}
        />
        <ReminderRow
          label="体重の記録リマインド"
          enabled={weightEnabled}
          time={weightTime}
          onToggle={setWeightEnabled}
          onTimeChange={setWeightTime}
        />

        <Button
          onClick={save}
          disabled={updateM.isPending}
          className="w-full h-12 font-bold rounded-xl"
        >
          {updateM.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          設定を保存
        </Button>
      </div>
    </div>
  );
}

function ReminderRow({
  label,
  enabled,
  time,
  onToggle,
  onTimeChange,
}: {
  label: string;
  enabled: boolean;
  time: string;
  onToggle: (v: boolean) => void;
  onTimeChange: (v: string) => void;
}) {
  return (
    <div
      className="rounded-xl px-4 py-3 space-y-3"
      style={{
        background: "oklch(0.965 0.004 250)",
        border: "1px solid oklch(0.92 0.006 250)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      <div className="space-y-1.5">
        <Label className="section-label">通知時刻</Label>
        <Input
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          disabled={!enabled}
          className="max-w-[140px] h-10"
        />
      </div>
    </div>
  );
}

/* ── パスワード変更 ── */
function PasswordChangeCard() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const m = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("パスワードを変更しました");
      setCur(""); setNext(""); setConfirm("");
    },
    onError: (e) => toast.error(e.message),
  });
  const submit = () => {
    if (next.length < 6) { toast.error("新しいパスワードは6文字以上にしてください"); return; }
    if (next !== confirm) { toast.error("確認用パスワードが一致しません"); return; }
    m.mutate({ currentPassword: cur, newPassword: next });
  };
  return (
    <div className="rounded-xl px-4 py-4 space-y-3" style={CARD}>
      <div className="flex items-center gap-2 section-label">
        <KeyRound className="h-3.5 w-3.5" />
        パスワード変更
      </div>
      <div className="space-y-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">現在のパスワード</Label>
          <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} className="h-11" autoComplete="current-password" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">新しいパスワード（6文字以上）</Label>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="h-11" autoComplete="new-password" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">新しいパスワード（確認）</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" autoComplete="new-password" />
        </div>
      </div>
      <Button
        className="h-11 w-full font-semibold rounded-xl"
        style={{ background: "oklch(0.38 0.14 268)" }}
        disabled={m.isPending || !cur || !next || !confirm}
        onClick={submit}
      >
        {m.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        パスワードを変更
      </Button>
    </div>
  );
}

/* ── Apple Watch 連携（ショートカットで消費カロリーを自動取り込み）── */
function AppleWatchCard() {
  const tokenQ = trpc.integrations.getToken.useQuery();
  const utils = trpc.useUtils();
  const regenM = trpc.integrations.regenerateToken.useMutation({
    onSuccess: () => {
      utils.integrations.getToken.invalidate();
      toast.success("URLを作り直しました。古いURLは無効になりました。");
    },
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const token = tokenQ.data?.token ?? "";
  const baseUrl = token ? `${origin}/api/health/active-energy?token=${token}` : "";

  const copy = async () => {
    if (!baseUrl) return;
    try {
      await navigator.clipboard.writeText(baseUrl);
      toast.success("URLをコピーしました");
    } catch {
      toast.error("コピーに失敗しました。長押しで選択してください。");
    }
  };

  return (
    <div className="rounded-xl px-4 py-4 space-y-3" style={CARD}>
      <div className="flex items-center gap-2 section-label">
        <Watch className="h-3.5 w-3.5" />
        Apple Watch 連携
      </div>

      <div
        className="rounded-xl px-4 py-3 text-xs text-muted-foreground leading-relaxed"
        style={{ background: "oklch(0.62 0.18 220 / 0.08)", border: "1px solid oklch(0.58 0.19 254 / 0.12)" }}
      >
        iPhoneの「ショートカット」アプリから、Apple Watchのアクティブエネルギー（消費kcal）をKalonに自動で記録できます。
        下のあなた専用URLを使います。<span className="font-semibold text-slate-900">トークンが含まれるので他人に共有しないでください。</span>
      </div>

      {/* 専用URL */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">あなた専用の取り込みURL</Label>
        <div className="rounded-lg px-3 py-2.5 break-all text-[11px] text-slate-900" style={INNER}>
          {tokenQ.isLoading ? "読み込み中…" : baseUrl}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 flex-1 rounded-lg text-xs" disabled={!baseUrl} onClick={copy}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />URLをコピー
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-lg text-xs"
            disabled={regenM.isPending}
            onClick={() => regenM.mutate()}
          >
            {regenM.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* 使い方 */}
      <div className="rounded-xl px-4 py-3 space-y-1.5" style={INNER}>
        <div className="text-xs font-bold text-slate-900">使い方（ショートカット作成）</div>
        <ol className="text-[11px] text-muted-foreground leading-relaxed list-decimal pl-4 space-y-1">
          <li>iPhoneの「ショートカット」アプリ →「+」で新規作成</li>
          <li>アクション「ヘルスケアのサンプルを検索」を追加 → 種類＝<span className="font-semibold text-slate-900">アクティブエネルギー</span>、期間＝<span className="font-semibold text-slate-900">今日</span>、集計＝<span className="font-semibold text-slate-900">合計</span></li>
          <li>アクション「URLの内容を取得」を追加 → URL欄に上のURLを貼り、末尾に <span className="font-semibold text-slate-900">&kcal=</span> を打ってから手順2の結果（合計）を続ける</li>
          <li>実行して「記録しました」が返ればOK（ホームの消費kcalに反映）</li>
          <li>「オートメーション」で毎晩◯時に自動実行にすると、手動操作なしで毎日入ります</li>
        </ol>
        <div className="text-[10px] text-muted-foreground pt-1">
          ※ 同じ日に何度送っても上書きされ、二重計上にはなりません。日付を指定したい場合はURL末尾に &date=2026-06-29 を付けます。
        </div>
      </div>
    </div>
  );
}
