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

const CARD = {
  background: "oklch(0.20 0.05 240)",
  border: "1px solid oklch(0.30 0.04 240)",
} as const;

const INNER = {
  background: "oklch(0.24 0.04 240)",
  border: "1px solid oklch(0.30 0.04 240)",
} as const;

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
    <div className="space-y-4 pb-4">
      {/* Page Header */}
      <div className="pt-1">
        <div className="section-label mb-1">AI PERSONAL TRAINER</div>
        <h1 className="text-2xl font-bold text-white">AIトレーナー</h1>
        <p className="text-xs text-muted-foreground mt-1">
          目標と体組成、経験レベルから1週間分のメニューを提案します
        </p>
      </div>

      {/* フォーム */}
      <div className="rounded-xl px-4 py-4 space-y-4" style={CARD}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="section-label">経験レベル</Label>
            <Select value={experience} onValueChange={(v) => setExperience(v as Experience)}>
              <SelectTrigger className="w-full h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPERIENCE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="section-label">頻度（日/週）</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(e.target.value)}
              min={1}
              max={7}
              className="h-11"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="section-label">トレーニング環境</Label>
          <Select value={environment} onValueChange={(v) => setEnvironment(v as Environment)}>
            <SelectTrigger className="w-full h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ENV_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="section-label">注力したい部位（任意）</Label>
          <Input
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            placeholder="例: お腹周り / 下半身"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label className="section-label">既往症・痛み（任意）</Label>
          <Textarea
            rows={2}
            value={hasInjury}
            onChange={(e) => setHasInjury(e.target.value)}
            placeholder="例: 腰に違和感がある"
            className="resize-none"
          />
        </div>

        <Button
          onClick={onSubmit}
          disabled={suggestM.isPending}
          className="w-full h-12 font-bold rounded-xl"
        >
          {suggestM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          AIにメニューを提案してもらう
        </Button>
      </div>

      {/* 提案結果 */}
      {plan && (
        <>
          {/* サマリー */}
          <div className="rounded-xl px-4 py-4 space-y-3" style={CARD}>
            <div className="flex items-center gap-2 section-label">
              <Sparkles className="h-3.5 w-3.5" />
              AIコーチからのアドバイス
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{plan.summary}</p>
            {plan.cautions && (
              <div
                className="rounded-xl px-3 py-2.5 text-xs text-foreground/80 leading-relaxed"
                style={{ background: "oklch(0.75 0.18 55 / 0.1)", border: "1px solid oklch(0.75 0.18 55 / 0.3)" }}
              >
                ⚠️ {plan.cautions}
              </div>
            )}
          </div>

          {/* 週次プラン */}
          <div className="space-y-3">
            {plan.weeklyPlan.map((day, di) => (
              <div key={di} className="rounded-xl px-4 py-4 space-y-3" style={CARD}>
                <div className="flex items-center justify-between">
                  <div className="text-base font-bold text-white">{day.day}</div>
                  <div
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "oklch(0.62 0.18 220 / 0.2)", color: "oklch(0.62 0.18 220)" }}
                  >
                    {day.focus}
                  </div>
                </div>
                <div className="space-y-2">
                  {day.exercises.map((ex, i) => (
                    <div key={i} className="rounded-xl px-3 py-3" style={INNER}>
                      <div className="flex items-start gap-2">
                        <Dumbbell className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "oklch(0.62 0.18 220)" }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">
                            {ex.name}
                            <span className="text-[10px] text-muted-foreground ml-2 font-normal">
                              ({ex.targetMuscle})
                            </span>
                          </div>
                          <div className="section-label mt-1">
                            {ex.sets}セット × {ex.reps} · 重量目安: {ex.weightGuide}
                          </div>
                          {ex.note && (
                            <div className="text-xs text-muted-foreground mt-1">{ex.note}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
