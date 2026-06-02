import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "oklch(0.985 0.002 250)" }}
    >
      <div className="text-center max-w-sm">
        <div
          className="text-7xl font-bold mb-4"
          style={{ color: "oklch(0.38 0.14 268)" }}
        >
          404
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          ページが見つかりません
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <Link href="/">
          <Button className="h-12 px-8 font-bold rounded-xl">
            ホームに戻る
          </Button>
        </Link>
      </div>
    </div>
  );
}
