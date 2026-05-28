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
import { fileToDataUrl, todayDateString } from "@/lib/labels";
import { trpc } from "@/lib/trpc";
import { Camera, Loader2, Trash2 } from "lucide-react";
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

export default function Photos() {
  const utils = trpc.useUtils();
  const listQ = trpc.bodyPhotos.list.useQuery();
  const photos = listQ.data ?? [];

  const [date, setDate] = useState(todayDateString());
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadM = trpc.bodyPhotos.upload.useMutation({
    onSuccess: () => utils.bodyPhotos.list.invalidate(),
  });
  const removeM = trpc.bodyPhotos.remove.useMutation({
    onSuccess: () => utils.bodyPhotos.list.invalidate(),
  });

  const onPick = async (file: File) => {
    try {
      setUploading(true);
      const dataUrl = await fileToDataUrl(file);
      await uploadM.mutateAsync({
        date,
        imageDataUrl: dataUrl,
        weightKg: weight ? Number(weight) : null,
        note: note || null,
      });
      setWeight("");
      setNote("");
      toast.success("体型写真を保存しました");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const sorted = useMemo(
    () => [...photos].sort((a, b) => (a.recordDate < b.recordDate ? -1 : 1)),
    [photos]
  );
  const [beforeId, setBeforeId] = useState<string>("");
  const [afterId, setAfterId] = useState<string>("");

  useEffect(() => {
    if (sorted.length >= 2) {
      if (!beforeId) setBeforeId(String(sorted[0].id));
      if (!afterId) setAfterId(String(sorted[sorted.length - 1].id));
    }
  }, [sorted, beforeId, afterId]);

  const before = sorted.find((p) => String(p.id) === beforeId);
  const after = sorted.find((p) => String(p.id) === afterId);
  const diff =
    before?.weightKg && after?.weightKg
      ? Number(before.weightKg) - Number(after.weightKg)
      : null;

  return (
    <div className="space-y-4 pb-4">
      {/* Page Header */}
      <div className="pt-1">
        <div className="section-label mb-1">BODY PHOTOS</div>
        <h1 className="text-2xl font-bold text-white">体型の記録</h1>
        <p className="text-xs text-muted-foreground mt-1">
          数字に出ない変化を、写真で見える化しましょう
        </p>
      </div>

      {/* アップロードフォーム */}
      <div className="rounded-xl px-4 py-4 space-y-4" style={CARD}>
        <div className="section-label">写真を追加</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="section-label">日付</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="section-label">体重 (kg・任意)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="h-11"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="section-label">メモ（任意）</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例: 起床直後 / 朝食前"
            className="h-11"
          />
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
        <Button
          className="w-full h-12 font-bold rounded-xl"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Camera className="h-4 w-4 mr-2" />
          )}
          体型写真を追加
        </Button>
      </div>

      {/* ビフォーアフター比較 */}
      {sorted.length >= 2 && (
        <div className="rounded-xl px-4 py-4 space-y-4" style={CARD}>
          <div className="section-label">ビフォーアフター比較</div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="section-label">Before</Label>
              <Select value={beforeId} onValueChange={setBeforeId}>
                <SelectTrigger className="w-full h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sorted.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.recordDate}{p.weightKg ? ` / ${Number(p.weightKg).toFixed(1)}kg` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="section-label">After</Label>
              <Select value={afterId} onValueChange={setAfterId}>
                <SelectTrigger className="w-full h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sorted.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.recordDate}{p.weightKg ? ` / ${Number(p.weightKg).toFixed(1)}kg` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PhotoPane title="Before" photo={before} />
            <PhotoPane title="After" photo={after} />
          </div>

          {diff !== null && (
            <div
              className="rounded-xl px-4 py-3 text-center"
              style={{
                background: diff >= 0 ? "oklch(0.72 0.18 155 / 0.15)" : "oklch(0.65 0.22 25 / 0.15)",
                border: `1px solid ${diff >= 0 ? "oklch(0.72 0.18 155 / 0.3)" : "oklch(0.65 0.22 25 / 0.3)"}`,
              }}
            >
              <div className="section-label">体重変化</div>
              <div
                className="text-3xl font-bold mt-1"
                style={{ color: diff >= 0 ? "oklch(0.72 0.18 155)" : "oklch(0.65 0.22 25)" }}
              >
                {diff >= 0 ? "−" : "+"}
                {Math.abs(diff).toFixed(1)}
                <span className="text-base font-normal text-muted-foreground ml-1">kg</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 記録一覧 */}
      <div className="rounded-xl px-4 py-4" style={CARD}>
        <div className="section-label mb-3">記録一覧</div>
        {sorted.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">まだ写真がありません</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[...sorted].reverse().map((p) => (
              <div
                key={p.id}
                className="relative rounded-xl overflow-hidden"
                style={{ border: "1px solid oklch(0.30 0.04 240)" }}
              >
                <img
                  src={p.imageUrl}
                  alt={p.recordDate}
                  className="w-full aspect-square object-cover"
                />
                <div
                  className="px-2 py-1 text-[10px] text-white"
                  style={{ background: "oklch(0.12 0.05 240 / 0.9)" }}
                >
                  {p.recordDate}
                  {p.weightKg ? ` / ${Number(p.weightKg).toFixed(1)}kg` : ""}
                </div>
                <button
                  className="absolute top-1 right-1 rounded-full p-1 text-white hover:text-destructive transition-colors"
                  style={{ background: "oklch(0.12 0.05 240 / 0.85)" }}
                  onClick={() => removeM.mutate({ id: p.id })}
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

function PhotoPane({
  title,
  photo,
}: {
  title: string;
  photo: { id: number; recordDate: string; imageUrl: string; weightKg: string | null } | undefined;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid oklch(0.30 0.04 240)" }}
    >
      <div
        className="text-[10px] font-semibold text-muted-foreground px-2 py-1.5"
        style={{ background: "oklch(0.24 0.04 240)" }}
      >
        {title}
      </div>
      {photo ? (
        <>
          <img
            src={photo.imageUrl}
            alt={photo.recordDate}
            className="w-full aspect-square object-cover"
          />
          <div
            className="px-2 py-1 text-[10px] text-white"
            style={{ background: "oklch(0.12 0.05 240 / 0.9)" }}
          >
            {photo.recordDate}
            {photo.weightKg ? ` / ${Number(photo.weightKg).toFixed(1)}kg` : ""}
          </div>
        </>
      ) : (
        <div className="aspect-square flex items-center justify-center text-xs text-muted-foreground"
          style={{ background: "oklch(0.18 0.04 240)" }}>
          選択してください
        </div>
      )}
    </div>
  );
}
