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
import { ACTIVITY_LABELS } from "@/lib/labels";
import { trpc } from "@/lib/trpc";
import { Loader2, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "veryActive";

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
    <div className="space-y-5">
      <div>
        <div className="text-[11px] tracking-wider-jp text-muted-foreground">GOAL</div>
        <h1 className="font-display text-3xl text-primary mt-1">目標設定</h1>
      </div>

      <Card className="p-4 bg-white/70 border-white/70 backdrop-blur-sm space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] tracking-wider-jp">性別</Label>
            <Select value={gender} onValueChange={(v) => setGender(v as "male" | "female")}>
              <SelectTrigger className="bg-white/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">男性</SelectItem>
                <SelectItem value="female">女性</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] tracking-wider-jp">年齢</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="bg-white/70"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] tracking-wider-jp">身長 (cm)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="bg-white/70"
            />
          </div>
          <div>
            <Label className="text-[11px] tracking-wider-jp">現在の体重 (kg)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={currentWeight}
              onChange={(e) => setCurrentWeight(e.target.value)}
              className="bg-white/70"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] tracking-wider-jp">目標体重 (kg)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              className="bg-white/70"
            />
          </div>
          <div>
            <Label className="text-[11px] tracking-wider-jp">期間 (週)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={targetWeeks}
              onChange={(e) => setTargetWeeks(e.target.value)}
              className="bg-white/70"
            />
          </div>
        </div>
        <div>
          <Label className="text-[11px] tracking-wider-jp">活動量</Label>
          <Select value={activity} onValueChange={(v) => setActivity(v as ActivityLevel)}>
            <SelectTrigger className="bg-white/70">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={submit}
          disabled={saveM.isPending}
          className="w-full rounded-full"
        >
          {saveM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Target className="h-4 w-4 mr-2" />
          )}
          目標と計画を保存
        </Button>
      </Card>

      {plan && (
        <Card className="p-5 bg-white/70 border-white/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[11px] tracking-wider-jp text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            自動算出された減量計画
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Box label="基礎代謝 (BMR)" value={plan.bmr} unit="kcal" />
            <Box label="消費 (TDEE)" value={plan.tdee} unit="kcal" />
            <Box
              label="1日の目安"
              value={plan.targetCalories}
              unit="kcal"
              highlight
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Box
              label="想定の週間減量"
              value={plan.weeklyLossKg.toFixed(2)}
              unit="kg/週"
            />
            <Box label="1日の不足" value={plan.dailyDeficit} unit="kcal" />
          </div>
          <div className="mt-4 rounded-2xl bg-secondary/30 border border-white/70 p-3">
            <div className="text-[11px] tracking-wider-jp text-muted-foreground">
              PFC目安（タンパク質・脂質・炭水化物）
            </div>
            <div className="mt-1 flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-[11px]">P</span>{" "}
                <strong>{plan.pfc.proteinG} g</strong>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px]">F</span>{" "}
                <strong>{plan.pfc.fatG} g</strong>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px]">C</span>{" "}
                <strong>{plan.pfc.carbsG} g</strong>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Box({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: number | string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-3 py-2.5 ${
        highlight
          ? "bg-primary/10 border border-primary/20"
          : "bg-white/50 border border-white/70"
      }`}
    >
      <div className="text-[10px] tracking-wider-jp text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-end gap-1">
        <div className="font-display text-lg text-primary leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground mb-0.5">{unit}</div>
      </div>
    </div>
  );
}
