import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayDateString } from "@/lib/labels";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Trash2, TrendingDown } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

const GLASS = {
  background: "oklch(1 0 0 / 0.72)",
  border: "1px solid oklch(1 0 0 / 0.78)",
  backdropFilter: "blur(20px) saturate(1.4)",
  WebkitBackdropFilter: "blur(20px) saturate(1.4)",
  boxShadow: "0 1px 2px oklch(0.35 0.08 290 / 0.04), 0 4px 12px oklch(0.35 0.08 290 / 0.06), inset 0 1px 0 oklch(1 0 0 / 0.9)",
} as const;

export default function Weight() {
  const [date, setDate] = useState(todayDateString());
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");

  const utils = trpc.useUtils();
  const listQ = trpc.weights.list.useQuery();
  const latestQ = trpc.weights.latest.useQuery();
  const firstQ = trpc.weights.first.useQuery();
  const goalQ = trpc.goals.get.useQuery();

  const addM = trpc.weights.add.useMutation({
    onSuccess: () => {
      utils.weights.list.invalidate();
      utils.weights.latest.invalidate();
      utils.weights.first.invalidate();
    },
  });
  const removeM = trpc.weights.remove.useMutation({
    onSuccess: () => {
      utils.weights.list.invalidate();
      utils.weights.latest.invalidate();
      utils.weights.first.invalidate();
    },
  });

  const data = (listQ.data ?? []).map((r) => ({
    date: r.recordDate,
    label: r.recordDate.slice(5),
    weight: Number(r.weightKg),
  }));

  const minW = data.length ? Math.min(...data.map((d) => d.weight)) - 1 : 50;
  const maxW = data.length ? Math.max(...data.map((d) => d.weight)) + 1 : 80;

  const startW = firstQ.data ? Number(firstQ.data.weightKg) : null;
  const currentW = latestQ.data ? Number(latestQ.data.weightKg) : null;
  const targetW = goalQ.data ? Number(goalQ.data.targetWeightKg) : null;

  const submit = async () => {
    const w = Number(weight);
    if (!w || w < 20 || w > 300) {
      toast.error("体重を正しく入力してください");
      return;
    }
    await addM.mutateAsync({ date, weightKg: w, note: note || null });
    setWeight("");
    setNote("");
    toast.success("体重を記録しました");
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="pt-1">
        <div className="page-label mb-1.5">WEIGHT</div>
        <h1 className="font-display" style={{ fontSize: "clamp(1.75rem,5vw,2.5rem)", color: "oklch(0.32 0.09 290)" }}>
          体重の推移
        </h1>
      </div>

      {/* サマリー */}
      <div className="rounded-2xl px-5 py-5" style={GLASS}>
        <div className="flex items-center gap-1.5 page-label mb-3">
          <TrendingDown className="h-3 w-3" />
          推移サマリー
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <Box label="開始" value={startW != null ? startW.toFixed(1) : "—"} />
          <Box label="現在" value={currentW != null ? currentW.toFixed(1) : "—"} highlight />
          <Box label="目標" value={targetW != null ? targetW.toFixed(1) : "—"} />
        </div>
        {startW != null && currentW != null && (
          <div className="mt-3 text-xs tracking-wider-jp text-muted-foreground">
            開始から{" "}
            <strong style={{ color: "oklch(0.45 0.1 290)" }}>
              {(startW - currentW).toFixed(1)} kg
            </strong>{" "}
            の変化
          </div>
        )}
      </div>

      {/* チャート */}
      <div className="rounded-2xl px-5 py-5" style={GLASS}>
        <div className="page-label mb-3">推移グラフ</div>
        <div className="h-56">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              記録するとグラフが表示されます
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="w" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.12 290)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.78 0.08 320)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.9 0.02 290 / 0.5)" strokeDasharray="2 4" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.55 0.04 295)" }} stroke="transparent" />
                <YAxis
                  domain={[Math.floor(minW), Math.ceil(maxW)]}
                  tick={{ fontSize: 10, fill: "oklch(0.55 0.04 295)" }}
                  stroke="transparent"
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.99 0.005 290 / 0.95)",
                    border: "1px solid oklch(0.9 0.03 290 / 0.5)",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "0 4px 12px oklch(0.35 0.08 290 / 0.1)",
                  }}
                  formatter={(v: number) => [`${v.toFixed(1)} kg`, "体重"]}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="oklch(0.52 0.12 290)"
                  strokeWidth={2.5}
                  fill="url(#w)"
                  dot={{ r: 3, fill: "oklch(0.52 0.12 290)", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "oklch(0.52 0.12 290)", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 入力フォーム */}
      <div className="rounded-2xl px-5 py-5 space-y-4" style={GLASS}>
        <div className="page-label">体重を記録</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="page-label">日付</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="page-label">体重 (kg)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="例: 62.4"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="page-label">メモ（任意）</Label>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="体調や朝食前後など"
          />
        </div>
        <Button onClick={submit} disabled={addM.isPending} className="w-full rounded-xl h-11 font-medium">
          {addM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          記録する
        </Button>
      </div>

      {/* 履歴 */}
      <div className="rounded-2xl px-5 py-5" style={GLASS}>
        <div className="page-label mb-3">記録履歴</div>
        {data.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">まだ記録がありません</div>
        ) : (
          <div className="space-y-2">
            {[...(listQ.data ?? [])]
              .sort((a, b) => (a.recordDate > b.recordDate ? -1 : 1))
              .map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{
                    background: "oklch(0.97 0.015 290 / 0.55)",
                    border: "1px solid oklch(0.9 0.02 290 / 0.4)",
                  }}
                >
                  <div className="flex-1">
                    <div className="font-display text-xl leading-none" style={{ color: "oklch(0.35 0.08 290)" }}>
                      {Number(r.weightKg).toFixed(1)}{" "}
                      <span className="text-xs text-muted-foreground font-sans">kg</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 tracking-wider-jp">
                      {r.recordDate}{r.note ? ` · ${r.note}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => removeM.mutate({ id: r.id })}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
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

function Box({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: highlight ? "oklch(0.93 0.06 290 / 0.35)" : "oklch(0.97 0.015 290 / 0.55)",
        border: `1px solid ${highlight ? "oklch(0.75 0.1 290 / 0.3)" : "oklch(0.9 0.02 290 / 0.4)"}`,
      }}
    >
      <div className="text-[10px] tracking-wider-jp text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-display text-xl leading-none" style={{ color: "oklch(0.35 0.08 290)" }}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">kg</div>
    </div>
  );
}
