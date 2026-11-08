# ロール環境の関係図

`.environment.json` を登録済みリポジトリに置くと、図の一覧に表示します。
`examples/role-designer.environment.json` は、共通SBX内のruntime Dockerに
実行基盤のDinDで人事・実装担当・レビュー担当のコンテナを同列に起動する設計案です。
各ロールはユーザー構成と作業領域を持ち、Docker daemonは常設しません。
ロールからDocker操作が必要になった場合の接続方法は未決定です。人事もロールの一つで、ロールと作業場の定義を作成します。
ロールの起動・再接続はruntimeの責任です。ロール間はコンテナ境界であり、独立VMではありません。
実行基盤のDinD、並列起動、資源・マウントの分離は未検証です。
従来の二段SBX案は `examples/nested-sbx.environment.json` に比較用として残します。

役割やDocker構成を編集する別の管理画面は追加しません。設定の正本は
Customizerの出力、Dockerfile、compose.yaml、SBXの環境定義に置きます。
このJSONは、それらの関係を記録する閲覧用の索引です。自動同期はしません。

## 入力

```json
{
  "version": 1,
  "title": "ロールの作業場",
  "nodes": [
    {"id": "sandbox", "kind": "sbx", "label": "SBX", "status": "proposed"},
    {"id": "agent", "parent": "sandbox", "kind": "container", "label": "実装担当", "refs": ["roles/builder/compose.yaml"]},
    {"id": "code", "kind": "workspace", "label": "案件ソース"}
  ],
  "links": [
    {"id": "source", "from": "agent", "to": "code", "kind": "mount", "access": "rw", "target": "/workspace"}
  ]
}
```

- node kind: `participant`, `host`, `sbx`, `container`, `daemon`, `role`, `config`, `workspace`, `service`。
- parent: 所属境界のID。包含境界にできるのはhost / sbx / container。
- link kind: `config`, `mount`, `docker`, `network`, `manages`。
- 矢印はfromからto。mountの場合は利用側→共有元、targetは利用側のマウント先。
- mountのaccessは`ro` / `rw`を必須指定。daemon操作とマウントは別の線にする。
- statusは`proposed`（設計案）/ `confirmed`（確認済み）/ `unknown`（未確認）。省略時はunknown。
- confirmedには確認日時・方法などをevidenceへ記録する。
  表示は記録に基づくもので、ビューアーが実機の状態を保証するものではない。
- refsは参照元のパスなどの文字列。読込やリンク移動は行わず、詳細欄に表示する。
- notesは補足。nodeとlinkのIDは図全体で一意。

JSONの形式、参照切れ、循環、型、重複IDを描画前に検査します。
上限は100ノード、300接続、包含12階層、文字列4000文字、refsは20件。

## 閲覧

枠が包含関係、線が接続です。設計案・未確認は破線、確認記録があるものは実線。
要素または線を選ぶと、状態・所属・参照元・接続・マウント先を詳細欄に表示します。
関連要素と線を強調します。背景クリックで選択解除。Tabで図の要素へ移動し、
EnterまたはSpaceでも選択できます。図のズーム・移動・JSON編集と保存は共通機能です。

Docker/SBXの自動検出、標準設定ファイルからの自動生成、Docker実行、認証情報の収集は
初版の対象外です。Docker daemonやソケットのマウント、稼働状態の変更は行いません。

## この会話のCodexの関与

サンプルの「あなた」と「この会話のCodex」は参加者です。実行場所や稼働中コンテナとして描きません。
Codexによる実施済みの図・ソース編集、検証、PR提出を確認記録付きの実線で示します。
将来の人事ロールの初期構成とruntime実装への支援は設計案の破線です。
人事・他ロールの自動起動や、現在のCodexが共通SBX内に配置済みという意味ではありません。
