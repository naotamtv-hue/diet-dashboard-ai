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

const GLASS = {
  background: "oklch(1 0 0 / 0.72)",
  border: "1px solid oklch(1 0 0 / 0.78)",
  backdropFilter: "blur(20px) saturate(1.4)",
  WebkitBackdropFilter: "blur(20px) saturate(1.4)",
  boxShadow: "0 1px 2px oklch(0.35 0.08 290 / 0.04), 0 4px 12px oklch(0.35 0.08 290 / 0.06), inset 0 1px 0 oklch(1 0 0 / 0.9)",
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
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="pt-1">
        <div className="page-label mb-1.5">AI PERSONAL TRAINER</div>
        <h1 className="font-display" style={{ fontSize: "clamp(1.75rem,5vw,2.5rem)", color: "oklch(0.32 0.09 290)" }}>
          AIトレーナー
        </h1>
        <p className="text-xs text-muted-foreground mt-1 tracking-wide">
          目標と体組成、経験レベルから1週間分のメニューを提案します
        </p>
      </div>

      {/* フォーム */}
      <div className="rounded-2xl px-5 py-5 space-y-4" style={GLASS}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="page-label">経験レベル</Label>
            <Select value={experience} onValueChange={(v) => setExperience(v as Experience)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPERIENCE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="page-label">頻度（日/週）</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(e.target.value)}
              min={1}
              max={7}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="page-label">トレーニング環境</Label>
          <Select value={environment} onValueChange={(v) => setEnvironment(v as Environment)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ENV_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="page-label">注力したい部位（任意）</Label>
          <Input
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            placeholder="例: お腹周り / 下半身"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="page-label">既往症・痛み（任意）</Label>
          <Textarea
            rows={2}
            value={hasInjury}
            onChange={(e) => setHasInjury(e.target.value)}
            placeholder="例: 腰に違和感がある"
          />
        </div>

        <Button
          onClick={onSubmit}
          disabled={suggestM.isPending}
          className="w-full rounded-xl h-11 font-medium"
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
          <div className="rounded-2xl px-5 py-4 space-y-2" style={GLASS}>
            <div className="flex items-center gap-1.5 page-label">
              <Sparkles className="h-3 w-3" />
              AIコーチからのアドバイス
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{plan.summary}</p>
            {plan.cautions && (
              <div
                className="rounded-xl px-3 py-2.5 text-xs text-foreground/80 leading-relaxed"
                style={{ background: "oklch(0.97 0.015 290 / 0.55)", border: "1px solid oklch(0.9 0.02 290 / 0.4)" }}
              >
                ⚠️ {plan.cautions}
              </div>
            )}
          </div>

          {/* 週次プラン */}
          <div className="space-y-3">
            {plan.weeklyPlan.map((day, di) => (
              <div key={di} className="rounded-2xl px-5 py-4 space-y-3" style={GLASS}>
                <div className="flex items-center justify-between">
                  <div className="font-display text-lg" style={{ color: "oklch(0.35 0.08 290)" }}>{day.day}</div>
                  <div className="page-label">{day.focus}</div>
                </div>
                <div className="space-y-2">
                  {day.exercises.map((ex, i) => (
                    <div
                      key={i}
                      className="rounded-xl px-3 py-2.5"
                      style={{ background: "oklch(0.97 0.015 290 / 0.55)", border: "1px solid oklch(0.9 0.02 290 / 0.4)" }}
                    >
                      <div className="flex items-start gap-2">
                        <Dumbbell className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "oklch(0.55 0.1 290)" }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">
                            {ex.name}
                            <span className="text-[10px] tracking-wider-jp text-muted-foreground ml-2 font-normal">
                              ({ex.targetMuscle})
                            </span>
                          </div>
                          <div className="page-label mt-1">
                            {ex.sets}セット × {ex.reps} · 重量目安: {ex.weightGuide}
                          </div>
                          {ex.note && (
                            <div className="text-xs text-foreground/70 mt-1">{ex.note}</div>
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
