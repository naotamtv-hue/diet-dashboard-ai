import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Bell, Loader2, LogOut, ShieldCheck } from "lucide-react";
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
