# Onion Architecture (`.onion.json`)

このディレクトリは、書式・検証・正規化・配置・描画・表示用 CSS の入口です。
エージェントが正本を編集し、CLI で検証した後、人間が同じ正本を図で確認します。

```sh
node bin/diagram-desk.mjs validate examples/sample.onion.json
node bin/diagram-desk.mjs show examples/sample.onion.json
node bin/diagram-desk.mjs schema onion
```

`show` はサーバーを起動し、ブラウザで開く URL を JSON で返します。終了は Ctrl+C。
Git 登録は不要です。指定したファイルだけを一時セッションの一覧に含めます。
ファイルの外部更新は SSE で再取得して描画します。`PORT` / `HOST` は通常の `serve` と共通です。

## 公開書式

機械可読な構造定義は [schema.json](schema.json)（JSON Schema draft-07）。
サンプルはリポジトリの `examples/sample.onion.json` と `examples/contexts.onion.json`。
ブラウザと CLI は、同じ Schema から生成した検証器と、同じ参照整合性の検証処理を使います。

最小例:

```json
{
  "schemaVersion": "0.1",
  "layers": [{ "id": "domain", "order": 0 }],
  "components": [{ "id": "user", "layerId": "domain", "kind": "entity" }]
}
```

- `schemaVersion`: `"0.1"` または `"0.2"`。どちらも単一・複数コンテキストを記述できます。
- 単一コンテキスト: ルートに `layers` と `components`、任意の `relations` を置きます。`id` の既定は `main`。
- 複数コンテキスト: `contexts` 配列に `id`、`layers`、`components` を持つオブジェクトを置きます。単一形式の配列との併記は拒否します。
- 層: `id` と整数の `order`（0以上）が必須。order の昇順が内側から外側です。同じ order は id 順です。
- 要素: `id` と存在する `layerId` が必須。`label`、`kind`、`socket`、`sector`、`groupId` は任意です。
- `kind` は文字列。省略時は `component`。`socket` は `""`、`api`、`spi`。`kind: "port"` の既定 socket は `spi`。
- `sector` は `presentation`、`infrastructure`、`test`。省略時は kind と socket から推定します。
- 関係: `from` と `to` は同じコンテキストの要素 ID。`kind` は下記のいずれか。`label` と `source` は任意です。
- `buses`: 任意の通信バス配列。各バスに `id` と任意の `label`。
- `links`: 任意の通信関係配列。端点は `contextId:componentId` または `bus:busId`。
- `hubContextId`: 任意。存在するコンテキスト ID を指定します。
- ID は空文字・空白・コロンを含めません。コンテキスト ID の `bus` は予約語です。
- ID の重複は同じ種類・同じコンテキスト内で拒否します。別コンテキストでの要素 ID の再利用は可能です。
- `label` は任意の文字列。ルートに任意の `$schema` を置けます。未定義のプロパティは誤記の可能性があるため拒否します。

関係の kind:
`depends-on` / `uses-port` / `implements-port` / `runtime-call` / `violation` / `request` / `publish` / `subscribe`。

従来は値を文字列・数値に変換したり、未知の項目を無視したりしましたが、公開書式への統一に伴い、
文字列の order、未知のバージョン、空配列の contexts、配列以外の relations などを明示的に拒否します。
従来のサンプルはそのまま使用できます。Schema だけでは ID 重複・参照先の存在は検査できないため、必ず CLI の `validate` も実行してください。

## 診断

`validate <file> [file ...]` は全文の検証結果を標準出力へ JSON で返します。
すべて正常なら終了コード 0、どれか不正・読込失敗なら 1。
`results` の各結果に `file`、`format`、`valid`、`diagnostics` を含みます。
各診断は `severity`、`code`、`file`、`path`（JSON Pointer）、`message` を持ちます。
JSON 自体を解析できない場合、path は空文字（文書全体）です。

```json
{
  "valid": false,
  "results": [{
    "file": "architecture.onion.json",
    "format": "onion",
    "valid": false,
    "diagnostics": [{
      "severity": "error",
      "code": "UNKNOWN_LAYER",
      "file": "architecture.onion.json",
      "path": "/components/2/layerId",
      "message": "未定義の layerId です: missing"
    }]
  }]
}
```

構造エラーは `SCHEMA_*`、構文エラーは `INVALID_JSON`。
参照・重複は `DUPLICATE_ID`、`UNKNOWN_LAYER`、`UNKNOWN_COMPONENT`、`UNKNOWN_ENDPOINT`、`UNKNOWN_CONTEXT`、`RESERVED_ID`。
構造エラーがある場合は先に構造の診断を返し、修正後に参照を検証します。
描画時も同じ診断を持つ `DiagramValidationError` を投げ、Viewer が path と理由を表示します。

## 開発

`format.mjs` が形式の公開入口、`validation.mjs` が解析・検証、`model.mjs` が既定値の補完、
`layout.mjs` と `renderer.mjs` が図の表現を担当します。
Schema を変更したら `npm run build:onion-schema` で `schema-validator.mjs` を再生成し、一緒にコミットします。
生成済み検証器は Node とブラウザで共用し、ブラウザで eval を必要としません。
