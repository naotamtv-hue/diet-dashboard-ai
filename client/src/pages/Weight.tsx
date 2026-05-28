import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <div className="space-y-5">
      <div>
        <div className="text-[11px] tracking-wider-jp text-muted-foreground">WEIGHT</div>
        <h1 className="font-display text-3xl text-primary mt-1">体重の推移</h1>
      </div>

      {/* サマリー */}
      <Card className="p-5 bg-white/70 border-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] tracking-wider-jp text-muted-foreground">
          <TrendingDown className="h-3.5 w-3.5" />
          推移サマリー
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <Box label="開始" value={startW != null ? startW.toFixed(1) : "—"} />
          <Box label="現在" value={currentW != null ? currentW.toFixed(1) : "—"} highlight />
          <Box label="目標" value={targetW != null ? targetW.toFixed(1) : "—"} />
        </div>
        {startW != null && currentW != null && (
          <div className="mt-3 text-[11px] tracking-wider-jp text-muted-foreground">
            開始から{" "}
            <strong className="text-primary">
              {(startW - currentW).toFixed(1)} kg
            </strong>{" "}
            の変化
          </div>
        )}
      </Card>

      {/* チャート */}
      <Card className="p-4 bg-white/70 border-white/70 backdrop-blur-sm">
        <div className="text-[11px] tracking-wider-jp text-muted-foreground mb-2">
          推移グラフ
        </div>
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
                    <stop offset="0%" stopColor="oklch(0.72 0.12 320)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="oklch(0.78 0.11 160)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.9 0.025 320)" strokeDasharray="2 4" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="oklch(0.55 0.04 295)" />
                <YAxis
                  domain={[Math.floor(minW), Math.ceil(maxW)]}
                  tick={{ fontSize: 10 }}
                  stroke="oklch(0.55 0.04 295)"
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.99 0.005 320)",
                    border: "1px solid oklch(0.9 0.025 320)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v.toFixed(1)} kg`, "体重"]}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="oklch(0.55 0.1 295)"
                  strokeWidth={2}
                  fill="url(#w)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* 入力 */}
      <Card className="p-4 bg-white/70 border-white/70 backdrop-blur-sm space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] tracking-wider-jp">日付</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-white/70"
            />
          </div>
          <div>
            <Label className="text-[11px] tracking-wider-jp">体重 (kg)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="bg-white/70"
              placeholder="例: 62.4"
            />
          </div>
        </div>
        <div>
          <Label className="text-[11px] tracking-wider-jp">メモ（任意）</Label>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-white/70"
            placeholder="体調や朝食前後など"
          />
        </div>
        <Button
          onClick={submit}
          disabled={addM.isPending}
          className="w-full rounded-full"
        >
          {addM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          記録する
        </Button>
      </Card>

      {/* 履歴 */}
      <Card className="p-4 bg-white/60 border-white/70 backdrop-blur-sm">
        <div className="text-[11px] tracking-wider-jp text-muted-foreground mb-2">
          記録履歴
        </div>
        {data.length === 0 ? (
          <div className="text-xs text-muted-foreground">まだ記録がありません</div>
        ) : (
          <div className="space-y-2">
            {[...(listQ.data ?? [])]
              .sort((a, b) => (a.recordDate > b.recordDate ? -1 : 1))
              .map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 bg-white/50 rounded-2xl px-3 py-2 border border-white/70"
                >
                  <div className="flex-1">
                    <div className="font-display text-base text-primary leading-none">
                      {Number(r.weightKg).toFixed(1)}{" "}
                      <span className="text-xs text-muted-foreground">kg</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {r.recordDate} {r.note ? `· ${r.note}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => removeM.mutate({ id: r.id })}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Box({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
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
      <div className="mt-0.5 font-display text-lg text-primary leading-none">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">kg</div>
    </div>
  );
}
