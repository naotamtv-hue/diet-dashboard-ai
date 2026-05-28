import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INTENSITY_LABELS, todayDateString } from "@/lib/labels";
import { trpc } from "@/lib/trpc";
import { Dumbbell, Flame, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Workouts() {
  const [date, setDate] = useState(todayDateString());
  const [activity, setActivity] = useState("");
  const [intensity, setIntensity] = useState<"low" | "medium" | "high">("medium");
  const [durationMin, setDurationMin] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const [note, setNote] = useState("");

  const utils = trpc.useUtils();
  const listQ = trpc.workouts.listByDate.useQuery({ date });
  const addM = trpc.workouts.add.useMutation({
    onSuccess: () => utils.workouts.listByDate.invalidate({ date }),
  });
  const removeM = trpc.workouts.remove.useMutation({
    onSuccess: () => utils.workouts.listByDate.invalidate({ date }),
  });

  const submit = async () => {
    if (!activity.trim()) {
      toast.error("種目名を入力してください");
      return;
    }
    await addM.mutateAsync({
      date,
      activity: activity.trim(),
      durationMin: Number(durationMin) || 0,
      intensity,
      weightKg: weightKg ? Number(weightKg) : null,
      reps: reps ? Number(reps) : null,
      sets: sets ? Number(sets) : null,
      caloriesBurned: null,
      note: note || null,
    });
    setActivity("");
    setDurationMin("");
    setWeightKg("");
    setReps("");
    setSets("");
    setNote("");
    toast.success("AIで消費kcalを概算し記録しました");
  };

  const totalKcal = (listQ.data ?? []).reduce(
    (a, w) => a + Number(w.caloriesBurned ?? 0),
    0
  );
  const totalMin = (listQ.data ?? []).reduce((a, w) => a + Number(w.durationMin ?? 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] tracking-wider-jp text-muted-foreground">WORKOUTS</div>
        <h1 className="font-display text-3xl text-primary mt-1">トレーニング</h1>
      </div>

      <Card className="p-4 bg-white/70 border-white/70 backdrop-blur-sm space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] tracking-wider-jp">日付</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-white/70"
            />
          </div>
          <div>
            <Label className="text-[11px] tracking-wider-jp">強度</Label>
            <Select value={intensity} onValueChange={(v) => setIntensity(v as typeof intensity)}>
              <SelectTrigger className="bg-white/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INTENSITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-[11px] tracking-wider-jp">種目</Label>
          <Input
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="例: ベンチプレス / ランニング / スクワット"
            className="bg-white/70"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-[11px] tracking-wider-jp">重量(kg)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="bg-white/70"
              placeholder="70"
            />
          </div>
          <div>
            <Label className="text-[11px] tracking-wider-jp">回数</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="bg-white/70"
              placeholder="10"
            />
          </div>
          <div>
            <Label className="text-[11px] tracking-wider-jp">セット</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              className="bg-white/70"
              placeholder="3"
            />
          </div>
        </div>

        <div>
          <Label className="text-[11px] tracking-wider-jp">時間 (分・有酸素の場合)</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className="bg-white/70"
            placeholder="30"
          />
        </div>

        <div>
          <Label className="text-[11px] tracking-wider-jp">メモ（任意）</Label>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-white/70"
          />
        </div>

        <Button
          onClick={submit}
          disabled={addM.isPending}
          className="rounded-full w-full"
        >
          {addM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          記録する
        </Button>

        <div className="text-[10px] tracking-wider-jp text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          消費カロリーは種目・重量・回数・セット・時間からAIで概算します。
        </div>
      </Card>

      <Card className="p-4 bg-white/60 border-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] tracking-wider-jp text-muted-foreground">
          <Flame className="h-3.5 w-3.5" />
          選択日の合計
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-primary/10 border border-primary/20 px-3 py-2">
            <div className="text-[10px] tracking-wider-jp text-muted-foreground">消費kcal</div>
            <div className="font-display text-xl text-primary mt-0.5">
              {Math.round(totalKcal)}
            </div>
          </div>
          <div className="rounded-2xl bg-white/50 border border-white/70 px-3 py-2">
            <div className="text-[10px] tracking-wider-jp text-muted-foreground">合計時間</div>
            <div className="font-display text-xl text-primary mt-0.5">{totalMin} 分</div>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-white/70 border-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] tracking-wider-jp text-muted-foreground mb-2">
          <Dumbbell className="h-3.5 w-3.5" />
          記録一覧
        </div>
        {(listQ.data ?? []).length === 0 ? (
          <div className="text-xs text-muted-foreground">この日はまだ記録がありません</div>
        ) : (
          <div className="space-y-2">
            {listQ.data!.map((w) => (
              <div
                key={w.id}
                className="bg-white/50 border border-white/70 rounded-2xl px-3 py-2.5 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{w.activity}</div>
                  <div className="text-[10px] tracking-wider-jp text-muted-foreground mt-1">
                    {w.weightKg ? `${w.weightKg}kg × ${w.reps ?? "-"}回 × ${w.sets ?? "-"}セット · ` : ""}
                    {w.durationMin ? `${w.durationMin}分 · ` : ""}
                    {INTENSITY_LABELS[w.intensity]} ·{" "}
                    <strong className="text-primary">
                      {Math.round(Number(w.caloriesBurned ?? 0))}
                    </strong>{" "}
                    kcal
                  </div>
                </div>
                <button
                  className="p-1 text-muted-foreground hover:text-destructive"
                  onClick={() => removeM.mutate({ id: w.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
