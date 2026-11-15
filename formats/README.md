# 図形式の登録

`index.mjs` の `DIAGRAM_FORMATS` が、共通の探索・CLI 検証・描画アダプター選択の正本です。
各形式は同じリポジトリ内のディレクトリに、書式・サンプルへの案内・検証・配置と描画・表示資産をまとめます。

形式の入口（`format.mjs`）:

- `id`, `extension`, `label`, `editorLabel`, `kind(source)`
- `documentation`: HTTP 配信される書式説明のパス
- `schema`: 任意の JSON Schema の配信パス
- `stylesheet`: 任意の表示 CSS の配信パス
- `validate(source, options?)`: 診断配列を返す。同期・非同期どちらも可
- `loadRenderer()`: 既存の描画アダプターを返す Promise

Node 専用のエンジンが必要なら `options.loadEngine` で渡します。ブラウザから Node の依存を読み込ませません。
共通の描画入口 `public/renderers/index.mjs` は `ready()` で形式の描画器と CSS を準備し、
`createState()`、`highlight()`、`render()`、任意の `handleEvent()` へ委譲します。
形式の状態は表示ごとに独立させ、描画時の id で SVG 内部 ID の衝突を避けます。

新形式は登録と合わせて、書式・正常例・不正例の検証、プレビュー・詳細・操作・外部更新を確認します。
HTTP・CLI・保存・パンとズームの実装を形式ごとに複製しません。
