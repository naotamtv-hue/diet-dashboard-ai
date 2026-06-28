// MYPERSOL のトレーナー6名（表示用）。idはサーバー(server/mypersol.ts)と共通。
// アバター画像は client/src/assets/trainers/<id>.png を後で差し込む（未配置の間は頭文字＋カラーの仮表示）。

export type TrainerId = "jeff" | "gina" | "michael" | "mia" | "jerry" | "gemma";

export type TrainerInfo = {
  id: TrainerId;
  name: string;
  gender: "male" | "female";
  group: string; // 目的グループ
  tagline: string; // 一言
  accent: string; // テーマ色(oklch)
  // 詳細タブ用（中学生でもわかる言葉で）
  catch: string;
  summary: string;
  forWho: string;
  how: string;
  pace: string;
};

export const TRAINERS: TrainerInfo[] = [
  {
    id: "jeff", name: "ジェフ", gender: "male", group: "大会・コンテスト仕上げ",
    tagline: "最大限の引き締め。精密で妥協なし", accent: "oklch(0.55 0.16 255)",
    catch: "本気で限界まで絞りたい人のための、きびしめプロコーチ。",
    summary: "大会に出る選手を仕上げてきたプロ。とても細かくて、ゆるみを許さないタイプ。毎日の食事を数字できっちり管理して、見た目をしっかり引き締めるのが得意です。",
    forWho: "短期間でも本気で結果を出したい人。きつくても頑張れる人。",
    how: "タンパク質（筋肉の材料）をしっかりとり、脂質とごはん・パン（炭水化物）を細かく調整。体重が止まったらすぐやり方を変えて、停滞を打ち破ります。",
    pace: "最大限まで引き締めるけど、体をこわす無理はナシ。減るのは1週間で体重の約1%まで。",
  },
  {
    id: "gina", name: "ジーナ", gender: "female", group: "大会・コンテスト仕上げ",
    tagline: "凛と精密に。停滞も打開する", accent: "oklch(0.6 0.17 12)",
    catch: "女性をきれいに引き締める、精密で頼れるコーチ。",
    summary: "女性のコンテスト仕上げが得意なプロ。細かくて妥協しないけれど、女性の体に合わせて調整してくれます。体重が止まる『停滞期』をぬけ出すのが上手です。",
    forWho: "本気で引き締めたい女性。体重が止まって困っている人。",
    how: "タンパク質を毎食しっかり。栄養バランスを細かく整えて、止まった体重をまた動かす工夫をします。",
    pace: "しっかり絞るけど安全第一。減るのは1週間で体重の約1%まで。",
  },
  {
    id: "michael", name: "マイケル", gender: "male", group: "引き締まった健康体",
    tagline: "無理なく継続。習慣で変える", accent: "oklch(0.7 0.15 160)",
    catch: "ムリさせない。続けられる習慣で、健康的に絞るコーチ。",
    summary: "やさしくて続けやすさ重視のコーチ。きびしいルールより『毎日できること』を大切にします。おなかが満たされる食べ方を教えてくれるので、がまんしすぎずにやせられます。",
    forWho: "リバウンドしたくない人。はじめての人。ゆっくり確実にやせたい人。",
    how: "食べる量をちょっとだけ減らし、野菜やタンパク質でおなかを満たす。むずかしいことはしません。",
    pace: "健康的に少しずつ。1か月で2〜3kgくらいが目安。",
  },
  {
    id: "mia", name: "ミア", gender: "female", group: "引き締まった健康体",
    tagline: "リバウンドさせない緩やか減量", accent: "oklch(0.72 0.13 190)",
    catch: "リバウンドさせない。やさしく寄りそう女性向けコーチ。",
    summary: "女性のダイエットが得意で、心の負担を減らす声かけが上手。きついガマンをさせず、ゆるやかに減らして、また太る『リバウンド』を防ぎます。",
    forWho: "ムリなく続けたい女性。ストレスなくやせたい人。",
    how: "栄養バランスを整えながら少しずつ調整。続けられることを最優先にします。",
    pace: "ゆっくり安全に。1か月で2〜3kgくらい。",
  },
  {
    id: "jerry", name: "ジェリー", gender: "male", group: "増量・筋肥大",
    tagline: "脂肪を増やさずリーンに増やす", accent: "oklch(0.7 0.16 60)",
    catch: "筋肉を大きく。脂肪は増やしすぎない増量コーチ。",
    summary: "体を大きくしたい人のコーチ。ただ太るのではなく、脂肪をなるべく増やさずに筋肉を増やす『リーンバルク』が得意。力強くひっぱってくれるタイプです。",
    forWho: "筋肉をつけて体を大きくしたい人。細くて太れない人。",
    how: "ふだんより少しだけ多めに食べる。タンパク質を多めにとり、運動の前後にごはんなどの炭水化物を寄せて力を出します。",
    pace: "少しずつ筋肉を増やす（脂肪は増やしすぎない）。",
  },
  {
    id: "gemma", name: "ジェマ", gender: "female", group: "増量・筋肥大",
    tagline: "栄養の質で締まった体を作る", accent: "oklch(0.62 0.18 30)",
    catch: "栄養の質で、締まった体をつくる女性向け増量コーチ。",
    summary: "女性の筋肉づくり・健康的な増量が得意。ただ食べるのではなく、栄養の質を上げて、メリハリのある締まった体を目指します。元気にはげましてくれます。",
    forWho: "筋肉をつけてメリハリのある体にしたい女性。",
    how: "タンパク質と栄養の質を大事にしながら、少しだけ多めに食べます。",
    pace: "ゆっくり健康的に筋肉アップ。",
  },
];

export const TRAINER_GROUPS: { group: string; desc: string }[] = [
  { group: "大会・コンテスト仕上げ", desc: "上級・精密・厳しめ。最大限の引き締め" },
  { group: "引き締まった健康体", desc: "バランス・継続重視。健康的に絞る" },
  { group: "増量・筋肥大", desc: "脂肪を増やしすぎないリーンバルク" },
];

export function getTrainerInfo(id: string | null | undefined): TrainerInfo | null {
  return TRAINERS.find((t) => t.id === id) ?? null;
}
