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
import { fileToDataUrl, todayDateString } from "@/lib/labels";
import { trpc } from "@/lib/trpc";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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

  // 比較選択
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
    <div className="space-y-5">
      <div>
        <div className="text-[11px] tracking-wider-jp text-muted-foreground">BODY PHOTOS</div>
        <h1 className="font-display text-3xl text-primary mt-1">体型の記録</h1>
        <div className="text-[11px] tracking-wider-jp text-muted-foreground mt-1">
          数字に出ない変化を、写真で見える化しましょう
        </div>
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
            <Label className="text-[11px] tracking-wider-jp">体重 (kg・任意)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="bg-white/70"
            />
          </div>
        </div>
        <div>
          <Label className="text-[11px] tracking-wider-jp">メモ（任意）</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-white/70"
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
          className="w-full rounded-full"
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
      </Card>

      {/* 比較 */}
      {sorted.length >= 2 && (
        <Card className="p-4 bg-white/70 border-white/70 backdrop-blur-sm">
          <div className="text-[11px] tracking-wider-jp text-muted-foreground">
            ビフォーアフター比較
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <Label className="text-[11px] tracking-wider-jp">Before</Label>
              <Select value={beforeId} onValueChange={setBeforeId}>
                <SelectTrigger className="bg-white/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sorted.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.recordDate}
                      {p.weightKg ? ` / ${Number(p.weightKg).toFixed(1)}kg` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] tracking-wider-jp">After</Label>
              <Select value={afterId} onValueChange={setAfterId}>
                <SelectTrigger className="bg-white/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sorted.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.recordDate}
                      {p.weightKg ? ` / ${Number(p.weightKg).toFixed(1)}kg` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Pane title="Before" photo={before} />
            <Pane title="After" photo={after} />
          </div>

          {diff !== null && (
            <div className="mt-3 rounded-2xl bg-primary/10 border border-primary/20 px-3 py-2.5 text-center">
              <div className="text-[10px] tracking-wider-jp text-muted-foreground">
                体重変化
              </div>
              <div className="font-display text-2xl text-primary mt-0.5">
                {diff >= 0 ? "-" : "+"}
                {Math.abs(diff).toFixed(1)} kg
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 一覧 */}
      <Card className="p-4 bg-white/60 border-white/70 backdrop-blur-sm">
        <div className="text-[11px] tracking-wider-jp text-muted-foreground mb-2">
          記録一覧
        </div>
        {sorted.length === 0 ? (
          <div className="text-xs text-muted-foreground">まだ写真がありません</div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[...sorted].reverse().map((p) => (
              <div
                key={p.id}
                className="relative rounded-2xl overflow-hidden border border-white/70 bg-white/50"
              >
                <img
                  src={p.imageUrl}
                  alt={p.recordDate}
                  className="w-full aspect-square object-cover"
                />
                <div className="px-2 py-1 text-[10px] tracking-wider-jp text-muted-foreground bg-white/80 backdrop-blur-sm">
                  {p.recordDate}
                  {p.weightKg ? ` / ${Number(p.weightKg).toFixed(1)}kg` : ""}
                </div>
                <button
                  className="absolute top-1 right-1 bg-white/80 backdrop-blur-sm rounded-full p-1 text-muted-foreground hover:text-destructive"
                  onClick={() => removeM.mutate({ id: p.id })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Pane({
  title,
  photo,
}: {
  title: string;
  photo:
    | {
        id: number;
        recordDate: string;
        imageUrl: string;
        weightKg: string | null;
      }
    | undefined;
}) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/70 bg-white/50">
      <div className="text-[10px] tracking-wider-jp text-muted-foreground px-2 py-1">
        {title}
      </div>
      {photo ? (
        <>
          <img
            src={photo.imageUrl}
            alt={photo.recordDate}
            className="w-full aspect-square object-cover"
          />
          <div className="px-2 py-1 text-[10px] text-muted-foreground">
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
