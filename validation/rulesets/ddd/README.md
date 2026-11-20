# DDD 集約境界ルールセット

このルールセットは、明示的に宣言した DDD の集約境界を検査します。
対応するアーキテクチャは検証側の登録で `onion` と宣言しています。
Onion の書式に DDD 用フィールドは追加せず、Onion の層名・kind・groupId を DDD の概念だと推測しません。

```sh
node bin/diagram-desk.mjs validate examples/ddd.onion.json \
  --rules ddd --rules-config examples/ddd.rules.json
node bin/diagram-desk.mjs rules schema ddd
```

サンプルは [アーキテクチャ](../../../examples/ddd.onion.json) と [DDD 宣言](../../../examples/ddd.rules.json)。
公開の [JSON Schema](schema.json) は設定ファイルの `ddd` の値に適用する Schema です。
設定ファイル全体は次のようにルール ID をキーにします。

```json
{
  "ddd": {
    "boundedContexts": [{"id": "sales", "architectureContexts": ["main"]}],
    "entities": ["main:order", "main:line"],
    "aggregates": [{
      "id": "order", "boundedContextId": "sales",
      "root": "main:order", "members": ["main:order", "main:line"]
    }],
    "references": [{
      "relation": "/relations/0", "from": "main:order", "to": "main:line", "semantics": "object"
    }]
  }
}
```

## 宣言する情報

- `boundedContexts`: DDD の境界 ID と、対応するアーキテクチャのコンテキスト ID 群。
  一つの境界を複数の図のコンテキストへ対応させられます。一つの図のコンテキストを複数の境界には割り当てません。
  図の全コンテキストを DDD の検証対象だと仮定しません。集約の要素が属するものは対応宣言が必要です。
- `entities`: 実体と宣言する図の要素 ID。集約ルートも含めます。
- `aggregates`: 集約 ID、所属する DDD の境界、ルートとなる要素 ID、構成要素 ID の配列。ルートも members に含めます。
  メンバーには実体以外の値オブジェクト等も含められます。図の要素は複数の集約には所属させません。
- `references`: アダプターが定義する関係 ID、想定する端点、関係の意味。
  Onion の関係 ID は元ソースの JSON Pointer（`/relations/0` など）です。DDD 本体は ID の形式を解釈しません。
  `object` は永続的なオブジェクト参照、`identity` は ID 参照、`transient` は一時的な参照です。
  関係の削除や端点が変わる並べ替えは、古い宣言のまま判定せず設定不整合として返します。

集約の要素へ向かうすべての関係には、意味の宣言が必要です。参照の意味がなければ incomplete とします。
図の `depends-on` や `runtime-call` だけから、永続オブジェクト参照だとは判断しません。
意味を明示したことで検証可能になるのであり、宣言の正しさをコードから証明する機能ではありません。

## 検証内容

- ルートが存在する実体で、その集約のメンバーでもあること。
- 集約 ID と境界 ID の一意性、要素の重複所属がないこと。
- 集約の全メンバーが同じ DDD の境界に対応すること。
- 集約外から内部メンバーへの永続オブジェクト参照がないこと。
  同じ集約内の参照と、集約外からルートへの参照は許可します。
- 宣言で参照する図の要素・コンテキスト・関係が存在し、設定に矛盾がないこと。

`identity` / `transient` は永続オブジェクト参照の検査対象から除外します。
ID 参照の設計や一時参照の寿命そのものをこの図だけで検証したとは扱いません。
集約境界とルート以外の設計、ドメインの不変条件、トランザクション、ユビキタス言語の妥当性などは判定しません。
passed は上記の宣言と関係の検証に成功したことを意味し、DDD 全体への適合を保証するものではありません。

ルートを窓口として集約内部への外部オブジェクト参照を制限するルールは、
Eric Evans の [DDD Reference — Aggregates](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf)（p.16）を根拠にしています。
この検査では一時的な参照を明示的に区別し、例外を違反だと推測しないようにしています。

## 主な診断

- `DDD_EXTERNAL_MEMBER_REFERENCE`: 集約外から内部メンバーへの永続オブジェクト参照。図の関係の位置を指します。
- `DDD_AGGREGATE_CROSSES_BOUNDARY` / `DDD_MULTIPLE_AGGREGATES` / `DDD_ROOT_NOT_ENTITY` / `DDD_ROOT_NOT_MEMBER`: 宣言に見られる設計違反。
- `DDD_DECLARATIONS_REQUIRED` / `DDD_INFORMATION_REQUIRED`: 宣言や必須情報が不足。
- `DDD_CONTEXT_MAPPING_REQUIRED` / `DDD_ENTITY_WITHOUT_AGGREGATE` / `DDD_REFERENCE_SEMANTICS_REQUIRED`: 境界対応・所属・参照の意味が未宣言。
- `DDD_UNKNOWN_*` / `DDD_DUPLICATE_*` / `DDD_AMBIGUOUS_CONTEXT` / `DDD_STALE_REFERENCE` / `DDD_CONFIG_INVALID`: 設定の不整合や誤記。

矛盾や不足がある宣言から後続の設計違反を導出しません。先にその宣言を修正して再実行してください。
