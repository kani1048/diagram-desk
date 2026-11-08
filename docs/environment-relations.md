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

## オーケストレーターと改善ループ

この会話のCodexを全体オーケストレーターとして位置づけます。ユーザーの目的を
タスクへ分解し、人事・実装・レビューへ割り当て、進捗を調整し、成果を評価します。
現在実施済みの図・ソース編集とPR提出は確認記録付きです。ロールへの委譲・評価・
チューニングは設計案であり、自動実行やSBX内への配置は未実装です。

評価は案件のissue/PRに、タスク、ロール設定の版、成果物、検証結果とともに記録します。
品質、手戻り、所要時間、取得可能な実行コストを根拠として改善仮説を立てます。
異なる難易度の仕事を単純な速度だけで順位づけしません。
オーケストレーターが人事へ改善を依頼し、人事がCODEX_HOMEと作業場の変更を提案、
同等の課題で変更前後を比較し、オーケストレーターが採用・差戻しを判断します。
人事自身も評価対象です。runtimeは起動・再接続、Customizerは標準設定の生成を担当します。

## 移行の境界

- Customizerとの受渡しは生成済みCODEX_HOMEのみ。編集元の保存はCustomizer側の責務です。
- ロール定義とDocker/SBX構成、認証項目一覧と簡単な導入・動作確認ガイドをGit管理します。
- 案件リポジトリはロール別の独立した作業コピーをマウントします。
  push済みのコード・成果物とissue/PRの進捗・判断・再開手順から再開します。
- 未commit・未pushの変更は意図的に移行対象外とします。
- DB等のGit外の永続データは別の手段で扱います。本構成や人事のバックアップ責務を増やしません。
- 認証は移行先でガイドに沿って再設定します。秘密情報は定義や評価記録に含めません。
- 会話履歴、コンテナの状態、キャッシュを移行できることを前提にしません。

共通SBXとruntimeのDinDは既存案を維持しています。daemon構成の簡素化は別途検証事項です。
