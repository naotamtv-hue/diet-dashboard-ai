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
import { MEAL_TYPES, MEAL_TYPE_LABELS, fileToDataUrl, todayDateString } from "@/lib/labels";
import { trpc } from "@/lib/trpc";
import { Camera, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type Analysis = {
  description: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  confidence: "low" | "medium" | "high";
};

export default function Meals() {
  const [date, setDate] = useState(todayDateString());
  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number]>("lunch");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [fatG, setFatG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const listQ = trpc.meals.listByDate.useQuery({ date });
  const summaryQ = trpc.meals.summary.useQuery({ date });

  const analyzeM = trpc.meals.analyzePhoto.useMutation();
  const addM = trpc.meals.add.useMutation({
    onSuccess: () => {
      utils.meals.listByDate.invalidate({ date });
      utils.meals.summary.invalidate({ date });
    },
  });
  const removeM = trpc.meals.remove.useMutation({
    onSuccess: () => {
      utils.meals.listByDate.invalidate({ date });
      utils.meals.summary.invalidate({ date });
    },
  });

  const onPickPhoto = async (file: File) => {
    try {
      setAnalyzing(true);
      const dataUrl = await fileToDataUrl(file);
      const res = await analyzeM.mutateAsync({ imageDataUrl: dataUrl });
      const a = res.analysis as Analysis;
      setImageUrl(res.imageUrl);
      setDescription(a.description);
      setCalories(String(a.calories));
      setProteinG(String(a.proteinG));
      setFatG(String(a.fatG));
      setCarbsG(String(a.carbsG));
      toast.success(`AI解析完了（信頼度：${a.confidence}）`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "解析に失敗しました";
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const submit = async () => {
    const cal = Number(calories);
    if (!cal || cal < 0) {
      toast.error("カロリーを入力してください");
      return;
    }
    await addM.mutateAsync({
      date,
      mealType,
      description: description || null,
      imageUrl,
      calories: Number(calories) || 0,
      proteinG: Number(proteinG) || 0,
      fatG: Number(fatG) || 0,
      carbsG: Number(carbsG) || 0,
    });
    setDescription("");
    setCalories("");
    setProteinG("");
    setFatG("");
    setCarbsG("");
    setImageUrl(null);
    toast.success("記録しました");
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] tracking-wider-jp text-muted-foreground">MEALS</div>
        <h1 className="font-display text-3xl text-primary mt-1">食事を記録</h1>
      </div>

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
            <Label className="text-[11px] tracking-wider-jp">区分</Label>
            <Select value={mealType} onValueChange={(v) => setMealType(v as typeof mealType)}>
              <SelectTrigger className="bg-white/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {MEAL_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickPhoto(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="bg-white/60 rounded-full flex-1"
            disabled={analyzing}
            onClick={() => fileRef.current?.click()}
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            写真からAI解析（gpt-4.1-mini）
          </Button>
        </div>

        {imageUrl && (
          <div className="rounded-2xl overflow-hidden border border-white/70">
            <img src={imageUrl} alt="食事" className="w-full max-h-60 object-cover" />
          </div>
        )}

        <div>
          <Label className="text-[11px] tracking-wider-jp">内容（任意）</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例：鶏むね肉のサラダと玄米ごはん"
            className="bg-white/70"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumField label="カロリー (kcal)" value={calories} onChange={setCalories} />
          <NumField label="タンパク質 (g)" value={proteinG} onChange={setProteinG} />
          <NumField label="脂質 (g)" value={fatG} onChange={setFatG} />
          <NumField label="炭水化物 (g)" value={carbsG} onChange={setCarbsG} />
        </div>

        <Button
          onClick={submit}
          disabled={addM.isPending}
          className="rounded-full w-full mt-1"
        >
          {addM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          記録する
        </Button>

        <div className="text-[10px] tracking-wider-jp text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          写真から推定される値は目安です。必要に応じて編集してください。
        </div>
      </Card>

      {/* 本日の集計 */}
      <Card className="p-4 bg-white/60 border-white/70 backdrop-blur-sm">
        <div className="text-[11px] tracking-wider-jp text-muted-foreground">
          選択日の合計
        </div>
        <div className="mt-2 flex items-end gap-4">
          <div>
            <div className="font-display text-3xl text-primary leading-none">
              {Math.round(summaryQ.data?.calories ?? 0)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">kcal</div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-[11px] flex-1">
            <div>
              <span className="text-muted-foreground">P</span>{" "}
              <strong>{Math.round(summaryQ.data?.proteinG ?? 0)}g</strong>
            </div>
            <div>
              <span className="text-muted-foreground">F</span>{" "}
              <strong>{Math.round(summaryQ.data?.fatG ?? 0)}g</strong>
            </div>
            <div>
              <span className="text-muted-foreground">C</span>{" "}
              <strong>{Math.round(summaryQ.data?.carbsG ?? 0)}g</strong>
            </div>
          </div>
        </div>
      </Card>

      {/* 区分別リスト */}
      {MEAL_TYPES.map((t) => {
        const list = (listQ.data ?? []).filter((m) => m.mealType === t);
        const kcal = list.reduce((a, m) => a + Number(m.calories), 0);
        return (
          <Card key={t} className="p-4 bg-white/70 border-white/70 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="font-display text-lg text-primary">
                {MEAL_TYPE_LABELS[t]}
              </div>
              <div className="text-[11px] tracking-wider-jp text-muted-foreground">
                {Math.round(kcal)} kcal / {list.length}件
              </div>
            </div>
            {list.length === 0 ? (
              <div className="text-[11px] text-muted-foreground mt-2">記録なし</div>
            ) : (
              <div className="mt-3 space-y-2">
                {list.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 bg-white/50 rounded-2xl px-3 py-2 border border-white/70"
                  >
                    {m.imageUrl && (
                      <img
                        src={m.imageUrl}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate">
                        {m.description || "（内容未入力）"}
                      </div>
                      <div className="text-[10px] tracking-wider-jp text-muted-foreground mt-0.5">
                        {Math.round(Number(m.calories))}kcal · P{Math.round(Number(m.proteinG))} /
                        F{Math.round(Number(m.fatG))} / C{Math.round(Number(m.carbsG))}
                      </div>
                    </div>
                    <button
                      className="text-muted-foreground hover:text-destructive p-1"
                      onClick={() => removeM.mutate({ id: m.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-[11px] tracking-wider-jp">{label}</Label>
      <Input
        inputMode="decimal"
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/70"
      />
    </div>
  );
}
