# Mermaid (`.mmd`)

`format.mjs` が拡張子・メタデータ・検証・描画の入口です。
構文と配置は同梱した Mermaid エンジンが担当し、`renderer.mjs` が枠の開閉や注釈折り返しを接続します。
Mermaid エンジンのブラウザ読み込みは `engine.mjs` に集約し、一覧のナビゲーション時には読み込みません。
書式は [Mermaid 公式の構文リファレンス](https://mermaid.js.org/intro/syntax-reference.html) を参照してください。
このアプリが使う Mermaid のバージョンは package.json に固定しています。

```sh
node bin/diagram-desk.mjs validate examples/architecture.mmd
node bin/diagram-desk.mjs show examples/architecture.mmd
```

CLI 検証と表示は同じ Mermaid のパーサーを利用します。CLI は描画せず構文だけを検証します。
Node ではパーサーの DOMPurify に必要な DOM を `src/infrastructure/mermaid-validation.mjs` が用意します。
不正な構文は `MERMAID_SYNTAX`、文書全体の path（空文字）と理由を返します。
パーサーが行番号を返す場合は `line` も含みます。
結果は Onion と同じ JSON 包絡と終了コードです。Mermaid は JSON Schema の対象ではありません。
