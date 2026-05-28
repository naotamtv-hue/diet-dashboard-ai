import { Button } from "@/components/ui/button";
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

const GLASS = {
  background: "oklch(1 0 0 / 0.72)",
  border: "1px solid oklch(1 0 0 / 0.78)",
  backdropFilter: "blur(20px) saturate(1.4)",
  WebkitBackdropFilter: "blur(20px) saturate(1.4)",
  boxShadow: "0 1px 2px oklch(0.35 0.08 290 / 0.04), 0 4px 12px oklch(0.35 0.08 290 / 0.06), inset 0 1px 0 oklch(1 0 0 / 0.9)",
} as const;

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

  const totalKcal = (listQ.data ?? []).reduce((a, w) => a + Number(w.caloriesBurned ?? 0), 0);
  const totalMin = (listQ.data ?? []).reduce((a, w) => a + Number(w.durationMin ?? 0), 0);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="pt-1">
        <div className="page-label mb-1.5">WORKOUTS</div>
        <h1 className="font-display" style={{ fontSize: "clamp(1.75rem,5vw,2.5rem)", color: "oklch(0.32 0.09 290)" }}>
          トレーニング
        </h1>
      </div>

      {/* 入力フォーム */}
      <div className="rounded-2xl px-5 py-5 space-y-4" style={GLASS}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="page-label">日付</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="page-label">強度</Label>
            <Select value={intensity} onValueChange={(v) => setIntensity(v as typeof intensity)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INTENSITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="page-label">種目</Label>
          <Input
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="例: ベンチプレス / ランニング / スクワット"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="page-label">重量(kg)</Label>
            <Input type="number" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" />
          </div>
          <div className="space-y-1.5">
            <Label className="page-label">回数</Label>
            <Input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="10" />
          </div>
          <div className="space-y-1.5">
            <Label className="page-label">セット</Label>
            <Input type="number" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} placeholder="3" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="page-label">時間（分・有酸素の場合）</Label>
          <Input type="number" inputMode="numeric" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="30" />
        </div>

        <div className="space-y-1.5">
          <Label className="page-label">メモ（任意）</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <Button onClick={submit} disabled={addM.isPending} className="w-full rounded-xl h-11 font-medium">
          {addM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          記録する
        </Button>

        <div className="text-[10px] tracking-wider-jp text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          消費カロリーは種目・重量・回数・セット・時間からAIで概算します。
        </div>
      </div>

      {/* 選択日の合計 */}
      <div className="rounded-2xl px-5 py-5" style={GLASS}>
        <div className="flex items-center gap-1.5 page-label mb-3">
          <Flame className="h-3 w-3" />
          選択日の合計
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl px-4 py-3" style={{ background: "oklch(0.93 0.06 290 / 0.35)", border: "1px solid oklch(0.75 0.1 290 / 0.3)" }}>
            <div className="text-[10px] tracking-wider-jp text-muted-foreground">消費kcal</div>
            <div className="font-display text-2xl mt-0.5" style={{ color: "oklch(0.35 0.08 290)" }}>{Math.round(totalKcal)}</div>
          </div>
          <div className="rounded-xl px-4 py-3" style={{ background: "oklch(0.97 0.015 290 / 0.55)", border: "1px solid oklch(0.9 0.02 290 / 0.4)" }}>
            <div className="text-[10px] tracking-wider-jp text-muted-foreground">合計時間</div>
            <div className="font-display text-2xl mt-0.5" style={{ color: "oklch(0.35 0.08 290)" }}>{totalMin} <span className="text-sm font-sans">分</span></div>
          </div>
        </div>
      </div>

      {/* 記録一覧 */}
      <div className="rounded-2xl px-5 py-5" style={GLASS}>
        <div className="flex items-center gap-1.5 page-label mb-3">
          <Dumbbell className="h-3 w-3" />
          記録一覧
        </div>
        {(listQ.data ?? []).length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">この日はまだ記録がありません</div>
        ) : (
          <div className="space-y-2">
            {listQ.data!.map((w) => (
              <div
                key={w.id}
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{
                  background: "oklch(0.97 0.015 290 / 0.55)",
                  border: "1px solid oklch(0.9 0.02 290 / 0.4)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{w.activity}</div>
                  <div className="text-[10px] tracking-wider-jp text-muted-foreground mt-0.5">
                    {w.weightKg ? `${w.weightKg}kg × ${w.reps ?? "-"}回 × ${w.sets ?? "-"}セット · ` : ""}
                    {w.durationMin ? `${w.durationMin}分 · ` : ""}
                    {INTENSITY_LABELS[w.intensity]} ·{" "}
                    <strong style={{ color: "oklch(0.45 0.1 290)" }}>
                      {Math.round(Number(w.caloriesBurned ?? 0))}
                    </strong>{" "}
                    kcal
                  </div>
                </div>
                <button
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors flex-shrink-0"
                  onClick={() => removeM.mutate({ id: w.id })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
