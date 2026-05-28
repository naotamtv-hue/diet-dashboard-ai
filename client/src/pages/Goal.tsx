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
import { ACTIVITY_LABELS } from "@/lib/labels";
import { trpc } from "@/lib/trpc";
import { Loader2, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "veryActive";

const CARD = {
  background: "oklch(0.20 0.05 240)",
  border: "1px solid oklch(0.30 0.04 240)",
} as const;

const INNER = {
  background: "oklch(0.24 0.04 240)",
  border: "1px solid oklch(0.30 0.04 240)",
} as const;

export default function Goal() {
  const goalQ = trpc.goals.get.useQuery();
  const utils = trpc.useUtils();

  const [gender, setGender] = useState<"male" | "female">("male");
  const [age, setAge] = useState("30");
  const [heightCm, setHeightCm] = useState("170");
  const [currentWeight, setCurrentWeight] = useState("70");
  const [targetWeight, setTargetWeight] = useState("65");
  const [targetWeeks, setTargetWeeks] = useState("12");
  const [activity, setActivity] = useState<ActivityLevel>("light");

  useEffect(() => {
    const g = goalQ.data;
    if (g) {
      setGender(g.gender as "male" | "female");
      setAge(String(g.age));
      setHeightCm(String(g.heightCm));
      setCurrentWeight(String(g.currentWeightKg));
      setTargetWeight(String(g.targetWeightKg));
      setTargetWeeks(String(g.targetWeeks));
      setActivity(g.activityLevel as ActivityLevel);
    }
  }, [goalQ.data]);

  const previewInput = useMemo(
    () => ({
      gender,
      age: Number(age) || 30,
      heightCm: Number(heightCm) || 170,
      currentWeightKg: Number(currentWeight) || 70,
      targetWeightKg: Number(targetWeight) || 65,
      targetWeeks: Number(targetWeeks) || 12,
      activityLevel: activity,
    }),
    [gender, age, heightCm, currentWeight, targetWeight, targetWeeks, activity]
  );

  const previewQ = trpc.goals.preview.useQuery(previewInput, {
    enabled:
      previewInput.heightCm > 100 &&
      previewInput.currentWeightKg > 20 &&
      previewInput.targetWeightKg > 20 &&
      previewInput.targetWeeks > 0,
  });

  const saveM = trpc.goals.save.useMutation({
    onSuccess: () => {
      utils.goals.get.invalidate();
      toast.success("目標と減量計画を保存しました");
    },
  });

  const submit = async () => {
    if (previewInput.targetWeightKg >= previewInput.currentWeightKg) {
      toast.error("目標体重は現在の体重より低く設定してください");
      return;
    }
    await saveM.mutateAsync(previewInput);
  };

  const plan = previewQ.data;

  return (
    <div className="space-y-4 pb-4">
      {/* Page Header */}
      <div className="pt-1">
        <div className="section-label mb-1">GOAL</div>
        <h1 className="text-2xl font-bold text-white">目標設定</h1>
      </div>

      {/* フォーム */}
      <div className="rounded-xl px-4 py-4 space-y-4" style={CARD}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="section-label">性別</Label>
            <Select value={gender} onValueChange={(v) => setGender(v as "male" | "female")}>
              <SelectTrigger className="w-full h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">男性</SelectItem>
                <SelectItem value="female">女性</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="section-label">年齢</Label>
            <Input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} className="h-11" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="section-label">身長 (cm)</Label>
            <Input type="number" inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="section-label">現在の体重 (kg)</Label>
            <Input type="number" inputMode="decimal" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} className="h-11" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="section-label">目標体重 (kg)</Label>
            <Input type="number" inputMode="decimal" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="section-label">期間 (週)</Label>
            <Input type="number" inputMode="numeric" value={targetWeeks} onChange={(e) => setTargetWeeks(e.target.value)} className="h-11" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="section-label">活動量</Label>
          <Select value={activity} onValueChange={(v) => setActivity(v as ActivityLevel)}>
            <SelectTrigger className="w-full h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={submit} disabled={saveM.isPending} className="w-full h-12 font-bold rounded-xl">
          {saveM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
          目標と計画を保存
        </Button>
      </div>

      {/* 自動算出された減量計画 */}
      {plan && (
        <div className="rounded-xl px-4 py-4 space-y-4" style={CARD}>
          <div className="flex items-center gap-2 section-label">
            <Sparkles className="h-3.5 w-3.5" />
            自動算出された減量計画
          </div>

          <div className="grid grid-cols-3 gap-2">
            <PlanBox label="基礎代謝 (BMR)" value={plan.bmr} unit="kcal" />
            <PlanBox label="消費 (TDEE)" value={plan.tdee} unit="kcal" />
            <PlanBox label="1日の目安" value={plan.targetCalories} unit="kcal" highlight />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <PlanBox label="週間減量目標" value={plan.weeklyLossKg.toFixed(2)} unit="kg/週" />
            <PlanBox label="1日のカロリー不足" value={plan.dailyDeficit} unit="kcal" />
          </div>

          <div className="rounded-xl px-4 py-3" style={INNER}>
            <div className="section-label mb-3">PFC目安（タンパク質・脂質・炭水化物）</div>
            <div className="flex gap-6">
              <PfcItem label="タンパク質" value={plan.pfc.proteinG} color="oklch(0.62 0.18 220)" />
              <PfcItem label="脂質" value={plan.pfc.fatG} color="oklch(0.75 0.18 55)" />
              <PfcItem label="炭水化物" value={plan.pfc.carbsG} color="oklch(0.72 0.18 155)" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanBox({ label, value, unit, highlight }: { label: string; value: number | string; unit: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-xl px-3 py-3"
      style={{
        background: highlight ? "oklch(0.62 0.18 220 / 0.15)" : "oklch(0.24 0.04 240)",
        border: `1px solid ${highlight ? "oklch(0.62 0.18 220 / 0.4)" : "oklch(0.30 0.04 240)"}`,
      }}
    >
      <div className="text-[10px] font-medium text-muted-foreground leading-tight">{label}</div>
      <div
        className="text-lg font-bold leading-none mt-1"
        style={{ color: highlight ? "oklch(0.62 0.18 220)" : "oklch(0.95 0.01 220)" }}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{unit}</div>
    </div>
  );
}

function PfcItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-0.5 leading-none" style={{ color }}>
        {value}<span className="text-xs font-normal text-muted-foreground ml-0.5">g</span>
      </div>
    </div>
  );
}
