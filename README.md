# data-hub

[ページはこちら](https://aterato.github.io/data-hub/)

スマートフォンや PC で見つけたページを登録し、あとから同じ一覧を確認できる URL メモです。GitHub Pages の画面から共有リストを閲覧でき、書き込みには合言葉が必要です。一覧はページを開いたときに読み込まれ、表示中は約30秒ごとに更新されます。

## Supabase の設定

一覧データは Supabase の `url_memos` テーブルに保存されます。読み取りは公開、追加・編集・削除は Edge Function が合言葉を検証してから行います。

1. Supabase の SQL Editor で [`supabase/migrations/20261108163000_create_url_memos.sql`](./supabase/migrations/20261108163000_create_url_memos.sql) を実行します。
2. Project Settings → API Keys で Publishable key を取得し、[`supabase-config.js`](./supabase-config.js) の `publishableKey` に設定します。Publishable key はブラウザーで使う公開用キーです。
3. Supabase CLI を使う場合は `supabase link --project-ref hwynjoesafrjcvglicsf` でこのプロジェクトに接続してから、`supabase functions deploy memos` を実行します。`supabase/config.toml` でこの関数の JWT 検証を無効にしているため、書き込み合言葉を関数内で検証します。
4. Supabase Dashboard の Edge Function Secrets に `WRITE_PASSPHRASE` を設定します。12 UTF-8 バイト以上の、推測されにくい合言葉を使用してください。`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` は関数実行環境から読み取ります。
5. GitHub Pages を再デプロイし、スマートフォンと PC から同じページを開いて動作を確認します。

合言葉や `service_role` / Secret key は、GitHub や `supabase-config.js` に登録しないでください。`supabase-config.js` に設定するのは Publishable key だけです。

## このリポジトリの位置づけ

このリポジトリは、PC とモバイルデバイスの連携を試す開発・検証用です。共有リストは認証なしで誰でも閲覧できるため、登録した URL とメモも公開情報として扱ってください。

## 利用時の注意

- URL やメモに個人情報、ログイン専用 URL、認証情報、その他の機密情報を登録しないでください。
- 合言葉は書き込みのたびに HTTPS 経由で送られます。長く、他のサービスで使い回していないものを設定してください。
- 公開リストの追加・編集・削除を合言葉を知る人が行えることを前提に利用してください。
