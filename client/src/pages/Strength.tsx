import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { todayDateString } from "@/lib/labels";
import {
  Calculator,
  ChevronLeft,
  Copy,
  Dumbbell,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const CARD = {
  background: "oklch(0.20 0.05 240)",
  border: "1px solid oklch(0.30 0.04 240)",
} as const;
const INNER = {
  background: "oklch(0.24 0.04 240)",
  border: "1px solid oklch(0.30 0.04 240)",
} as const;
const ACCENT = "oklch(0.62 0.18 220)";

const BODY_PARTS = ["chest", "back", "legs", "shoulders", "arms", "abs", "cardio", "other"] as const;
type BodyPart = (typeof BODY_PARTS)[number];
const BODY_PART_LABELS: Record<BodyPart, string> = {
  chest: "胸",
  back: "背中",
  legs: "脚",
  shoulders: "肩",
  arms: "腕",
  abs: "腹筋",
  cardio: "有酸素",
  other: "その他",
};

type SetRow = { weightKg: string; reps: string; memo: string };

/** Epley式の推定1RM。 */
function estimate1RM(weight: number, reps: number): number {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export default function Strength() {
  const [today] = useState(todayDateString);
  const [bodyPart, setBodyPart] = useState<BodyPart>("chest");
  const [selected, setSelected] = useState<{ name: string; bodyPart: BodyPart } | null>(null);
  const [tool, setTool] = useState<null | "rm">(null);

  const utils = trpc.useUtils();
  const exercisesQ = trpc.strength.exercises.useQuery();
  const setsByDateQ = trpc.strength.setsByDate.useQuery({ date: today });

  const volume = useMemo(() => {
    return (setsByDateQ.data ?? []).reduce(
      (a, s) => a + (Number(s.weightKg) || 0) * (Number(s.reps) || 0),
      0
    );
  }, [setsByDateQ.data]);

  const exercisesByPart = useMemo(() => {
    const map: Record<string, { name: string }[]> = {};
    for (const e of exercisesQ.data ?? []) {
      (map[e.bodyPart] ??= []).push({ name: e.name });
    }
    return map;
  }, [exercisesQ.data]);

  // 今日その種目を何セット記録済みか
  const doneCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of setsByDateQ.data ?? []) m[s.exerciseName] = (m[s.exerciseName] ?? 0) + 1;
    return m;
  }, [setsByDateQ.data]);

  if (selected) {
    return (
      <ExerciseLogger
        date={today}
        bodyPart={selected.bodyPart}
        exerciseName={selected.name}
        onBack={() => {
          setSelected(null);
          utils.strength.setsByDate.invalidate({ date: today });
        }}
      />
    );
  }

  if (tool === "rm") {
    return <RmCalculator onBack={() => setTool(null)} />;
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-end justify-between pt-1">
        <div>
          <div className="section-label mb-1">STRENGTH</div>
          <h1 className="text-2xl font-bold text-white">筋トレ</h1>
        </div>
        <button
          onClick={() => setTool("rm")}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: "oklch(0.62 0.18 220 / 0.18)", color: ACCENT, border: "1px solid oklch(0.62 0.18 220 / 0.3)" }}
        >
          <Calculator className="h-3.5 w-3.5" /> RM計算機
        </button>
      </div>

      {/* 今日のサマリー */}
      <div className="rounded-xl px-4 py-4" style={CARD}>
        <div className="flex items-center gap-2 section-label mb-3">
          <Dumbbell className="h-3.5 w-3.5" /> 今日の記録
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl px-4 py-3" style={{ background: "oklch(0.62 0.18 220 / 0.15)", border: "1px solid oklch(0.62 0.18 220 / 0.3)" }}>
            <div className="text-[10px] font-medium text-muted-foreground">合計負荷量</div>
            <div className="text-2xl font-bold mt-1" style={{ color: ACCENT }}>
              {(volume / 1000).toFixed(2)}<span className="text-sm font-normal text-muted-foreground ml-1">t</span>
            </div>
          </div>
          <div className="rounded-xl px-4 py-3" style={INNER}>
            <div className="text-[10px] font-medium text-muted-foreground">セット数</div>
            <div className="text-2xl font-bold text-white mt-1">{setsByDateQ.data?.length ?? 0}</div>
          </div>
        </div>
      </div>

      {/* 部位タブ */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {BODY_PARTS.map((p) => (
          <button
            key={p}
            onClick={() => setBodyPart(p)}
            className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0"
            style={
              bodyPart === p
                ? { background: ACCENT, color: "white" }
                : { background: "oklch(0.24 0.04 240)", color: "oklch(0.65 0.03 220)" }
            }
          >
            {BODY_PART_LABELS[p]}
          </button>
        ))}
      </div>

      {/* 種目リスト */}
      <div className="rounded-xl px-4 py-4 space-y-2" style={CARD}>
        <div className="flex items-center justify-between mb-1">
          <div className="section-label">{BODY_PART_LABELS[bodyPart]} の種目</div>
          <AddExerciseButton bodyPart={bodyPart} onAdded={() => exercisesQ.refetch()} />
        </div>
        {(exercisesByPart[bodyPart] ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">種目がありません。右上の「＋種目」で追加できます。</p>
        ) : (
          <div className="space-y-2">
            {(exercisesByPart[bodyPart] ?? []).map((ex) => (
              <button
                key={ex.name}
                onClick={() => setSelected({ name: ex.name, bodyPart })}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors"
                style={INNER}
              >
                <Dumbbell className="h-4 w-4 flex-shrink-0" style={{ color: ACCENT }} />
                <span className="flex-1 text-sm font-semibold text-white">{ex.name}</span>
                {doneCount[ex.name] ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "oklch(0.62 0.18 220 / 0.2)", color: ACCENT }}>
                    {doneCount[ex.name]}セット
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 履歴（日別ボリューム） */}
      <HistorySection onPick={(p) => setBodyPart(p)} />
    </div>
  );
}

/* ───────────────── 履歴：日別ボリューム集計＋ミニ棒グラフ ───────────────── */
function HistorySection({ onPick }: { onPick: (p: BodyPart) => void }) {
  const historyQ = trpc.strength.history.useQuery({ days: 30 });
  const rows = historyQ.data ?? [];

  if (historyQ.isLoading) {
    return (
      <div className="rounded-xl px-4 py-6 text-center text-xs text-muted-foreground" style={CARD}>
        履歴を読み込み中...
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl px-4 py-6 text-center" style={CARD}>
        <div className="section-label mb-1">HISTORY</div>
        <p className="text-xs text-muted-foreground">まだ記録がありません。種目を選んでセットを保存すると、ここに履歴が出ます。</p>
      </div>
    );
  }

  // 直近14日のミニ棒グラフ（古い→新しいで左→右）
  const recent = rows.slice(0, 14).slice().reverse();
  const maxVol = Math.max(1, ...recent.map((r) => r.volume));
  const md = (s: string) => s.slice(5).replace("-", "/");

  return (
    <div className="rounded-xl px-4 py-4 space-y-3" style={CARD}>
      <div className="section-label">HISTORY · 日別ボリューム</div>

      {/* ミニ棒グラフ */}
      <div className="flex items-end gap-1 h-24">
        {recent.map((r) => (
          <div key={r.date} className="flex-1 flex flex-col items-center justify-end h-full">
            <div
              className="w-full max-w-[22px] rounded-t-sm"
              style={{
                height: `${Math.max(4, (r.volume / maxVol) * 100)}%`,
                background: ACCENT,
                opacity: 0.85,
              }}
              title={`${r.date}: ${r.volume.toLocaleString()}kg`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground -mt-1">
        <span>{md(recent[0].date)}</span>
        <span>{md(recent[recent.length - 1].date)}</span>
      </div>

      {/* 日別リスト */}
      <div className="space-y-2 pt-1">
        {rows.map((r) => (
          <div key={r.date} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={INNER}>
            <div className="text-sm font-bold text-white w-14 flex-shrink-0">{md(r.date)}</div>
            <div className="flex flex-wrap gap-1 flex-1 min-w-0">
              {r.bodyParts.map((bp) => (
                <button
                  key={bp}
                  onClick={() => onPick(bp as BodyPart)}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "oklch(0.62 0.18 220 / 0.18)", color: ACCENT }}
                >
                  {BODY_PART_LABELS[bp as BodyPart] ?? bp}
                </button>
              ))}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-bold text-white tabular-nums">{(r.volume / 1000).toFixed(2)}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">t</span></div>
              <div className="text-[10px] text-muted-foreground">{r.sets}セット</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddExerciseButton({ bodyPart, onAdded }: { bodyPart: BodyPart; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const addM = trpc.strength.addExercise.useMutation({
    onSuccess: () => {
      setName("");
      setOpen(false);
      onAdded();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-semibold flex items-center gap-1" style={{ color: ACCENT }}>
        <Plus className="h-3.5 w-3.5" /> 種目
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="種目名"
        className="h-8 w-32 text-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) addM.mutate({ bodyPart, name: name.trim() });
        }}
      />
      <Button size="sm" className="h-8 px-2 text-xs" disabled={!name.trim() || addM.isPending} onClick={() => addM.mutate({ bodyPart, name: name.trim() })}>
        追加
      </Button>
    </div>
  );
}

/* ───────────────── 種目ログ画面（セット記録＋タイマー＋RM） ───────────────── */
function ExerciseLogger({
  date,
  bodyPart,
  exerciseName,
  onBack,
}: {
  date: string;
  bodyPart: BodyPart;
  exerciseName: string;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const todaySetsQ = trpc.strength.setsByDate.useQuery({ date });
  const lastQ = trpc.strength.lastSets.useQuery({ exerciseName, beforeDate: date });

  const [rows, setRows] = useState<SetRow[]>([{ weightKg: "", reps: "", memo: "" }]);
  const [loaded, setLoaded] = useState(false);

  // 既存の今日の記録があれば読み込む
  useEffect(() => {
    if (loaded || !todaySetsQ.data) return;
    const mine = todaySetsQ.data.filter((s) => s.exerciseName === exerciseName);
    if (mine.length > 0) {
      setRows(
        mine.map((s) => ({
          weightKg: s.weightKg ?? "",
          reps: s.reps != null ? String(s.reps) : "",
          memo: s.memo ?? "",
        }))
      );
    }
    setLoaded(true);
  }, [todaySetsQ.data, loaded, exerciseName]);

  const saveM = trpc.strength.saveSets.useMutation({
    onSuccess: () => {
      utils.strength.setsByDate.invalidate({ date });
      toast.success("セットを保存しました💪", { duration: 3000 });
    },
    onError: (e) => toast.error(e.message),
  });

  const addRow = () => setRows((r) => [...r, { weightKg: r[r.length - 1]?.weightKg ?? "", reps: "", memo: "" }]);
  const removeRow = (i: number) => setRows((r) => (r.length <= 1 ? r : r.filter((_, idx) => idx !== i)));
  const update = (i: number, key: keyof SetRow, val: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));

  const loadPrevious = () => {
    if (!lastQ.data || lastQ.data.sets.length === 0) {
      toast.error("前回の記録がありません");
      return;
    }
    setRows(
      lastQ.data.sets.map((s) => ({
        weightKg: s.weightKg ?? "",
        reps: s.reps != null ? String(s.reps) : "",
        memo: "",
      }))
    );
    toast.success(`前回（${lastQ.data.date}）を読み込みました`);
  };

  const save = () => {
    saveM.mutate({
      date,
      bodyPart,
      exerciseName,
      sets: rows.map((r) => ({
        weightKg: r.weightKg.trim() === "" ? null : r.weightKg.trim(),
        reps: r.reps.trim() === "" ? null : Number(r.reps),
        memo: r.memo.trim() === "" ? null : r.memo.trim(),
      })),
    });
  };

  const volume = rows.reduce((a, r) => a + (Number(r.weightKg) || 0) * (Number(r.reps) || 0), 0);

  return (
    <div className="space-y-4 pb-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={onBack} className="tap-target text-muted-foreground hover:text-white -ml-2">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="section-label">{BODY_PART_LABELS[bodyPart]}</div>
          <h1 className="text-xl font-bold text-white truncate">{exerciseName}</h1>
        </div>
      </div>

      <RestTimer />

      {/* 前回の記録 */}
      {lastQ.data && lastQ.data.sets.length > 0 && (
        <button
          onClick={loadPrevious}
          className="w-full flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs"
          style={INNER}
        >
          <Copy className="h-3.5 w-3.5 flex-shrink-0" style={{ color: ACCENT }} />
          <span className="text-muted-foreground">
            前回（{lastQ.data.date}）:{" "}
            {lastQ.data.sets.map((s) => `${s.weightKg ?? "-"}kg×${s.reps ?? "-"}`).join(" / ")}
          </span>
          <span className="ml-auto font-semibold flex-shrink-0" style={{ color: ACCENT }}>読込</span>
        </button>
      )}

      {/* セット入力 */}
      <div className="rounded-xl px-3 py-3 space-y-2" style={CARD}>
        <div className="grid grid-cols-[28px_1fr_1fr_44px] gap-2 px-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          <div>セット</div>
          <div>重量(kg)</div>
          <div>回数</div>
          <div className="text-right">1RM</div>
        </div>
        {rows.map((row, i) => {
          const rm = estimate1RM(Number(row.weightKg), Number(row.reps));
          return (
            <div key={i} className="grid grid-cols-[28px_1fr_1fr_44px] gap-2 items-center">
              <div className="text-sm font-bold text-center" style={{ color: ACCENT }}>{i + 1}</div>
              <Input
                type="number"
                inputMode="decimal"
                value={row.weightKg}
                onChange={(e) => update(i, "weightKg", e.target.value)}
                placeholder="40"
                className="h-11"
              />
              <Input
                type="number"
                inputMode="numeric"
                value={row.reps}
                onChange={(e) => update(i, "reps", e.target.value)}
                placeholder="10"
                className="h-11"
              />
              <div className="flex items-center justify-end gap-1">
                <span className="text-xs font-semibold text-white tabular-nums w-7 text-right">{rm || "-"}</span>
                <button
                  onClick={() => removeRow(i)}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  aria-label="削除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={addRow}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold mt-1"
          style={{ background: "oklch(0.24 0.04 240)", color: ACCENT }}
        >
          <Plus className="h-4 w-4" /> セットを追加
        </button>
      </div>

      {/* 合計負荷量 */}
      <div className="flex items-center justify-between rounded-xl px-4 py-3" style={INNER}>
        <span className="text-xs text-muted-foreground">この種目の負荷量</span>
        <span className="text-lg font-bold text-white">
          {volume.toLocaleString()}<span className="text-xs font-normal text-muted-foreground ml-1">kg</span>
        </span>
      </div>

      <Button onClick={save} disabled={saveM.isPending} className="w-full h-12 font-bold rounded-xl" style={{ background: ACCENT }}>
        {saveM.isPending ? "保存中..." : "保存する"}
      </Button>
    </div>
  );
}

/* ───────────────── インターバルタイマー ───────────────── */
function RestTimer() {
  const [preset, setPreset] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          setRunning(false);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const start = () => {
    if (remaining === 0) setRemaining(preset);
    setRunning(true);
  };
  const reset = () => {
    setRunning(false);
    setRemaining(preset);
  };
  const setP = (v: number) => {
    setPreset(v);
    setRemaining(v);
    setRunning(false);
  };

  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="rounded-xl px-4 py-3" style={CARD}>
      <div className="flex items-center gap-3">
        <Timer className="h-5 w-5 flex-shrink-0" style={{ color: remaining === 0 ? "oklch(0.72 0.18 155)" : ACCENT }} />
        <div className="text-3xl font-bold text-white tabular-nums w-[72px]">{mm}:{ss}</div>
        <div className="flex gap-1.5 ml-auto">
          <button
            onClick={running ? () => setRunning(false) : start}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: ACCENT }}
            aria-label={running ? "一時停止" : "開始"}
          >
            {running ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
          </button>
          <button
            onClick={reset}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "oklch(0.24 0.04 240)" }}
            aria-label="リセット"
          >
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
      <div className="flex gap-1.5 mt-2.5">
        {[30, 60, 90, 120, 180].map((v) => (
          <button
            key={v}
            onClick={() => setP(v)}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={preset === v ? { background: "oklch(0.62 0.18 220 / 0.25)", color: ACCENT } : { background: "oklch(0.24 0.04 240)", color: "oklch(0.6 0.03 220)" }}
          >
            {v}秒
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────── RM計算機（重量×回数→推定1RM＋%換算） ───────────────── */
const RM_PERCENTS: { pct: number; reps: string }[] = [
  { pct: 100, reps: "1回" },
  { pct: 95, reps: "2回" },
  { pct: 90, reps: "4回" },
  { pct: 85, reps: "6回" },
  { pct: 80, reps: "8回" },
  { pct: 75, reps: "10回" },
  { pct: 70, reps: "12回" },
  { pct: 65, reps: "15回" },
  { pct: 60, reps: "20回" },
];

function RmCalculator({ onBack }: { onBack: () => void }) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const w = Number(weight);
  const r = Number(reps);
  const rm = estimate1RM(w, r);

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2 pt-1">
        <button onClick={onBack} className="tap-target text-muted-foreground hover:text-white -ml-2">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="section-label">STRENGTH</div>
          <h1 className="text-xl font-bold text-white">RM計算機</h1>
        </div>
      </div>

      {/* 入力 */}
      <div className="rounded-xl px-4 py-4 space-y-3" style={CARD}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] text-muted-foreground">挙げた重量 (kg)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="60"
              className="h-12 mt-1 text-lg font-bold"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">挙げた回数</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="10"
              className="h-12 mt-1 text-lg font-bold"
            />
          </div>
        </div>

        {/* 推定1RM */}
        <div className="rounded-xl px-4 py-4 text-center" style={{ background: "oklch(0.62 0.18 220 / 0.15)", border: "1px solid oklch(0.62 0.18 220 / 0.3)" }}>
          <div className="text-[10px] font-medium text-muted-foreground">推定1RM（Epley式）</div>
          <div className="text-4xl font-bold mt-1" style={{ color: ACCENT }}>
            {rm || "-"}<span className="text-base font-normal text-muted-foreground ml-1">kg</span>
          </div>
        </div>
      </div>

      {/* %換算テーブル */}
      <div className="rounded-xl px-4 py-4 space-y-1.5" style={CARD}>
        <div className="section-label mb-2">目標重量の目安（%RM）</div>
        {rm ? (
          RM_PERCENTS.map((p) => (
            <div key={p.pct} className="flex items-center gap-3 rounded-lg px-3 py-2" style={INNER}>
              <span className="text-xs font-bold w-9 flex-shrink-0" style={{ color: ACCENT }}>{p.pct}%</span>
              <span className="text-lg font-bold text-white tabular-nums flex-1">
                {Math.round((rm * p.pct) / 100)}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">kg</span>
              </span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">目安 {p.reps}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground py-2">重量と回数を入力すると、各強度の目標重量が出ます。</p>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground px-1 leading-relaxed">
        ※ 推定値です（Epley式: 1RM = 重量 × (1 + 回数/30)）。実際に高重量を扱う際は補助を付けて安全に行ってください。
      </p>
    </div>
  );
}
