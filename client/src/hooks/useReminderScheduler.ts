import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";

function todayLocalDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseHHMM(s: string | null | undefined): { h: number; m: number } | null {
  if (!s) return null;
  const match = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return { h, m };
}

function sentKey(kind: "meal" | "weight", dateStr: string) {
  return `reminder-sent:${kind}:${dateStr}`;
}

/**
 * 認証済みユーザーに対して、設定時刻に未記録通知を発火するスケジューラー。
 * ブラウザがアプリを開いている間に動作する。
 */
export function useReminderScheduler(enabled: boolean) {
  const settingsQuery = trpc.reminders.get.useQuery(undefined, {
    enabled,
    refetchOnWindowFocus: false,
  });
  const utils = trpc.useUtils();
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!("Notification" in window)) return;
    const settings = settingsQuery.data;
    if (!settings) return;

    async function tick() {
      const now = new Date();
      const hh = now.getHours();
      const mm = now.getMinutes();
      const dateStr = todayLocalDateString();

      const mealTime = parseHHMM(settings?.mealReminderTime ?? null);
      const weightTime = parseHHMM(settings?.weightReminderTime ?? null);

      // 食事リマインド
      if (
        settings?.mealEnabled &&
        mealTime &&
        hh === mealTime.h &&
        mm === mealTime.m &&
        Notification.permission === "granted" &&
        !sessionStorage.getItem(sentKey("meal", dateStr))
      ) {
        try {
          const status = await utils.client.reminders.checkStatus.query({ date: dateStr });
          if (!status.hasMealToday) {
            new Notification("食事の記録、まだですよ", {
              body: "今日はまだ食事が記録されていません。1枚の写真からでOKです。",
              tag: `meal-${dateStr}`,
              icon: "/favicon.ico",
            });
            sessionStorage.setItem(sentKey("meal", dateStr), "1");
          }
        } catch (e) {
          console.warn("reminder check failed", e);
        }
      }

      // 体重リマインド
      if (
        settings?.weightEnabled &&
        weightTime &&
        hh === weightTime.h &&
        mm === weightTime.m &&
        Notification.permission === "granted" &&
        !sessionStorage.getItem(sentKey("weight", dateStr))
      ) {
        try {
          const status = await utils.client.reminders.checkStatus.query({ date: dateStr });
          if (!status.hasWeightToday) {
            new Notification("体重の記録、忘れていませんか？", {
              body: "今日の体重をひと言だけ。続けることが何より大切です。",
              tag: `weight-${dateStr}`,
              icon: "/favicon.ico",
            });
            sessionStorage.setItem(sentKey("weight", dateStr), "1");
          }
        } catch (e) {
          console.warn("reminder check failed", e);
        }
      }
    }

    // 30秒ごとに分単位で発火（同分内の二重発火はセッションキーで防ぐ）
    tick();
    tickRef.current = window.setInterval(tick, 30_000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [enabled, settingsQuery.data, utils]);
}
