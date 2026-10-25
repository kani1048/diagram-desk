# Diagram Desk

人間とエージェントが同じリポジトリの図を読む、独立したローカルアプリ。harness には依存しません。

## 起動

Node.js 22.12 以上。Docker での起動にも対応しています。

```sh
npm ci
node bin/diagram-desk.mjs repo add /absolute/path/to/repository
npm start
```

http://127.0.0.1:4310 を開きます。画面はワークスペース一覧 → 図のプレビュー一覧 → 図の詳細の3段階です。検索、左右キーによる図の切り替え、ソース表示、パンくず・ブラウザの戻る操作に対応します。対象は `.mmd` と `.onion.json`。登録は CLI、閲覧は GUI / CLI の両方から行えます。

```sh
node bin/diagram-desk.mjs repo list
node bin/diagram-desk.mjs diagram list <repo-id>
node bin/diagram-desk.mjs diagram read <repo-id> examples/architecture.mmd
```

CLI は JSON を出力し、失敗時は非ゼロ終了します。登録情報は `~/.local/share/diagram-desk/repositories.json`。`DIAGRAM_DESK_HOME` で変更できます。`HOST` / `PORT` で待受先を変更できます。初期版には認証がないため、通常は既定の localhost で使ってください。

## DDD の構成

- `domain`: Repository と Diagram の識別・パスの規則
- `application`: 登録・リポジトリ検索・図の一覧と取得。ポートは constructor に注入
- `infrastructure`: Git 作業ディレクトリの確認、JSON 登録簿、ファイル探索
- `interfaces`: HTTP と CLI。共通の Desk ユースケースを使用

Repository Registry（登録と識別）と Diagram Catalog（探索と取得）を同一プロセス内のモジュールとして分離しています。図の描画はブラウザの Mermaid に委譲します。architecture.yml を必須にせず、任意の Git リポジトリを対象にします。

## 初期版の範囲

詳細画面は全体キャンバス、拡大縮小（10〜800%）、ドラッグ・ピンチ、構文色分け付きの編集パネル、保存・Ctrl/Cmd+S、枠のダブルクリック開閉、注釈折り返しに対応します。SSE で現在の図の変更を約1秒ごとに確認し自動反映します。未保存の編集がある場合は外部ソースを表示し、競合する保存は409で拒否します。Markdown 内の図・architecture.yml の解釈・大規模カタログのページングは未実装です。シンボリックリンクは一覧から除外し、取得時にも実パスがリポジトリ内か検証します。

```sh
npm test
```

## 画面の URL

- `/workspaces`: ワークスペース一覧
- `/workspaces/<id>/diagrams`: 図のプレビュー一覧
- `/workspaces/<id>/diagrams/examples/architecture.mmd`: 図の詳細

図のフォルダ階層を URL に保持し、各要素をエンコードします。各画面への直接アクセス・再読み込み・戻る/進むに対応。`/` は一覧へ、以前のクエリ形式は対応する新 URL へ転送します。

## 図の編集

詳細 URL の `?editor=on` でコードパネルを開けます。保存時は起動ごとのトークンと読み込み時点の `baseSource` を送信します。CLI も同じ保存ユースケースを使用します。

```sh
node bin/diagram-desk.mjs diagram save <repo-id> <diagram-path> <json-file>
```

JSON は `{ "source": "変更後の全文", "baseSource": "読み込み時の全文" }`。アプリ内の同時保存は直列化します。アプリ外のエディタによる読み取りと書き込みの間の競合を完全にロックするものではありません。

Docker のレビュー起動はサンプル図を `/tmp/diagram-desk` へ複製します。プレビューでの編集はその一時コピーに対するもので、元のサンプルを変更しません。コンテナの再作成で編集内容は失われます。

## 読み込みの最適化

Mermaid は図が必要になった時点で読み込みます。サムネイルはパスとソースが一致する間だけ再利用し、最大100件に制限します。詳細画面への直接アクセスでは索引だけを取得し、選択中の図のソースを別途取得します。静的ファイルには gzip と ETag を使用し、更新確認後に再利用します。図のAPI・保存・変更通知はキャッシュしません。

## 描画形式の共通部品

- `shared/diagram-formats.mjs`: 図形式、拡張子、パス検証、名前・種類。サーバーとブラウザで同じ定義を使用
- `public/renderers/`: 描画、構文色分け、形式固有の操作。Mermaid の枠開閉や注釈折り返しもここに配置
- `public/canvas-viewport.mjs`: SVG を対象とするパン・ズーム・全体表示。描画エンジンに依存しない
- `public/diagram-previews.mjs`: ソース・描画形式に対応する上限付きプレビューキャッシュ
- `public/viewer.mjs`: 編集・保存・競合検知・変更通知。描画はアダプターへ委譲

新しい形式は共通定義と描画アダプターを追加して登録します。一覧探索・URL・HTTP・CLI・保存処理を複製する必要はありません。アダプターは `createState()`、`highlight(source)`、`render(source, { id, state, mode }) -> { svg }`、任意の `handleEvent(...)` を提供します。プレビューと詳細で描画状態を共有せず、返すSVGのIDは引数の `id` を使って衝突を避けます。

Mermaid と Onion Architecture を登録しています。Onion は `examples/sample.onion.json`（単一コンテキスト）と `examples/contexts.onion.json`（複数コンテキストと通信）を参照してください。層・コンポーネント・関係を JSON で定義し、詳細画面で編集・保存できます。要素・層・扇形・通信をクリックすると関連要素の強調と詳細を表示し、背景クリックで解除します。配置・モデル検証・SVG描画は agent-harness の `pilot/onion-preview` を移植し、パン・ズーム・保存・外部変更通知は共通部品を使います。

キャンバス上の subgraph はダブルクリックで開閉します。パン・ピンチは d3-zoom を使い、4px以上の移動後は選択クリックを抑止します。タッチは1本指パン・2本指パンとピンチ、トラックパッドはスクロールでパン・ピンチでズームします。Safari の Gesture Events はトラックパッド向けに補助し、タッチと同時に処理しません。ダブルタップはMermaidの枠開閉へ渡します。ページ全体の拡大禁止を viewport メタタグへ設定せず、キャンバス内の入力だけを処理します。

## キャンバス操作の依存

`d3-zoom` と `d3-selection` を `scripts/viewport-vendor.mjs` からまとめて配信します。依存更新時は `npm run build:viewport` で `public/lib/viewport.mjs` を再生成してください。Dockerビルドでも再生成します。CDNへの接続は不要です。要素の選択・保存・図の描画は既存アダプターが担当します。

入力テストは jsdom 上で実際のD3イベント処理を通します。iPad/iPhone Safariと実機トラックパッドの操作感は、プレビューでの確認が必要です。

キャンバスの背景ドットは図の移動と同じ位置へ追従し、間隔もズーム倍率に合わせて変わります。Mermaid・Onion 共通です。

## プレビューの診断ログ

wsl-preview の `--diagnostics` モードでは、プレビュー側の「記録開始／記録停止」で入力イベントと描画状態を取得できます。通常起動では記録しません。Diagram Desk は診断モードの接続口が有効なときだけ、D3/Safariの採否、タッチ位置、適用した移動・倍率、次フレームの図と背景のCSS座標を送ります。図のソース・フォームの入力内容は送りません。

```sh
wsl-preview app diagram-desk --image diagram-desk:review --container-port 3000 --port 8101 --diagnostics
wsl-preview diagnostics diagram-desk
wsl-preview diagnostics diagram-desk --session <recording-id>
```

再現操作の後に「記録停止」を押し、「保存済み」を確認して記録IDを伝えてください。ログは容量制限付きの一時ログで、取得対象は24時間以内、コンテナ再作成で消えます。取得基盤・画面パネルは wsl-preview に置いています。座標ログは実際の合成ピクセルを記録するものではないため、Safari固有の描画ずれは画面録画と合わせて調べます。

背景の比較版では画面全体を覆うSVGの `pattern` を使い、図と同じ移動・倍率を `patternTransform` へ適用します。画面サイズの矩形をパターンで塗るため、どこまでパンしても図の端で背景は途切れません。原因を切り分けるため、ドットの画面上の半径は従来どおり1pxを維持しています。
