import { Button } from "@/components/ui/button";
import { TrainerAvatar } from "@/components/TrainerAvatar";
import { trpc } from "@/lib/trpc";
import { TRAINERS, TRAINER_GROUPS, getTrainerInfo, type TrainerId, type TrainerInfo } from "@/lib/trainers";
import { formatDate } from "@/lib/labels";
import { Check, ChevronRight, Flame, HeartHandshake, Loader2, Salad, ShieldCheck, Sparkles, Target, TrendingDown, Utensils, UtensilsCrossed, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const CARD = { background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 250)" } as const;
const INNER = { background: "oklch(0.965 0.004 250)", border: "1px solid oklch(0.92 0.006 250)" } as const;
const GREEN = "oklch(0.72 0.18 130)";

type Advice = {
  summary: string;
  todayAdvice: string;
  foodImprovements: { title: string; detail: string }[];
  paceVerdict: string;
  warning: string;
};

export default function Mypersol() {
  const utils = trpc.useUtils();
  const coachQ = trpc.mypersol.getCoach.useQuery();
  const analysisQ = trpc.mypersol.analysis.useQuery();
  const setCoachM = trpc.mypersol.setCoach.useMutation({
    onSuccess: () => utils.mypersol.getCoach.invalidate(),
  });
  const [advice, setAdvice] = useState<Advice | null>(null);
  const adviceM = trpc.mypersol.advice.useMutation({
    onSuccess: (res) => setAdvice(res.advice),
    onError: (e) => toast.error(e.message),
  });

  const [detailId, setDetailId] = useState<TrainerId | null>(null);
  const coachId = coachQ.data ?? null;
  const trainer = getTrainerInfo(coachId);
  const detailTrainer = detailId ? getTrainerInfo(detailId) : null;
  const a = analysisQ.data;

  const selectCoach = (id: TrainerId) => {
    setAdvice(null);
    setCoachM.mutate({ coachId: id });
    setDetailId(null);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="pt-1">
        <div className="section-label mb-1">MYPERSOL</div>
        <h1 className="text-2xl font-bold text-slate-900">あなたのAIトレーナー</h1>
        <p className="text-xs text-muted-foreground mt-1">実データと栄養学の法則から、根拠つきで予測し食事を指導します。</p>
      </div>

      {/* トレーナー選択 */}
      <div className="rounded-xl px-4 py-4" style={CARD}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 section-label">
            <Sparkles className="h-3.5 w-3.5" />
            トレーナーを選ぶ
          </div>
          <span className="text-[10px] text-muted-foreground">タップで詳細</span>
        </div>
        <div className="space-y-3">
          {TRAINER_GROUPS.map((g) => (
            <div key={g.group}>
              <div className="text-[11px] font-semibold text-slate-700">{g.group}</div>
              <div className="text-[10px] text-muted-foreground mb-2">{g.desc}</div>
              <div className="grid grid-cols-2 gap-2">
                {TRAINERS.filter((t) => t.group === g.group).map((t) => {
                  const active = coachId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setDetailId(t.id)}
                      className="rounded-xl px-3 py-2.5 flex items-center gap-2 text-left transition-all relative"
                      style={
                        active
                          ? { background: "oklch(0.965 0.004 250)", border: `2px solid ${t.accent}` }
                          : INNER
                      }
                    >
                      <TrainerAvatar id={t.id} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-900 flex items-center gap-1">
                          {t.name}
                          {active && <Check className="h-3.5 w-3.5" style={{ color: t.accent }} />}
                        </div>
                        <div className="text-[10px] text-muted-foreground leading-tight">{t.tagline}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 目標未設定 / データ不足の案内 */}
      {a && !a.dataReady && (
        <div className="rounded-xl px-4 py-4 flex items-center gap-3" style={CARD}>
          <Flame className="h-5 w-5 flex-shrink-0" style={{ color: "oklch(0.38 0.14 268)" }} />
          <div className="flex-1 min-w-0 text-sm text-muted-foreground leading-relaxed">
            {a.reason || "食事を数日記録すると、根拠つきの予測とアドバイスが出ます。"}
          </div>
          <Link href={a.reason.includes("目標") ? "/goal" : "/meals"}>
            <Button size="sm" className="flex-shrink-0 text-xs h-8 px-3 rounded-lg">
              {a.reason.includes("目標") ? "目標設定" : "記録する"}
            </Button>
          </Link>
        </div>
      )}

      {/* 現状（根拠つき） */}
      {a && a.dataReady && (
        <div className="rounded-xl px-4 py-4" style={CARD}>
          <div className="flex items-center gap-2 section-label mb-3">
            <Flame className="h-3.5 w-3.5" />
            いまの現状（根拠）
          </div>
          <div className="space-y-2 text-sm">
            <Row label="直近7日の平均摂取" value={`${a.avgIntake} kcal`} />
            <Row label="消費（維持カロリー）" value={`${a.tdee} kcal`} />
            {a.avgBurn > 0 && <Row label="運動の平均消費" value={`+${a.avgBurn} kcal/日`} sub />}
            <div className="h-px my-1" style={{ background: "oklch(0.92 0.006 250)" }} />
            <Row
              label="1日のカロリー収支"
              value={`${a.dailyDeficit != null && a.dailyDeficit >= 0 ? "−" : "+"}${Math.abs(a.dailyDeficit ?? 0)} kcal`}
              strong
              color={a.dailyDeficit != null && a.dailyDeficit >= 0 ? GREEN : "oklch(0.65 0.2 25)"}
            />
            <Row
              label="タンパク質"
              value={`${a.avgProteinG}g ${a.targetProteinG ? `/ 目標${a.targetProteinG}g` : ""}`}
              color={a.targetProteinG && (a.avgProteinG ?? 0) < a.targetProteinG ? "oklch(0.65 0.2 25)" : undefined}
            />
          </div>
        </div>
      )}

      {/* 予測（根拠2本立て） */}
      {a && a.dataReady && a.perWeekBlended != null && (
        <div className="rounded-xl px-4 py-4" style={CARD}>
          <div className="flex items-center gap-2 section-label mb-3">
            <TrendingDown className="h-3.5 w-3.5" />
            予測（このペースで続けると）
          </div>

          {a.targetDate && a.projAtTarget != null ? (
            <div className="rounded-lg px-4 py-3 mb-3" style={INNER}>
              <div className="text-xs text-muted-foreground">
                {formatDate(a.targetDate)}
                {a.daysToTarget != null && a.daysToTarget >= 0 ? `（あと${a.daysToTarget}日）` : ""} まで
              </div>
              <div className="text-2xl font-bold mt-0.5" style={{ color: GREEN }}>
                約{a.projAtTarget.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">kg</span>
              </div>
              {a.targetWeight != null && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {a.onTrack
                    ? `目標 ${a.targetWeight.toFixed(1)}kg を達成できる見込み🎯`
                    : `目標 ${a.targetWeight.toFixed(1)}kg まで あと${Math.abs((a.projAtTarget ?? 0) - a.targetWeight).toFixed(1)}kg の見込み`}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground mb-3">
              ホームの体重予測で目標日を設定すると、その日の予測体重も出ます。
            </div>
          )}

          {/* 根拠の内訳 */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="週ペース(総合)" value={fmtKg(a.perWeekBlended)} />
            <Stat label="カロリー収支から" value={a.perWeekBalance != null ? fmtKg(a.perWeekBalance) : "—"} />
            <Stat label="体重実測から" value={a.perWeekMeasured != null ? fmtKg(a.perWeekMeasured) : "—"} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Stat label="1ヶ月後" value={a.proj30 != null ? `約${a.proj30.toFixed(1)}kg` : "—"} />
            <Stat label="3ヶ月後" value={a.proj90 != null ? `約${a.proj90.toFixed(1)}kg` : "—"} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
            ※ カロリー収支（摂取−維持）と体重の実測トレンドの2つから算出。記録が増えるほど精度が上がります。
          </div>
        </div>
      )}

      {/* AIアドバイス */}
      <div className="rounded-xl px-4 py-4" style={CARD}>
        <div className="flex items-center gap-2 section-label mb-3">
          <Utensils className="h-3.5 w-3.5" />
          {trainer ? `${trainer.name}からのアドバイス` : "食事アドバイス"}
        </div>

        {!trainer ? (
          <div className="text-[11px] text-muted-foreground">まずは上でトレーナーを選んでください。</div>
        ) : !advice ? (
          <div className="flex items-center gap-3">
            <TrainerAvatar id={trainer.id} size={48} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground leading-relaxed mb-2">
                今のデータをもとに、{trainer.name}が食事の改善とペースの巻き上げを具体的に指導します。
              </div>
              <Button
                className="h-10 rounded-lg font-bold w-full"
                style={{ background: trainer.accent }}
                disabled={adviceM.isPending || !(a && a.dataReady)}
                onClick={() => adviceM.mutate()}
              >
                {adviceM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                アドバイスをもらう
              </Button>
              {!(a && a.dataReady) && (
                <div className="text-[10px] text-muted-foreground mt-1">※ 目標設定と数日の食事記録が必要です</div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <TrainerAvatar id={trainer.id} size={44} />
              <div className="flex-1 min-w-0 rounded-xl px-3 py-2.5" style={INNER}>
                <div className="text-sm text-slate-900 leading-relaxed">{advice.summary}</div>
              </div>
            </div>

            <div className="rounded-xl px-4 py-3" style={{ background: `${trainer.accent.replace(")", " / 0.1)")}`, border: `1px solid ${trainer.accent.replace(")", " / 0.2)")}` }}>
              <div className="text-[10px] font-bold mb-1" style={{ color: trainer.accent }}>今日やること</div>
              <div className="text-sm text-slate-900 leading-relaxed">{advice.todayAdvice}</div>
            </div>

            {advice.foodImprovements.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-700">食事の改善ポイント</div>
                {advice.foodImprovements.map((f, i) => (
                  <div key={i} className="rounded-xl px-3 py-2.5" style={INNER}>
                    <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                      <Salad className="h-3.5 w-3.5" style={{ color: GREEN }} />
                      {f.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{f.detail}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl px-3 py-2.5" style={INNER}>
              <div className="text-[10px] font-bold text-slate-700 mb-1">目標日への見立て</div>
              <div className="text-sm text-slate-900 leading-relaxed">{advice.paceVerdict}</div>
            </div>

            {advice.warning && (
              <div className="rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: "oklch(0.95 0.05 50)", border: "1px solid oklch(0.8 0.1 50)" }}>
                <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "oklch(0.55 0.15 50)" }} />
                <div className="text-[11px] text-slate-800 leading-relaxed">{advice.warning}</div>
              </div>
            )}

            <Button
              variant="outline"
              className="h-9 rounded-lg text-xs w-full"
              disabled={adviceM.isPending}
              onClick={() => adviceM.mutate()}
            >
              {adviceM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              更新する
            </Button>
          </div>
        )}
      </div>

      {/* 安全の方針 */}
      <div className="rounded-xl px-4 py-3 flex items-start gap-2" style={INNER}>
        <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: GREEN }} />
        <div className="text-[10px] text-muted-foreground leading-relaxed">
          リバウンド防止のため、減量は週あたり体重の約1%・月およそ4kgまでを上限に、高タンパクで筋肉を守る現実的なプランのみ提案します。1ヶ月−10kgのような無理は出しません。
        </div>
      </div>

      {/* トレーナー詳細モーダル */}
      {detailTrainer && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
          onClick={() => setDetailId(null)}
        >
          <div className="absolute inset-0" style={{ background: "oklch(0 0 0 / 0.45)" }} />
          <div
            className="relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
            style={{ background: "white", paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute right-4 top-4 text-muted-foreground tap-target"
              onClick={() => setDetailId(null)}
              aria-label="閉じる"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 pr-8">
              <TrainerAvatar id={detailTrainer.id} size={64} />
              <div className="min-w-0">
                <div className="text-xl font-bold text-slate-900">{detailTrainer.name}</div>
                <div className="text-[11px] text-muted-foreground">{detailTrainer.group}</div>
              </div>
            </div>

            <div
              className="rounded-xl px-4 py-3 text-sm font-bold text-slate-900"
              style={{ background: detailTrainer.accent.replace(/\)\s*$/, " / 0.12)") }}
            >
              {detailTrainer.catch}
            </div>

            <DetailRow icon={<Sparkles className="h-4 w-4" />} accent={detailTrainer.accent} title="どんなトレーナー？" text={detailTrainer.summary} />
            <DetailRow icon={<HeartHandshake className="h-4 w-4" />} accent={detailTrainer.accent} title="こんな人にピッタリ" text={detailTrainer.forWho} />
            <DetailRow icon={<UtensilsCrossed className="h-4 w-4" />} accent={detailTrainer.accent} title="食事のすすめ方" text={detailTrainer.how} />
            <DetailRow icon={<Target className="h-4 w-4" />} accent={detailTrainer.accent} title="目指す体・ペース" text={detailTrainer.pace} />

            <div className="rounded-xl px-3 py-2.5 flex items-start gap-2" style={INNER}>
              <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: GREEN }} />
              <div className="text-[10px] text-muted-foreground leading-relaxed">
                どのトレーナーも、体をこわす無理な減量（1ヶ月−10kgなど）はしません。安全な範囲（週は体重の約1%・月およそ4kgまで）で、筋肉を守りながら進めます。
              </div>
            </div>

            {coachId === detailTrainer.id ? (
              <div className="text-center text-sm font-bold py-2" style={{ color: detailTrainer.accent }}>
                ✓ いま選んでいるトレーナーです
              </div>
            ) : (
              <Button
                className="w-full h-12 rounded-xl font-bold"
                style={{ background: detailTrainer.accent }}
                disabled={setCoachM.isPending}
                onClick={() => selectCoach(detailTrainer.id)}
              >
                {setCoachM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                このトレーナーにする
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, accent, title, text }: { icon: React.ReactNode; accent: string; title: string; text: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1 text-sm font-bold text-slate-900">
        <span style={{ color: accent }}>{icon}</span>
        {title}
      </div>
      <div className="text-[13px] text-slate-700 leading-relaxed">{text}</div>
    </div>
  );
}

function fmtKg(perWeek: number): string {
  return `${perWeek > 0 ? "+" : ""}${perWeek.toFixed(2)}kg/週`;
}

function Row({ label, value, strong, sub, color }: { label: string; value: string; strong?: boolean; sub?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-muted-foreground ${sub ? "text-[11px]" : "text-xs"}`}>{label}</span>
      <span className={`${strong ? "text-base font-bold" : "text-sm font-semibold"}`} style={{ color: color ?? "oklch(0.2 0.02 252)" }}>
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={INNER}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-bold text-slate-900 mt-0.5">{value}</div>
    </div>
  );
}
