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

const GLASS = {
  background: "oklch(1 0 0 / 0.72)",
  border: "1px solid oklch(1 0 0 / 0.78)",
  backdropFilter: "blur(20px) saturate(1.4)",
  WebkitBackdropFilter: "blur(20px) saturate(1.4)",
  boxShadow: "0 1px 2px oklch(0.35 0.08 290 / 0.04), 0 4px 12px oklch(0.35 0.08 290 / 0.06), inset 0 1px 0 oklch(1 0 0 / 0.9)",
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
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="pt-1">
        <div className="page-label mb-1.5">BODY PHOTOS</div>
        <h1 className="font-display" style={{ fontSize: "clamp(1.75rem,5vw,2.5rem)", color: "oklch(0.32 0.09 290)" }}>
          体型の記録
        </h1>
        <p className="text-xs text-muted-foreground mt-1 tracking-wide">
          数字に出ない変化を、写真で見える化しましょう
        </p>
      </div>

      {/* アップロードフォーム */}
      <div className="rounded-2xl px-5 py-5 space-y-4" style={GLASS}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="page-label">日付</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="page-label">体重 (kg・任意)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="page-label">メモ（任意）</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例: 起床直後 / 朝食前"
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
          className="w-full rounded-xl h-11 font-medium"
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
        <div className="rounded-2xl px-5 py-5 space-y-4" style={GLASS}>
          <div className="page-label">ビフォーアフター比較</div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="page-label">Before</Label>
              <Select value={beforeId} onValueChange={setBeforeId}>
                <SelectTrigger className="w-full">
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
              <Label className="page-label">After</Label>
              <Select value={afterId} onValueChange={setAfterId}>
                <SelectTrigger className="w-full">
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
              style={{ background: "oklch(0.93 0.06 290 / 0.25)", border: "1px solid oklch(0.85 0.06 290 / 0.3)" }}
            >
              <div className="page-label">体重変化</div>
              <div className="font-display text-3xl mt-1" style={{ color: "oklch(0.35 0.08 290)" }}>
                {diff >= 0 ? "−" : "+"}
                {Math.abs(diff).toFixed(1)}
                <span className="text-base font-sans ml-1">kg</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 記録一覧 */}
      <div className="rounded-2xl px-5 py-5" style={GLASS}>
        <div className="page-label mb-3">記録一覧</div>
        {sorted.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-6">まだ写真がありません</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[...sorted].reverse().map((p) => (
              <div
                key={p.id}
                className="relative rounded-xl overflow-hidden"
                style={{ border: "1px solid oklch(0.9 0.02 290 / 0.4)" }}
              >
                <img
                  src={p.imageUrl}
                  alt={p.recordDate}
                  className="w-full aspect-square object-cover"
                />
                <div
                  className="px-2 py-1 text-[10px] tracking-wider-jp text-muted-foreground"
                  style={{ background: "oklch(1 0 0 / 0.85)", backdropFilter: "blur(8px)" }}
                >
                  {p.recordDate}
                  {p.weightKg ? ` / ${Number(p.weightKg).toFixed(1)}kg` : ""}
                </div>
                <button
                  className="absolute top-1 right-1 rounded-full p-1 text-muted-foreground hover:text-destructive transition-colors"
                  style={{ background: "oklch(1 0 0 / 0.85)", backdropFilter: "blur(8px)" }}
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
      style={{ border: "1px solid oklch(0.9 0.02 290 / 0.4)" }}
    >
      <div
        className="text-[10px] tracking-wider-jp text-muted-foreground px-2 py-1.5"
        style={{ background: "oklch(0.97 0.015 290 / 0.55)" }}
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
            className="px-2 py-1 text-[10px] text-muted-foreground"
            style={{ background: "oklch(1 0 0 / 0.85)" }}
          >
            {photo.recordDate}
            {photo.weightKg ? ` / ${Number(photo.weightKg).toFixed(1)}kg` : ""}
          </div>
        </>
      ) : (
        <div className="aspect-square flex items-center justify-center text-xs text-muted-foreground">
          選択してください
        </div>
      )}
    </div>
  );
}
