use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, Manager};

// =======================
// データ構造
// =======================

#[derive(Serialize)]
struct MitsumoriDetail {
    hinmoku: String,
    siyou: String,
    suryo: f64,
    tanni: String,
    tannka: f64,
    kingaku: f64,
    bikou: String,
}

#[derive(Serialize)]
struct MitsumoriListRow {
    mitsumori_no: i32,
    sakusei: Option<String>,
    mitsumorisaki_meisho: Option<String>,
    keisho: Option<String>,
    goukei_kingaku: Option<f64>,
    items: Vec<String>, // ← 追加
}

#[derive(Serialize)]
struct MitsumoriListResult {
    total: i32,
    rows: Vec<MitsumoriListRow>,
}

#[derive(Serialize)]
struct MitsumoriHeader {
    mitsumori_no: i32,
    sakusei: Option<String>,
    mitsumorisaki_meisho: Option<String>,
    keisho: Option<String>,
    goukei_kingaku: Option<f64>,
}

#[tauri::command]
#[allow(nonstandard_style)]
#[allow(non_snake_case)]
#[warn(unused_variables)]
fn get_mitsumori_list(
    app: AppHandle,
    page: i32,
    pageSize: i32,
    // searchClient: String,
    // searchItem: String,
) -> Result<MitsumoriListResult, String> {

    // ここではまだ検索に使わず、元の SQL をそのまま返す
    let db_path = ensure_db_exists(&app)?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let disp_num = pageSize;
    let offset = page * disp_num;

    // 総件数
    let total: i32 = conn
        .query_row("SELECT COUNT(*) FROM mitsumori", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    // ページング付き一覧
    let mut stmt = conn
        .prepare(
            "SELECT mitsumori_no, sakusei, mitsumorisaki_meisho, keisho, goukei_kingaku
    FROM mitsumori
    ORDER BY mitsumori_no DESC
    LIMIT ? OFFSET ?",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([disp_num, offset], |row| {
            Ok(MitsumoriListRow {
                mitsumori_no: row.get(0)?,
                sakusei: row.get(1).ok(),
                mitsumorisaki_meisho: row.get(2).ok(),
                keisho: row.get(3).ok(),
                goukei_kingaku: row.get(4).ok(),
                items: vec![], // ← 追加していたので空で返す
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }

    Ok(MitsumoriListResult { total, rows: list })
}

// =======================
// DB コピー（初回のみ）
// =======================

fn ensure_db_exists(app: &AppHandle) -> Result<String, String> {
    println!("ensure_db_exists: start");

    let app_dir = app.path().app_data_dir().map_err(|e| {
        println!("ERROR: app_data_dir failed: {}", e);
        e.to_string()
    })?;

    println!("app_dir = {:?}", app_dir);

    std::fs::create_dir_all(&app_dir).map_err(|e| {
        println!("ERROR: create_dir_all failed: {}", e);
        e.to_string()
    })?;

    let db_path = app_dir.join("data.db");
    println!("db_path = {:?}", db_path);

    // 既に存在するならそのまま使う
    if db_path.exists() {
        let size = db_path.metadata().unwrap().len();
        println!("existing DB size = {}", size);

        if size > 0 {
            println!("DB already exists, using it");
            return Ok(db_path.to_string_lossy().to_string());
        }
    }

    println!("DB does not exist or is empty, copying from resources...");

    // Tauri v2 のリソースパス
    let original = app
        .path()
        .resolve("data.db", tauri::path::BaseDirectory::Resource)
        .map_err(|e| {
            println!("ERROR: resolve failed: {}", e);
            e.to_string()
        })?;

    println!("original resource DB = {:?}", original);

    std::fs::copy(&original, &db_path).map_err(|e| {
        println!("ERROR: copy failed: {}", e);
        e.to_string()
    })?;

    println!("DB copy completed");

    Ok(db_path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_mitsumori_header(app: AppHandle, no: i32) -> Result<MitsumoriHeader, String> {
    let db_path = ensure_db_exists(&app)?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT mitsumori_no, sakusei, mitsumorisaki_meisho, keisho, goukei_kingaku
    FROM mitsumori
    WHERE mitsumori_no = ?",
        )
        .map_err(|e| e.to_string())?;

    let header = stmt
        .query_row([no], |row| {
            Ok(MitsumoriHeader {
                mitsumori_no: row.get(0)?,
                sakusei: row.get(1).ok(),
                mitsumorisaki_meisho: row.get(2).ok(),
                keisho: row.get(3).ok(),
                goukei_kingaku: row.get(4).ok(),
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(header)
}

// =======================
// 詳細取得
// =======================

#[tauri::command]
fn get_mitsumori_detail(app: AppHandle, no: i32) -> Result<Vec<MitsumoriDetail>, String> {
    println!("get_mitsumori_detail called: no = {}", no);

    let db_path = ensure_db_exists(&app)?;
    println!("Using DB: {}", db_path);

    let conn = Connection::open(db_path.clone())
        .map_err(|e| format!("DB open error: {} (path: {})", e, db_path))?;

    let mut stmt = conn
        .prepare("PRAGMA table_info(mitsumori_item)")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(1)?, // 列名
                row.get::<_, String>(2)?, // 型
            ))
        })
        .map_err(|e| e.to_string())?;

    for r in rows {
        println!("col = {:?}", r.map_err(|e| e.to_string())?);
    }

    let mut stmt = conn
        .prepare(
            "SELECT hinmoku, siyou, suryo, tanni, tannka, kingaku, bikou
FROM mitsumori_item
WHERE mitsumori_no = ?",
        )
        .map_err(|e| e.to_string())?;

    println!("---- A");

    let rows = stmt
        .query_map([no], |row| {
            let hinmoku: Option<String> = row.get(0).ok();
            let siyou: Option<String> = row.get(1).ok();
            let suryo: Option<f64> = row.get(2).ok();
            let tanni: Option<String> = row.get(3).ok();
            let tannka: Option<f64> = row.get(4).ok();
            let kingaku: Option<f64> = row.get(5).ok();
            let bikou: Option<String> = row.get(6).ok();

            Ok(MitsumoriDetail {
                hinmoku: hinmoku.unwrap_or_default(),
                siyou: siyou.unwrap_or_default(),
                suryo: suryo.unwrap_or(0.0),
                tanni: tanni.unwrap_or_default(),
                tannka: tannka.unwrap_or(0.0),
                kingaku: kingaku.unwrap_or(0.0),
                bikou: bikou.unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?; // ← ここが重要！

    // rows を Vec に変換
    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }

    println!("Loaded {} detail rows", list.len());

    Ok(list)
}

// =======================
// Tauri 起動
// =======================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("mobile_entry_point called");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_mitsumori_list,
            get_mitsumori_detail,
            get_mitsumori_header
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
