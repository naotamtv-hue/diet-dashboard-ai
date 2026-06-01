# デプロイ手順（Render + Turso・無料）

実ユーザーが使う本番環境を Render（ホスティング）+ Turso（DB）で無料公開する手順。
所要 15〜20分。アカウント作成と CLI ログインだけ手作業、あとは Blueprint が自動でやる。

---

## 1. Turso でデータベースを作る（無料）

Turso CLI をインストールしてログイン → DB 作成 → 接続情報を取得する。
ターミナルで以下を実行（`!` を付けてこのセッションで流してもOK）:

```bash
# CLI インストール（mac）
curl -sSfL https://get.tur.so/install.sh | bash
# ログイン（ブラウザが開く）
turso auth login
# DB 作成（東京リージョン nrt）
turso db create diet-dashboard --location nrt
# 接続URL を取得（libsql://... が出る）→ DATABASE_URL に使う
turso db show diet-dashboard --url
# 認証トークンを発行 → DATABASE_AUTH_TOKEN に使う
turso db tokens create diet-dashboard
```

最後の2つで出た **URL** と **トークン** を控える。

---

## 2. Gemini APIキーを用意

ローカル `.env` の `BUILT_IN_FORGE_API_KEY` の値をそのまま本番でも使う（既に有効なキーあり）。

---

## 3. Render でデプロイ（Blueprint）

1. https://render.com にGitHubアカウントで登録
2. ダッシュボード → **New +** → **Blueprint**
3. リポジトリ `naotamtv-hue/diet-dashboard-ai` を選択 → `render.yaml` が自動検出される
4. **Apply** を押すと、秘密値の入力を求められるので埋める:
   - `DATABASE_URL` … 手順1のURL（`libsql://...`）
   - `DATABASE_AUTH_TOKEN` … 手順1のトークン
   - `BUILT_IN_FORGE_API_KEY` … 手順2のGeminiキー
   - `JWT_SECRET` … 自動生成されるので入力不要
5. デプロイ開始。ビルド時に自動で Turso へテーブル作成＋コンビニ60件シードが流れる
6. 数分後 `https://diet-dashboard-ai.onrender.com`（等）で公開される

> 無料プランは15分無操作でスリープし、次アクセスの初回が約50秒かかる。常時起動が必要になったら有料($7/月)かFly.io移行を検討。

---

## 4. 動作確認

- 公開URLを開く → 新規登録 → ログイン → 食事/体重/筋トレ記録ができるか
- iPhoneのSafariで開き「ホーム画面に追加」でPWAインストール

---

## 5. Manus版ユーザーデータの移行（エクスポート入手後）

別タスク。Manusから各ユーザーのデータをエクスポートしたファイル（JSON/CSV等）を
`~/dev/` に置けば、取込スクリプトを作成して同一メールでアカウントへ紐付ける。
（パスワードは後付け：ユーザーは初回に同じメールで新規登録 or パスワード再設定）

---

## 再デプロイ

`main` ブランチに push すれば Render が自動で再デプロイ（`autoDeploy: true`）。
DBマイグレーションも毎回ビルド時に冪等実行される。
