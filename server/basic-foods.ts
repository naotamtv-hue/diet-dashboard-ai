// 基本食材データベース（一般的な食材を「名前＋グラム」で記録するため）。
// 栄養値は文部科学省「日本食品標準成分表」ベースの100gあたりの目安。
// kcal/p(タンパク質g)/f(脂質g)/c(炭水化物g) はすべて「100gあたり」。
// defaultGrams は記録時の初期グラム数（実際の1食/1個の目安）。

export type BasicFood = {
  name: string;
  category: "staple" | "protein" | "vegetable" | "fruit" | "dairy" | "other";
  per100: { kcal: number; p: number; f: number; c: number };
  defaultGrams: number;
  aliases?: string[]; // ひらがな/英語など検索ヒット用
};

export const BASIC_FOODS: BasicFood[] = [
  // ── 主食・炭水化物 ──
  { name: "白米（ごはん）", category: "staple", per100: { kcal: 156, p: 2.5, f: 0.3, c: 37.1 }, defaultGrams: 150, aliases: ["はくまい", "ごはん", "ご飯", "米", "こめ", "rice"] },
  { name: "玄米（ごはん）", category: "staple", per100: { kcal: 152, p: 2.8, f: 1.0, c: 35.6 }, defaultGrams: 150, aliases: ["げんまい", "brown rice"] },
  { name: "もち", category: "staple", per100: { kcal: 223, p: 4.0, f: 0.6, c: 50.3 }, defaultGrams: 50, aliases: ["餅", "もち", "mochi"] },
  { name: "食パン", category: "staple", per100: { kcal: 248, p: 8.9, f: 4.1, c: 46.4 }, defaultGrams: 60, aliases: ["しょくぱん", "パン", "bread", "トースト"] },
  { name: "オートミール", category: "staple", per100: { kcal: 350, p: 13.7, f: 5.7, c: 69.1 }, defaultGrams: 30, aliases: ["おーとみーる", "oatmeal", "オーツ"] },
  { name: "うどん（ゆで）", category: "staple", per100: { kcal: 95, p: 2.6, f: 0.4, c: 21.6 }, defaultGrams: 250, aliases: ["udon"] },
  { name: "そば（ゆで）", category: "staple", per100: { kcal: 130, p: 4.8, f: 1.0, c: 26.0 }, defaultGrams: 180, aliases: ["蕎麦", "soba"] },
  { name: "パスタ（ゆで）", category: "staple", per100: { kcal: 150, p: 5.8, f: 0.9, c: 30.0 }, defaultGrams: 220, aliases: ["スパゲッティ", "ぱすた", "pasta", "spaghetti"] },
  { name: "中華麺（ゆで）", category: "staple", per100: { kcal: 133, p: 4.9, f: 0.6, c: 27.9 }, defaultGrams: 200, aliases: ["ラーメン", "ramen", "麺"] },
  { name: "さつまいも", category: "staple", per100: { kcal: 126, p: 1.2, f: 0.2, c: 31.9 }, defaultGrams: 150, aliases: ["薩摩芋", "さつまいも", "sweet potato", "サツマイモ"] },
  { name: "じゃがいも", category: "staple", per100: { kcal: 76, p: 1.6, f: 0.1, c: 17.6 }, defaultGrams: 150, aliases: ["ジャガイモ", "potato", "馬鈴薯"] },
  { name: "かぼちゃ", category: "staple", per100: { kcal: 91, p: 1.9, f: 0.3, c: 20.6 }, defaultGrams: 100, aliases: ["南瓜", "pumpkin", "カボチャ"] },
  { name: "コーンフレーク", category: "staple", per100: { kcal: 380, p: 7.8, f: 1.7, c: 83.6 }, defaultGrams: 40, aliases: ["シリアル", "cornflakes"] },

  // ── タンパク質（肉・魚・卵・大豆・乳） ──
  { name: "鶏むね肉（皮なし）", category: "protein", per100: { kcal: 105, p: 23.3, f: 1.9, c: 0.1 }, defaultGrams: 120, aliases: ["とりむね", "鶏胸", "むね肉", "chicken breast"] },
  { name: "鶏もも肉（皮なし）", category: "protein", per100: { kcal: 113, p: 19.0, f: 5.0, c: 0.0 }, defaultGrams: 120, aliases: ["とりもも", "もも肉", "chicken thigh"] },
  { name: "ささみ", category: "protein", per100: { kcal: 98, p: 23.9, f: 0.8, c: 0.0 }, defaultGrams: 100, aliases: ["ササミ", "笹身", "chicken tender"] },
  { name: "豚もも肉（赤身）", category: "protein", per100: { kcal: 128, p: 22.1, f: 3.6, c: 0.2 }, defaultGrams: 100, aliases: ["ぶた", "豚肉", "pork"] },
  { name: "豚ロース", category: "protein", per100: { kcal: 248, p: 19.3, f: 19.2, c: 0.2 }, defaultGrams: 100, aliases: ["とんかつ用", "pork loin"] },
  { name: "牛もも肉（赤身）", category: "protein", per100: { kcal: 140, p: 21.3, f: 6.0, c: 0.5 }, defaultGrams: 100, aliases: ["ぎゅう", "牛肉", "beef"] },
  { name: "卵（全卵）", category: "protein", per100: { kcal: 142, p: 12.2, f: 10.2, c: 0.4 }, defaultGrams: 50, aliases: ["たまご", "玉子", "egg", "鶏卵"] },
  { name: "卵白", category: "protein", per100: { kcal: 44, p: 10.1, f: 0.0, c: 0.5 }, defaultGrams: 33, aliases: ["らんぱく", "egg white"] },
  { name: "鮭（さけ）", category: "protein", per100: { kcal: 124, p: 22.3, f: 4.1, c: 0.1 }, defaultGrams: 80, aliases: ["サーモン", "salmon", "シャケ"] },
  { name: "まぐろ赤身", category: "protein", per100: { kcal: 115, p: 26.4, f: 1.4, c: 0.1 }, defaultGrams: 80, aliases: ["マグロ", "鮪", "tuna", "ツナ"] },
  { name: "ツナ缶（水煮）", category: "protein", per100: { kcal: 70, p: 16.0, f: 0.7, c: 0.2 }, defaultGrams: 70, aliases: ["シーチキン", "tuna can"] },
  { name: "さば（鯖）", category: "protein", per100: { kcal: 211, p: 20.6, f: 16.8, c: 0.3 }, defaultGrams: 80, aliases: ["サバ", "mackerel"] },
  { name: "えび", category: "protein", per100: { kcal: 82, p: 18.4, f: 0.3, c: 0.3 }, defaultGrams: 60, aliases: ["海老", "エビ", "shrimp"] },
  { name: "木綿豆腐", category: "protein", per100: { kcal: 73, p: 7.0, f: 4.9, c: 1.5 }, defaultGrams: 150, aliases: ["とうふ", "豆腐", "tofu"] },
  { name: "絹ごし豆腐", category: "protein", per100: { kcal: 56, p: 5.3, f: 3.5, c: 2.0 }, defaultGrams: 150, aliases: ["きぬ", "豆腐", "tofu"] },
  { name: "納豆", category: "protein", per100: { kcal: 190, p: 16.5, f: 10.0, c: 12.1 }, defaultGrams: 45, aliases: ["なっとう", "natto"] },
  { name: "ちくわ", category: "protein", per100: { kcal: 119, p: 12.2, f: 2.0, c: 13.5 }, defaultGrams: 30, aliases: ["竹輪", "chikuwa"] },
  { name: "カッテージチーズ", category: "protein", per100: { kcal: 99, p: 13.3, f: 4.5, c: 1.9 }, defaultGrams: 50, aliases: ["cottage cheese"] },

  // ── 乳製品 ──
  { name: "牛乳", category: "dairy", per100: { kcal: 61, p: 3.3, f: 3.8, c: 4.8 }, defaultGrams: 200, aliases: ["ぎゅうにゅう", "milk", "ミルク"] },
  { name: "無調整豆乳", category: "dairy", per100: { kcal: 44, p: 3.6, f: 2.0, c: 3.1 }, defaultGrams: 200, aliases: ["とうにゅう", "soy milk"] },
  { name: "プレーンヨーグルト（無糖）", category: "dairy", per100: { kcal: 56, p: 3.6, f: 3.0, c: 4.9 }, defaultGrams: 100, aliases: ["よーぐると", "yogurt"] },
  { name: "ギリシャヨーグルト（無糖）", category: "dairy", per100: { kcal: 59, p: 10.0, f: 0.4, c: 3.9 }, defaultGrams: 100, aliases: ["ギリシア", "greek yogurt", "オイコス"] },
  { name: "プロセスチーズ", category: "dairy", per100: { kcal: 313, p: 22.7, f: 26.0, c: 1.3 }, defaultGrams: 18, aliases: ["チーズ", "cheese"] },

  // ── 野菜 ──
  { name: "ブロッコリー（ゆで）", category: "vegetable", per100: { kcal: 30, p: 3.9, f: 0.4, c: 5.2 }, defaultGrams: 100, aliases: ["ぶろっこりー", "broccoli"] },
  { name: "ほうれん草（ゆで）", category: "vegetable", per100: { kcal: 25, p: 2.6, f: 0.5, c: 4.0 }, defaultGrams: 80, aliases: ["ホウレンソウ", "spinach"] },
  { name: "キャベツ", category: "vegetable", per100: { kcal: 21, p: 1.2, f: 0.1, c: 5.2 }, defaultGrams: 100, aliases: ["きゃべつ", "cabbage"] },
  { name: "トマト", category: "vegetable", per100: { kcal: 19, p: 0.7, f: 0.1, c: 4.7 }, defaultGrams: 100, aliases: ["とまと", "tomato"] },
  { name: "きゅうり", category: "vegetable", per100: { kcal: 13, p: 1.0, f: 0.1, c: 3.0 }, defaultGrams: 50, aliases: ["胡瓜", "cucumber"] },
  { name: "レタス", category: "vegetable", per100: { kcal: 11, p: 0.6, f: 0.1, c: 2.8 }, defaultGrams: 50, aliases: ["れたす", "lettuce"] },
  { name: "玉ねぎ", category: "vegetable", per100: { kcal: 33, p: 1.0, f: 0.1, c: 8.4 }, defaultGrams: 80, aliases: ["たまねぎ", "onion"] },
  { name: "にんじん", category: "vegetable", per100: { kcal: 35, p: 0.7, f: 0.2, c: 9.0 }, defaultGrams: 60, aliases: ["人参", "carrot"] },
  { name: "なす", category: "vegetable", per100: { kcal: 18, p: 1.1, f: 0.1, c: 5.1 }, defaultGrams: 80, aliases: ["茄子", "eggplant"] },
  { name: "ピーマン", category: "vegetable", per100: { kcal: 20, p: 0.9, f: 0.2, c: 5.1 }, defaultGrams: 30, aliases: ["green pepper"] },
  { name: "しめじ", category: "vegetable", per100: { kcal: 17, p: 2.7, f: 0.5, c: 4.8 }, defaultGrams: 50, aliases: ["きのこ", "mushroom"] },
  { name: "アボカド", category: "vegetable", per100: { kcal: 176, p: 2.1, f: 17.5, c: 7.9 }, defaultGrams: 70, aliases: ["あぼかど", "avocado"] },

  // ── 果物 ──
  { name: "バナナ", category: "fruit", per100: { kcal: 86, p: 1.1, f: 0.2, c: 22.5 }, defaultGrams: 90, aliases: ["ばなな", "banana"] },
  { name: "りんご", category: "fruit", per100: { kcal: 53, p: 0.1, f: 0.2, c: 15.5 }, defaultGrams: 100, aliases: ["林檎", "apple", "リンゴ"] },
  { name: "みかん", category: "fruit", per100: { kcal: 45, p: 0.7, f: 0.1, c: 11.5 }, defaultGrams: 80, aliases: ["蜜柑", "mikan", "オレンジ"] },
  { name: "いちご", category: "fruit", per100: { kcal: 31, p: 0.9, f: 0.1, c: 8.5 }, defaultGrams: 75, aliases: ["苺", "strawberry"] },
  { name: "キウイ", category: "fruit", per100: { kcal: 51, p: 1.0, f: 0.2, c: 13.4 }, defaultGrams: 85, aliases: ["きうい", "kiwi"] },
  { name: "ぶどう", category: "fruit", per100: { kcal: 58, p: 0.4, f: 0.1, c: 15.7 }, defaultGrams: 80, aliases: ["葡萄", "grape"] },
  { name: "ブルーベリー", category: "fruit", per100: { kcal: 49, p: 0.5, f: 0.1, c: 12.9 }, defaultGrams: 50, aliases: ["blueberry"] },

  // ── その他（脂質・ナッツ・調味） ──
  { name: "アーモンド", category: "other", per100: { kcal: 587, p: 19.6, f: 51.8, c: 20.9 }, defaultGrams: 25, aliases: ["あーもんど", "almond", "ナッツ"] },
  { name: "オリーブオイル", category: "other", per100: { kcal: 894, p: 0.0, f: 100.0, c: 0.0 }, defaultGrams: 10, aliases: ["油", "olive oil"] },
  { name: "はちみつ", category: "other", per100: { kcal: 294, p: 0.2, f: 0.0, c: 79.7 }, defaultGrams: 21, aliases: ["蜂蜜", "honey"] },
  { name: "ピーナッツバター", category: "other", per100: { kcal: 599, p: 19.7, f: 50.4, c: 24.9 }, defaultGrams: 16, aliases: ["peanut butter"] },
];

const CATEGORY_ORDER: Record<BasicFood["category"], number> = {
  staple: 0,
  protein: 1,
  vegetable: 2,
  fruit: 3,
  dairy: 4,
  other: 5,
};

/** キーワード（部分一致・別名対応）で基本食材を検索。空なら主要食材を返す。 */
export function searchBasicFoods(keyword: string | undefined, limit = 30): BasicFood[] {
  const kw = (keyword ?? "").trim().toLowerCase();
  let hits: BasicFood[];
  if (!kw) {
    hits = [...BASIC_FOODS];
  } else {
    hits = BASIC_FOODS.filter((f) => {
      if (f.name.toLowerCase().includes(kw)) return true;
      return (f.aliases ?? []).some((a) => a.toLowerCase().includes(kw));
    });
  }
  hits.sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]);
  return hits.slice(0, limit);
}
