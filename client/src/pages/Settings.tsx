import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Bell, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
    <div className="space-y-5">
      <div>
        <div className="text-[11px] tracking-wider-jp text-muted-foreground">SETTINGS</div>
        <h1 className="font-display text-3xl text-primary mt-1">設定</h1>
      </div>

      {/* アカウント */}
      <Card className="p-4 bg-white/70 border-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] tracking-wider-jp text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          アカウント
        </div>
        <div className="mt-2 text-sm text-foreground">
          {user?.name ?? user?.email ?? "ゲスト"}
        </div>
        <div className="text-[11px] text-muted-foreground">{user?.email}</div>
        <Button
          variant="outline"
          className="bg-white/60 rounded-full mt-3"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4 mr-2" />
          ログアウト
        </Button>
      </Card>

      {/* 通知 */}
      <Card className="p-4 bg-white/70 border-white/70 backdrop-blur-sm space-y-3">
        <div className="flex items-center gap-2 text-[11px] tracking-wider-jp text-muted-foreground">
          <Bell className="h-3.5 w-3.5" />
          記録リマインダー
        </div>

        <div className="rounded-2xl bg-secondary/30 border border-white/70 px-3 py-2 text-[11px] text-foreground/80">
          ブラウザを開いている時間に、設定時刻でまだ記録がなければやさしくお知らせします。
          まずは通知の許可をお願いします。
        </div>

        <Button
          variant="outline"
          className="bg-white/60 rounded-full w-full"
          onClick={requestPerm}
        >
          <Bell className="h-4 w-4 mr-2" />
          通知を許可する
        </Button>

        <Row
          label="食事の記録リマインド"
          enabled={mealEnabled}
          time={mealTime}
          onToggle={setMealEnabled}
          onTimeChange={setMealTime}
        />
        <Row
          label="体重の記録リマインド"
          enabled={weightEnabled}
          time={weightTime}
          onToggle={setWeightEnabled}
          onTimeChange={setWeightTime}
        />

        <Button
          onClick={save}
          disabled={updateM.isPending}
          className="w-full rounded-full"
        >
          {updateM.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          保存
        </Button>
      </Card>
    </div>
  );
}

function Row({
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
    <div className="rounded-2xl bg-white/50 border border-white/70 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-foreground">{label}</div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      <div className="mt-2">
        <Label className="text-[10px] tracking-wider-jp">通知時刻</Label>
        <Input
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          className="bg-white/70"
          disabled={!enabled}
        />
      </div>
    </div>
  );
}
