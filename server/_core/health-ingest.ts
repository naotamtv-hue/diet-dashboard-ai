import type { Express, Request, Response } from "express";
import * as db from "../db";

/**
 * Apple ショートカット等の外部からアクティブエネルギー(消費kcal)を取り込む窓口。
 * クッキー認証は使えないため、ユーザー個別の apiToken をURLに含めて認証する。
 *
 *   GET  /api/health/active-energy?token=XXX&kcal=523
 *   GET  /api/health/active-energy?token=XXX&kcal=523&date=2026-06-29   (日付省略時はJST当日)
 *   POST /api/health/active-energy   (token/kcal/date を query か JSON body で)
 *
 * ショートカットの「URLの内容を取得」でそのまま叩ける。再送信しても当日分は上書き(重複しない)。
 */
function jstToday(): string {
  // "YYYY-MM-DD"（日本時間）
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

async function handle(req: Request, res: Response) {
  const src = { ...(req.query as Record<string, unknown>), ...(req.body ?? {}) } as Record<string, unknown>;
  const token = typeof src.token === "string" ? src.token.trim() : "";
  const kcalRaw = src.kcal ?? src.calories ?? src.activeEnergy;
  const kcal = Number(kcalRaw);
  const dateRaw = typeof src.date === "string" ? src.date.trim() : "";

  if (!token) {
    return res.status(401).json({ ok: false, error: "token がありません" });
  }
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 20000) {
    return res.status(400).json({ ok: false, error: "kcal が不正です" });
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : jstToday();

  try {
    const user = await db.getUserByApiToken(token);
    if (!user) {
      return res.status(401).json({ ok: false, error: "token が無効です" });
    }
    await db.upsertActiveEnergyWorkout(user.id, date, kcal);
    return res.json({ ok: true, date, kcal: Math.round(kcal), message: `${date} の消費 ${Math.round(kcal)}kcal を記録しました` });
  } catch (e) {
    console.error("[health-ingest] failed", e);
    return res.status(500).json({ ok: false, error: "サーバーエラー" });
  }
}

export function registerHealthIngest(app: Express) {
  app.get("/api/health/active-energy", handle);
  app.post("/api/health/active-energy", handle);
}
