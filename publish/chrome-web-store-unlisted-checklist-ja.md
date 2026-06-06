# Chrome Web Store Unlisted Submission Checklist

## 事前準備

- GoogleアカウントでChrome Web Store Developer Dashboardへ入る
- 初回のみChrome Web Store開発者登録を行う
- 公開用ZIPを用意する
- 128x128の拡張アイコンを用意する
- 440x280の小プロモ画像を用意する
- 1280x800または640x400のスクリーンショットを1枚以上用意する
- プライバシーポリシーURLを用意する

## アップロード

1. Chrome Web Store Developer Dashboardを開く
2. `Add new item` を選ぶ
3. 公開用ZIPをアップロードする
4. ManifestとZIPの検証が通ったら、ストア情報を入力する

## Listing

- 表示名: `Archive Timestamp Helper Beta`
- 短い説明: `store-listing-ja.md` の「短い説明」を貼る
- 詳細説明: `store-listing-ja.md` の「詳細説明」を貼る
- カテゴリ: `Productivity`
- 言語: `Japanese`
- スクリーンショット: `store-assets/screenshot-panel-1280x800.png`
- 小プロモ画像: `store-assets/promo-small-440x280.png`

## Privacy

- 単一目的: `store-listing-ja.md` の「単一目的の説明」を貼る
- 権限説明: `store-listing-ja.md` の「権限の説明」を参考に入力する
- データ利用: `store-listing-ja.md` の「データ利用の説明」を参考に入力する
- プライバシーポリシー: `privacy-policy-ja.md` を公開ページ化してURLを入力する

## Distribution

- Visibilityは `Unlisted` を選ぶ
- 地域は最初は `Japan` のみ、または `All regions` を選ぶ
- 支払いは無料にする

## Submit

- `Submit for Review` を押す
- 審査が通ると、検索には出ないがURLを知っている人はインストールできる

## 公式資料

- https://developer.chrome.com/docs/webstore/register
- https://developer.chrome.com/webstore/publish
- https://developer.chrome.com/docs/webstore/cws-dashboard-distribution
- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
