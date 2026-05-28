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

const CARD = {
  background: "oklch(0.20 0.05 240)",
  border: "1px solid oklch(0.30 0.04 240)",
} as const;

const INNER = {
  background: "oklch(0.24 0.04 240)",
  border: "1px solid oklch(0.30 0.04 240)",
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
    <div className="space-y-4 pb-4">
      {/* Page Header */}
      <div className="pt-1">
        <div className="section-label mb-1">WEIGHT</div>
        <h1 className="text-2xl font-bold text-white">体重の推移</h1>
      </div>

      {/* サマリー */}
      <div className="rounded-xl px-4 py-4" style={CARD}>
        <div className="flex items-center gap-2 section-label mb-3">
          <TrendingDown className="h-3.5 w-3.5" />
          推移サマリー
        </div>
        <div className="grid grid-cols-3 gap-2">
          <WeightBox label="開始" value={startW != null ? startW.toFixed(1) : "—"} />
          <WeightBox label="現在" value={currentW != null ? currentW.toFixed(1) : "—"} highlight />
          <WeightBox label="目標" value={targetW != null ? targetW.toFixed(1) : "—"} />
        </div>
        {startW != null && currentW != null && (
          <div className="mt-3 text-xs text-muted-foreground">
            開始から{" "}
            <strong style={{ color: (startW - currentW) >= 0 ? "oklch(0.72 0.18 155)" : "oklch(0.65 0.22 25)" }}>
              {(startW - currentW) >= 0 ? "-" : "+"}{Math.abs(startW - currentW).toFixed(1)} kg
            </strong>{" "}
            の変化
          </div>
        )}
      </div>

      {/* チャート */}
      <div className="rounded-xl px-4 py-4" style={CARD}>
        <div className="section-label mb-3">推移グラフ</div>
        <div className="h-52">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              記録するとグラフが表示されます
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.28 0.04 240)" strokeDasharray="2 4" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "oklch(0.55 0.03 220)" }}
                  stroke="transparent"
                />
                <YAxis
                  domain={[Math.floor(minW), Math.ceil(maxW)]}
                  tick={{ fontSize: 10, fill: "oklch(0.55 0.03 220)" }}
                  stroke="transparent"
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.05 240)",
                    border: "1px solid oklch(0.30 0.04 240)",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "oklch(0.95 0.01 220)",
                  }}
                  formatter={(v: number) => [`${v.toFixed(1)} kg`, "体重"]}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fill="url(#wGrad)"
                  dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#3b82f6", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 入力フォーム */}
      <div className="rounded-xl px-4 py-4 space-y-4" style={CARD}>
        <div className="section-label">体重を記録</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="section-label">日付</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="section-label">体重 (kg)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="例: 62.4"
              className="h-11"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="section-label">メモ（任意）</Label>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="体調や朝食前後など"
            className="resize-none"
          />
        </div>
        <Button onClick={submit} disabled={addM.isPending} className="w-full h-12 font-bold rounded-xl">
          {addM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          記録する
        </Button>
      </div>

      {/* 履歴 */}
      <div className="rounded-xl px-4 py-4" style={CARD}>
        <div className="section-label mb-3">記録履歴</div>
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
                  style={INNER}
                >
                  <div className="flex-1">
                    <div className="text-xl font-bold text-white leading-none">
                      {Number(r.weightKg).toFixed(1)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">kg</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {r.recordDate}{r.note ? ` · ${r.note}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => removeM.mutate({ id: r.id })}
                    className="tap-target text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
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

function WeightBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-xl px-3 py-3 text-center"
      style={{
        background: highlight ? "oklch(0.62 0.18 220 / 0.15)" : "oklch(0.24 0.04 240)",
        border: `1px solid ${highlight ? "oklch(0.62 0.18 220 / 0.4)" : "oklch(0.30 0.04 240)"}`,
      }}
    >
      <div className="text-[10px] font-medium text-muted-foreground">{label}</div>
      <div
        className="text-xl font-bold mt-1 leading-none"
        style={{ color: highlight ? "oklch(0.62 0.18 220)" : "oklch(0.95 0.01 220)" }}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">kg</div>
    </div>
  );
}
