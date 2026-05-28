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
import { trpc } from "@/lib/trpc";
import { Dumbbell, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Experience = "beginner" | "intermediate" | "advanced";
type Environment = "gym" | "home" | "both";

const EXPERIENCE_LABELS: Record<Experience, string> = {
  beginner: "初心者",
  intermediate: "中級者",
  advanced: "上級者",
};

const ENV_LABELS: Record<Environment, string> = {
  gym: "ジム中心",
  home: "自宅中心",
  both: "両方",
};

export default function Coach() {
  const [experience, setExperience] = useState<Experience>("beginner");
  const [daysPerWeek, setDaysPerWeek] = useState("3");
  const [environment, setEnvironment] = useState<Environment>("home");
  const [focusArea, setFocusArea] = useState("");
  const [hasInjury, setHasInjury] = useState("");

  const goalQ = trpc.goals.get.useQuery();
  const suggestM = trpc.coach.suggestPlan.useMutation();

  const onSubmit = async () => {
    if (!goalQ.data) {
      toast.error("先に「目標」ページで目標を設定してください");
      return;
    }
    const days = Number(daysPerWeek) || 3;
    try {
      await suggestM.mutateAsync({
        experience,
        daysPerWeek: Math.min(7, Math.max(1, days)),
        environment,
        focusArea: focusArea.trim() || undefined,
        hasInjury: hasInjury.trim() || undefined,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "提案に失敗しました");
    }
  };

  const plan = suggestM.data;

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] tracking-wider-jp text-muted-foreground">
          AI PERSONAL TRAINER
        </div>
        <h1 className="font-display text-3xl text-primary mt-1">AIトレーナー</h1>
        <div className="text-[11px] tracking-wider-jp text-muted-foreground mt-1">
          目標と体組成、経験レベルから1週間分のメニューを提案します
        </div>
      </div>

      <Card className="p-4 bg-white/70 border-white/70 backdrop-blur-sm space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] tracking-wider-jp">経験</Label>
            <Select
              value={experience}
              onValueChange={(v) => setExperience(v as Experience)}
            >
              <SelectTrigger className="bg-white/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPERIENCE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] tracking-wider-jp">頻度（日/週）</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(e.target.value)}
              className="bg-white/70"
            />
          </div>
        </div>
        <div>
          <Label className="text-[11px] tracking-wider-jp">環境</Label>
          <Select
            value={environment}
            onValueChange={(v) => setEnvironment(v as Environment)}
          >
            <SelectTrigger className="bg-white/70">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ENV_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] tracking-wider-jp">注力したい部位（任意）</Label>
          <Input
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            placeholder="例: お腹周り / 下半身"
            className="bg-white/70"
          />
        </div>
        <div>
          <Label className="text-[11px] tracking-wider-jp">既往症・痛み（任意）</Label>
          <Textarea
            rows={2}
            value={hasInjury}
            onChange={(e) => setHasInjury(e.target.value)}
            placeholder="例: 腰に違和感がある"
            className="bg-white/70"
          />
        </div>

        <Button
          onClick={onSubmit}
          disabled={suggestM.isPending}
          className="w-full rounded-full"
        >
          {suggestM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          AIに提案してもらう
        </Button>
      </Card>

      {plan && (
        <>
          <Card className="p-4 bg-white/70 border-white/70 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-[11px] tracking-wider-jp text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              AIコーチからのアドバイス
            </div>
            <div className="mt-2 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {plan.summary}
            </div>
            {plan.cautions && (
              <div className="mt-3 rounded-2xl bg-secondary/30 border border-white/70 px-3 py-2 text-[12px] text-foreground/80">
                {plan.cautions}
              </div>
            )}
          </Card>

          <div className="space-y-3">
            {plan.weeklyPlan.map((day, di) => (
              <Card
                key={di}
                className="p-4 bg-white/70 border-white/70 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="font-display text-lg text-primary">
                    {day.day}
                  </div>
                  <div className="text-[10px] tracking-wider-jp text-muted-foreground">
                    {day.focus}
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {day.exercises.map((ex, i) => (
                    <div
                      key={i}
                      className="bg-white/50 border border-white/70 rounded-2xl px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <Dumbbell className="h-4 w-4 text-primary mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm text-foreground">
                            {ex.name}
                            <span className="text-[10px] tracking-wider-jp text-muted-foreground ml-2">
                              ({ex.targetMuscle})
                            </span>
                          </div>
                          <div className="text-[10px] tracking-wider-jp text-muted-foreground mt-1">
                            {ex.sets}セット × {ex.reps} · 重量目安: {ex.weightGuide}
                          </div>
                          {ex.note && (
                            <div className="text-[11px] text-foreground/80 mt-1">
                              {ex.note}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
