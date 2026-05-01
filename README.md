# 📘 README.md（更新版）

## 見積書管理システム

## プロジェクト概要
本プロジェクトは、見積書の作成・編集・管理を行う業務アプリケーションです。  
React（フロントエンド）と Rust（Axum / SQLite）を使用し、  
一覧表示、詳細表示、編集、PDF 出力など、見積書管理に必要な機能を提供します。

主な機能:
- 見積書の一覧・検索・詳細表示
- 見積書の新規作成・編集・削除
- 明細行の自動計算（数量 × 単価）
- 社員マスタとの連携（作成者のプルダウン選択）
- PDF 出力（将来的に実装予定）
- SQLite による軽量なデータ管理

---

# 🚀 開発環境セットアップ

## 1. Rust / Axum API サーバーの起動手順（開発時）

```
cd akitomi-mitsumori-viewer\server
cargo build
.\target\debug\akitomi-server.exe
```

サーバーは以下で起動します：

```
http://localhost:3001
```

---

## 2. クライアント（Tauri + React）の起動手順

### 2-1. Tauri アプリとして起動（推奨）

```
cd akitomi-mitsumori-viewer\client
npm run tauri dev
```

Tauri ウィンドウが立ち上がり、アプリが動作します。

---

### 2-2. Vite（ブラウザ）で起動する場合

```
cd akitomi-mitsumori-viewer\client
npm run dev
```

ブラウザで以下へアクセス：

```
http://localhost:1420/
```

---

# 🗄 データベース
- SQLite を使用  
- `data.db` を `server/` と同階層に配置  
- 初期テーブル：`mitsumori`, `mitsumori_detail`, `shain`

---

# 📡 API 一覧

## 見積書ヘッダ
- `GET /api/mitsumori/header/:no`  
- `POST /api/mitsumori/create`  
- `POST /api/mitsumori/update/:no`  
- `DELETE /api/mitsumori/:no`  

## 見積書明細
- `GET /api/mitsumori/detail/:no`

## 社員マスタ
- `GET /api/shain`  
- `POST /api/shain/add`（即時登録・採番）  
- `POST /api/shain/visible`（表示/非表示切替）  

---

# 🔧 今後の改善タスク（見積書 詳細画面）

### 詳細画面の前後移動機能
- [ ] 存在しない番号をスキップする  
- [ ] 一覧画面の並び順に従って前後移動する  
- [ ] 最初と最後の見積では「前へ」「次へ」ボタンを無効化する

### ナビゲーション改善
- [ ] 詳細画面から一覧に戻らずに連続閲覧できるようにする  
- [ ] 前後移動時にスクロール位置を維持する  

### データ整合性
- [ ] 削除後の前後移動の挙動を整理  
- [ ] 存在しない見積番号にアクセスした場合のエラーハンドリング  

---

# 📝 リリースノート

## v0.1.0
- 見積書一覧・詳細・編集の基本機能を実装  
- 明細行の自動計算を実装  
- 作成者を社員マスタから選択できるように変更  
- 詳細画面で作成者名（社員名）を表示  
- API サーバー（Axum）とフロントエンド（React）の連携を構築  

## v0.2.0（予定）
- 詳細画面の前後移動機能  
- PDF 出力機能  
- 検索条件の保存  
- UI の細部調整（行高さ、mm 単位の調整など）  



# メモ
## サーバインストーラーの作成
cargo build --release
inno setupをインストール
copy .\target\release\akitomi-server.exe .\installer

## 使用したインストーラー
Inno Setup
https://jrsoftware.org/isinfo.php

## SQLite DBの確認と編集
DB Browser for SQLite
https://sqlitebrowser.org/

## アイコン画像編集
Gimp
https://www.gimp.org/

## バージョ管理
GitHub
https://github.com/coyacco/akitomi-mitsumori/
