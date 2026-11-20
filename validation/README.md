# 設計ルールセット

形式の書式・参照整合性を検証する `formats/` と、任意の設計方針を検証する `validation/` を分けます。
Onion の形式定義から DDD を参照・登録しません。対応するアーキテクチャは検証側の `index.mjs` で宣言します。

```sh
node bin/diagram-desk.mjs rules
node bin/diagram-desk.mjs rules schema ddd
node bin/diagram-desk.mjs validate examples/ddd.onion.json --rules ddd --rules-config examples/ddd.rules.json
```

通常の `validate <file>` は従来どおり書式と参照だけを検査します。
`--rules <id>` は繰り返し指定できます。登録済みのルールだけを実行し、同じ指定は一度だけ実行します。
未知・未対応のルールを黙って無視しません。`--rules-config` は一つの JSON ファイルで、ルール ID をキーに設定を渡します。
複数ファイルを指定した場合は同じ設定を各ファイルに適用します。別の宣言が必要な図は分けて実行してください。
`--rules-config` だけの指定や、未登録の設定キーは誤記として拒否します。

## 境界

- `adapters/onion.mjs`: Onion の検証済みソースから中立なグラフを作る。元ソースへの Pointer を保持する。
- `rulesets/ddd/rules.mjs`: DDD 宣言と中立グラフだけを使う。Onion や描画モデルを import しない。
- `index.mjs`: ルールの公開入口。`supports` に形式 ID とアダプターを対応づける。
- `run.mjs`: 指定ルールの存在・対応・実行可否を判定し、結果とソース位置をまとめる。

アダプターが返す共通グラフ:

```js
{
  contexts: [{ id, path }],
  nodes: [{ id, contextId, path }], // 図全体で一意の id。contextId は所属なしなら null
  edges: [{ id, from, to, path }]      // 一意の関係 id、端点 node id、元ソース位置（JSON Pointer、非JSONなら空文字等）
}
```

Onion の単一コンテキストは省略した id を `main` とし、要素を `contextId:componentId` で識別します。
図固有の層・配置・kind を DDD ルールが解釈することはありません。
別形式でもこのグラフを作れば、DDD のルール本体を変更せず、検証側の supports 登録だけで接続できます。

追加のルールセットは `id`、`label`、`supports: { [formatId]: analyze }`、`validate({ graph, configuration })`、書式の案内を登録します。
`validate` は `{ status, diagnostics }` を返します。ルールの追加時に `formats/` を修正する必要はありません。
異なるアダプターの結果は共有せず、同じアダプターだけを実行中に再利用します。
任意のファイルから実行コードを読み込む CLI プラグイン機能は提供しません。

## 結果

追加ルールを選択した結果には `ruleResults` を含みます。ルールを指定しない従来の結果は変えません。

| status | 意味 |
| --- | --- |
| passed | 宣言の範囲でルールを検証でき、指摘なし |
| failed | 設計違反または設定不正 |
| incomplete | 判定に必要な情報が不足。設計違反とは扱わない |
| unknown | 未登録のルール |
| unsupported | ルールが入力形式をサポートしていない |
| skipped | 入力の構造不正があるため、設計検証を行わない |
| execution-error | 検証処理が失敗。ソースの設計違反とは扱わない |

基本検証が成功し、選択したすべてのルールが passed の場合にだけ `valid: true` と終了コード 0 を返します。
情報不足でも「検証できた」とはしないため、終了コードは 1 です。情報不足の診断は `category: information` と `severity: warning`。
設計違反は `category: violation`、設定不正は `configuration`、処理失敗は `execution` と区別します。

診断は `ruleset`、`code`、`file`、`path`、`message` を持ちます。
アーキテクチャへの指摘は図のソースを、宣言への指摘は設定ファイル内の `/ddd/...` を指します。
設定ファイルの読み込みや引数自体の不正は、ファイル別 results の外側の diagnostics に返します。
一つのルールの処理失敗が、別のルールの結果を消さないようにしています。

生成済みのルール設定検証器は `npm run build:rule-schemas` で再生成し、`npm run check:rule-schemas` で一致を確認します。
DDD の宣言・検証範囲は [DDD ルールセット](rulesets/ddd/README.md) を参照してください。
