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
import { workoutMotivation } from "@/lib/motivation";
import { Dumbbell, Flame, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const CARD = {
  background: "oklch(0.20 0.05 240)",
  border: "1px solid oklch(0.30 0.04 240)",
} as const;

const INNER = {
  background: "oklch(0.24 0.04 240)",
  border: "1px solid oklch(0.30 0.04 240)",
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
  const [estimatedKcal, setEstimatedKcal] = useState<number | null>(null);
  const [estimateNote, setEstimateNote] = useState("");

  const utils = trpc.useUtils();
  const listQ = trpc.workouts.listByDate.useQuery({ date });
  const estimateM = trpc.workouts.estimateCalories.useMutation();
  const addM = trpc.workouts.add.useMutation({
    onSuccess: () => utils.workouts.listByDate.invalidate({ date }),
  });

  // 入力が変わったら推定値はリセット（古い値を保存しないため）
  useEffect(() => {
    setEstimatedKcal(null);
    setEstimateNote("");
  }, [activity, durationMin, weightKg, reps, sets, intensity]);

  const onEstimate = async () => {
    if (!activity.trim()) {
      toast.error("先に種目名を入力してください");
      return;
    }
    if (!durationMin && !(sets && reps)) {
      toast.error("有酸素は「時間（分）」、筋トレは「回数・セット」を入れてください");
      return;
    }
    try {
      const res = await estimateM.mutateAsync({
        activity: activity.trim(),
        durationMin: Number(durationMin) || 0,
        intensity,
        weightKg: weightKg ? Number(weightKg) : null,
        reps: reps ? Number(reps) : null,
        sets: sets ? Number(sets) : null,
      });
      setEstimatedKcal(res.caloriesBurned);
      setEstimateNote(res.reasoning);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "計算に失敗しました");
    }
  };
  const removeM = trpc.workouts.remove.useMutation({
    onSuccess: () => utils.workouts.listByDate.invalidate({ date }),
  });

  const submit = async () => {
    if (!activity.trim()) {
      toast.error("種目名を入力してください");
      return;
    }
    const res = await addM.mutateAsync({
      date,
      activity: activity.trim(),
      durationMin: Number(durationMin) || 0,
      intensity,
      weightKg: weightKg ? Number(weightKg) : null,
      reps: reps ? Number(reps) : null,
      sets: sets ? Number(sets) : null,
      caloriesBurned: estimatedKcal,
      note: note || null,
    });
    const kcal = estimatedKcal ?? res.estimatedCalories ?? 0;
    setActivity("");
    setDurationMin("");
    setWeightKg("");
    setReps("");
    setSets("");
    setNote("");
    setEstimatedKcal(null);
    setEstimateNote("");
    toast.success(`${workoutMotivation()}（消費 約${Math.round(kcal)}kcal）`, { duration: 4500 });
  };

  const totalKcal = (listQ.data ?? []).reduce((a, w) => a + Number(w.caloriesBurned ?? 0), 0);
  const totalMin = (listQ.data ?? []).reduce((a, w) => a + Number(w.durationMin ?? 0), 0);

  return (
    <div className="space-y-4 pb-4">
      {/* Page Header */}
      <div className="pt-1">
        <div className="section-label mb-1">WORKOUTS</div>
        <h1 className="text-2xl font-bold text-white">トレーニング</h1>
      </div>

      {/* 筋トレ（種目別）への導線 */}
      <Link href="/strength">
        <button
          className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5"
          style={{ background: "oklch(0.62 0.18 220 / 0.15)", border: "1px solid oklch(0.62 0.18 220 / 0.3)" }}
        >
          <Dumbbell className="h-5 w-5 flex-shrink-0" style={{ color: "oklch(0.62 0.18 220)" }} />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-bold text-white">筋トレを種目別に記録</div>
            <div className="text-[11px] text-muted-foreground">部位・種目ごとにセット／重量／回数・RM・タイマー</div>
          </div>
          <span className="text-lg" style={{ color: "oklch(0.62 0.18 220)" }}>›</span>
        </button>
      </Link>

      {/* 入力フォーム */}
      <div className="rounded-xl px-4 py-4 space-y-4" style={CARD}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="section-label">日付</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label className="section-label">強度</Label>
            <Select value={intensity} onValueChange={(v) => setIntensity(v as typeof intensity)}>
              <SelectTrigger className="w-full h-11">
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

        <div className="space-y-2">
          <Label className="section-label">種目</Label>
          <Input
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="例: ベンチプレス / ランニング / スクワット"
            className="h-11"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="section-label">重量(kg)</Label>
            <Input type="number" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" className="h-11" />
          </div>
          <div className="space-y-2">
            <Label className="section-label">回数</Label>
            <Input type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="10" className="h-11" />
          </div>
          <div className="space-y-2">
            <Label className="section-label">セット</Label>
            <Input type="number" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} placeholder="3" className="h-11" />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="section-label">時間（分・有酸素の場合）</Label>
          <Input type="number" inputMode="numeric" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="30" className="h-11" />
        </div>

        {/* 消費カロリーの計算・表示 */}
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 gap-2 font-semibold rounded-xl"
            disabled={estimateM.isPending}
            onClick={onEstimate}
          >
            {estimateM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
            消費カロリーを計算
          </Button>
          {estimatedKcal !== null && (
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: "oklch(0.72 0.18 155 / 0.15)", border: "1px solid oklch(0.72 0.18 155 / 0.3)" }}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold" style={{ color: "oklch(0.72 0.18 155)" }}>
                  {Math.round(estimatedKcal)}
                </span>
                <span className="text-sm text-muted-foreground">kcal 消費（推定）</span>
              </div>
              {estimateNote && <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{estimateNote}</div>}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="section-label">メモ（任意）</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="resize-none" />
        </div>

        <Button onClick={submit} disabled={addM.isPending} className="w-full h-12 font-bold rounded-xl">
          {addM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          記録する
        </Button>

        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          消費カロリーは種目・重量・回数・セット・時間からAIで概算します。
        </div>
      </div>

      {/* 選択日の合計 */}
      <div className="rounded-xl px-4 py-4" style={CARD}>
        <div className="flex items-center gap-2 section-label mb-3">
          <Flame className="h-3.5 w-3.5" />
          選択日の合計
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-xl px-4 py-3"
            style={{ background: "oklch(0.72 0.18 155 / 0.15)", border: "1px solid oklch(0.72 0.18 155 / 0.3)" }}
          >
            <div className="text-[10px] font-medium text-muted-foreground">消費kcal</div>
            <div className="text-2xl font-bold mt-1" style={{ color: "oklch(0.72 0.18 155)" }}>
              {Math.round(totalKcal)}
            </div>
          </div>
          <div className="rounded-xl px-4 py-3" style={INNER}>
            <div className="text-[10px] font-medium text-muted-foreground">合計時間</div>
            <div className="text-2xl font-bold text-white mt-1">
              {totalMin}<span className="text-sm font-normal text-muted-foreground ml-1">分</span>
            </div>
          </div>
        </div>
      </div>

      {/* 記録一覧 */}
      <div className="rounded-xl px-4 py-4" style={CARD}>
        <div className="flex items-center gap-2 section-label mb-3">
          <Dumbbell className="h-3.5 w-3.5" />
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
                style={INNER}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{w.activity}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {w.weightKg ? `${w.weightKg}kg × ${w.reps ?? "-"}回 × ${w.sets ?? "-"}セット · ` : ""}
                    {w.durationMin ? `${w.durationMin}分 · ` : ""}
                    {INTENSITY_LABELS[w.intensity]} ·{" "}
                    <strong style={{ color: "oklch(0.72 0.18 155)" }}>
                      {Math.round(Number(w.caloriesBurned ?? 0))}
                    </strong>{" "}
                    kcal
                  </div>
                </div>
                <button
                  className="tap-target text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors flex-shrink-0"
                  onClick={() => removeM.mutate({ id: w.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
