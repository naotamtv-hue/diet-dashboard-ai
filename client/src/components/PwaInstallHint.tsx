import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "pwa-hint-dismissed";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

/**
 * iOS Safari でまだホーム画面に追加していないユーザーに、
 * 「共有 → ホーム画面に追加」でアプリのように使えることを案内するバナー。
 */
export default function PwaInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIos() || isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  return (
    <div
      className="fixed left-3 right-3 z-[60] rounded-2xl px-4 py-3 flex items-start gap-3 shadow-2xl"
      style={{
        bottom: "calc(72px + env(safe-area-inset-bottom))",
        background: "oklch(0.24 0.05 240)",
        border: "1px solid oklch(0.34 0.05 240)",
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "oklch(0.62 0.18 220)" }}
      >
        <Share className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">アプリのように使えます</div>
        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          下の<span className="text-white font-medium">共有ボタン</span>
          <Share className="inline h-3 w-3 mx-0.5" />→「
          <span className="text-white font-medium">ホーム画面に追加</span>」でアイコンから起動できます。
        </div>
      </div>
      <button onClick={dismiss} aria-label="閉じる" className="flex-shrink-0 text-muted-foreground hover:text-white">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
