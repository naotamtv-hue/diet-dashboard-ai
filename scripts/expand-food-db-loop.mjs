// AI(Gemini)でコンビニ食品を大量生成しconvenience_itemsへ蓄積する（低脂質・高タンパク・ダイエット向け重視）。
// 無料枠のレート制限(429)はバックオフして粘る。重複(name)はスキップ。
// 使い方: node scripts/expand-food-db-loop.mjs [目標総数(既定700)]
import { createClient } from "@libsql/client";
import "dotenv/config";

const TARGET = Number(process.argv[2] || 700);
const url = process.env.DATABASE_URL || "file:local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient({ url, ...(authToken ? { authToken } : {}) });

const FORGE_URL = (process.env.BUILT_IN_FORGE_API_URL || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/+$/, "");
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const MODEL = process.env.AI_MODEL || "gemini-2.5-flash";

const CATS = ["bento", "onigiri", "bread", "salad", "noodle", "hotsnack", "drink", "dessert", "sideDish", "proteinSnack"];
const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          chain: { type: "string", enum: ["seven", "familymart", "lawson"] },
          category: { type: "string", enum: CATS },
          name: { type: "string" }, description: { type: "string" },
          calories: { type: "number" }, proteinG: { type: "number" }, fatG: { type: "number" }, carbsG: { type: "number" }, priceYen: { type: "number" },
        },
        required: ["chain", "category", "name", "description", "calories", "proteinG", "fatG", "carbsG", "priceYen"],
      },
    },
  },
  required: ["items"],
};

const CHAINS = [["セブン-イレブン", "seven"], ["ファミリーマート", "familymart"], ["ローソン", "lawson"]];
const THEMES = [
  "低脂質・高タンパクのダイエット向け商品（サラダチキン、プロテイン系など）",
  "サラダ・カット野菜・惣菜",
  "おにぎり・もち麦・玄米などごはん類",
  "プロテイン飲料・プロテインバー・ギリシャヨーグルト",
  "スープ・春雨スープ・カップ麺・冷凍麺",
  "ゆで卵・豆腐・納豆・大豆系の高タンパク惣菜",
  "サンドイッチ・パン類",
  "ホットスナック（からあげ・焼き鳥等）",
  "低カロリーデザート・ヨーグルト・ゼリー",
  "お茶・無糖コーヒー・炭酸水などドリンク",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(chainLabel, chain, theme, n) {
  const system = `あなたは日本のコンビニ商品に詳しい管理栄養士です。${chainLabel}で実際に売られている「${theme}」に該当する定番商品を${n}件挙げ、公開栄養成分に基づくおおよその値を返してください。
- name: 実在する商品名（正式名称）。重複させない。
- description: ひとことの特徴(10文字程度)。
- calories(kcal,整数)/proteinG/fatG/carbsG(g,小数1桁)/priceYen(税込目安,整数)。
- chainは必ず"${chain}"。categoryは最適なものを選ぶ。`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = await fetch(`${FORGE_URL}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${FORGE_KEY}` },
      body: JSON.stringify({
        model: MODEL, reasoning_effort: "none", max_tokens: 8000,
        messages: [{ role: "system", content: system }, { role: "user", content: `${chainLabel}の「${theme}」を${n}件、JSONで。` }],
        response_format: { type: "json_schema", json_schema: { name: "foods", strict: true, schema: SCHEMA } },
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      let c = data.choices[0].message.content;
      if (typeof c === "string") { const f = c.match(/```(?:json)?\s*([\s\S]*?)```/i); if (f) c = f[1]; c = JSON.parse(c); }
      return c.items || [];
    }
    if (resp.status === 429) { await sleep(25000); continue; }
    throw new Error(`LLM ${resp.status}`);
  }
  return [];
}

async function run() {
  const existing = new Set((await client.execute("SELECT name FROM convenience_items")).rows.map((r) => String(r.name)));
  console.log(`[start] existing=${existing.size} target=${TARGET}`);
  let total = existing.size;
  outer: for (const theme of THEMES) {
    for (const [label, chain] of CHAINS) {
      if (total >= TARGET) break outer;
      try {
        const items = await generate(label, chain, theme, 40);
        let added = 0;
        for (const it of items) {
          const name = String(it.name || "").trim();
          if (!name || existing.has(name)) continue;
          existing.add(name);
          await client.execute({
            sql: `INSERT INTO convenience_items (chain,category,name,description,calories,proteinG,fatG,carbsG,priceYen) VALUES (?,?,?,?,?,?,?,?,?)`,
            args: [it.chain || chain, it.category || "sideDish", name, String(it.description || ""), String(Math.round(it.calories || 0)), String(it.proteinG ?? 0), String(it.fatG ?? 0), String(it.carbsG ?? 0), it.priceYen ? Math.round(it.priceYen) : null],
          });
          added++; total++;
        }
        console.log(`[${chain}|${theme.slice(0, 12)}] +${added} (total=${total})`);
      } catch (e) {
        console.warn(`[${chain}] ${e.message}`);
      }
      await sleep(7000);
    }
  }
  console.log(`[done] total convenience_items=${total}`);
}
run().catch((e) => { console.error(e); process.exit(1); });
