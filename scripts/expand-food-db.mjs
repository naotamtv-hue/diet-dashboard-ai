// AI(Gemini)で日本の定番コンビニ商品・一般食品の栄養データを一括生成し、convenience_itemsへ追加する。
// 値は公開情報ベースのおおよその推定。重複(name)はスキップ。
// 使い方: node scripts/expand-food-db.mjs
import { createClient } from "@libsql/client";
import "dotenv/config";

const url = process.env.DATABASE_URL || "file:local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient({ url, ...(authToken ? { authToken } : {}) });

const FORGE_URL = (process.env.BUILT_IN_FORGE_API_URL || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/+$/, "");
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const MODEL = process.env.AI_MODEL || "gemini-2.5-flash";

const CATEGORIES = ["bento", "onigiri", "bread", "salad", "noodle", "hotsnack", "drink", "dessert", "sideDish", "proteinSnack"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          chain: { type: "string", enum: ["seven", "familymart", "lawson"] },
          category: { type: "string", enum: CATEGORIES },
          name: { type: "string" },
          description: { type: "string" },
          calories: { type: "number" },
          proteinG: { type: "number" },
          fatG: { type: "number" },
          carbsG: { type: "number" },
          priceYen: { type: "number" },
        },
        required: ["chain", "category", "name", "description", "calories", "proteinG", "fatG", "carbsG", "priceYen"],
      },
    },
  },
  required: ["items"],
};

async function generate(chainLabel, chain, n) {
  const system = `あなたは日本のコンビニ商品に詳しい管理栄養士です。${chainLabel}で実際に売られている定番商品を${n}件挙げ、公開されている栄養成分表示に基づくおおよその値を返してください。
- name: 実在する商品名（正式名称）
- description: ひとことの特徴（10文字程度）
- calories(kcal,整数) / proteinG / fatG / carbsG(g,小数1桁) / priceYen(税込目安,整数)
- chainは必ず "${chain}"。categoryは bento/onigiri/bread/salad/noodle/hotsnack/drink/dessert/sideDish/proteinSnack から最適なものを選ぶ。
- 幅広いカテゴリから重複しないよう多様に選ぶ。`;
  const resp = await fetch(`${FORGE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${FORGE_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: "none",
      max_tokens: 8000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `${chainLabel}の定番商品を${n}件、JSONで。` },
      ],
      response_format: { type: "json_schema", json_schema: { name: "foods", strict: true, schema: SCHEMA } },
    }),
  });
  if (!resp.ok) throw new Error(`LLM ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  let content = data.choices[0].message.content;
  if (typeof content === "string") {
    const f = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (f) content = f[1];
    content = JSON.parse(content);
  }
  return content.items || [];
}

async function run() {
  const existing = new Set((await client.execute("SELECT name FROM convenience_items")).rows.map((r) => String(r.name)));
  console.log(`[start] existing items: ${existing.size}`);
  const targets = [
    ["セブン-イレブン", "seven", 60],
    ["ファミリーマート", "familymart", 60],
    ["ローソン", "lawson", 60],
  ];
  let added = 0;
  for (const [label, chain, n] of targets) {
    try {
      const items = await generate(label, chain, n);
      let chainAdded = 0;
      for (const it of items) {
        const name = String(it.name || "").trim();
        if (!name || existing.has(name)) continue;
        existing.add(name);
        await client.execute({
          sql: `INSERT INTO convenience_items (chain, category, name, description, calories, proteinG, fatG, carbsG, priceYen)
                VALUES (?,?,?,?,?,?,?,?,?)`,
          args: [
            it.chain || chain, it.category || "sideDish", name, String(it.description || ""),
            String(Math.round(it.calories || 0)), String(it.proteinG ?? 0), String(it.fatG ?? 0), String(it.carbsG ?? 0),
            it.priceYen ? Math.round(it.priceYen) : null,
          ],
        });
        chainAdded++; added++;
      }
      console.log(`[${chain}] generated ${items.length}, added ${chainAdded}`);
    } catch (e) {
      console.warn(`[${chain}] failed: ${e.message}`);
    }
  }
  const total = (await client.execute("SELECT COUNT(*) c FROM convenience_items")).rows[0].c;
  console.log(`\n[done] added ${added}. total convenience_items = ${total}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
