use axum::{
    extract::{Query, Path, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;
use std::net::SocketAddr;
use rusqlite::Connection;
use rusqlite::ToSql;

// ----------------------
// AppState（Axum 0.6 では必須）
// ----------------------
#[derive(Clone)]
struct AppState;

// =======================
// データ構造
// =======================

// ----------------------
// 仮の型定義（後で本物に差し替え）
// ----------------------
#[derive(Deserialize)]
struct ListQuery {
    page: Option<i32>,
    page_size: Option<i32>,
    #[serde(default)]
    search_client: String,
}

#[derive(Serialize)]
struct MitsumoriListRow {
    mitsumori_no: i32,
    sakusei: Option<String>,
    mitsumorisaki_meisho: Option<String>,
    keisho: Option<String>,
    goukei_kingaku: Option<i32>,
}

#[derive(Serialize)]
struct MitsumoriListResult {
    total: i32,
    rows: Vec<MitsumoriListRow>,
}

#[derive(Serialize)]
pub struct MitsumoriHeader {
    pub mitsumori_no: i32,
    pub sakusei: Option<String>,
    pub mitsumorisaki_meisho: Option<String>,
    pub keisho: Option<String>,
    pub goukei_kingaku: Option<f64>,
    pub bikou: Option<String>,
}

#[derive(Serialize)]
pub struct MitsumoriDetail {
    pub hinmoku: String,
    pub siyou: String,
    pub suryo: f64,
    pub tanni: String,
    pub tannka: f64,
    pub kingaku: f64,
    pub bikou: String,
}

async fn get_mitsumori_list(
    State(_state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Json<MitsumoriListResult> {
    let page = q.page.unwrap_or(1);
    let size = q.page_size.unwrap_or(10);
    let offset = (page - 1) * size;

    let conn = rusqlite::Connection::open("data.db").unwrap();

    // --- 総件数 ---
    let mut total_sql = String::from("SELECT COUNT(*) FROM mitsumori");
    let mut params_total: Vec<String> = vec![];

    if !q.search_client.is_empty() {
        total_sql.push_str(" WHERE mitsumorisaki_meisho LIKE ?");
        params_total.push(format!("%{}%", q.search_client));
    }

    let total: i32 = if params_total.is_empty() {
        conn.query_row(&total_sql, [], |row| row.get(0)).unwrap()
    } else {
        conn.query_row(&total_sql, [params_total[0].clone()], |row| row.get(0)).unwrap()
    };

// --- 一覧 SQL ---
let mut list_sql = String::from(
    "SELECT mitsumori_no, sakusei, mitsumorisaki_meisho, keisho, goukei_kingaku
     FROM mitsumori"
);

let mut params: Vec<Box<dyn ToSql>> = vec![];

if !q.search_client.is_empty() {
    list_sql.push_str(" WHERE mitsumorisaki_meisho LIKE ?");
    params.push(Box::new(format!("%{}%", q.search_client)));
}

list_sql.push_str(" ORDER BY mitsumori_no DESC LIMIT ? OFFSET ?");
params.push(Box::new(size as i64));    // ← ここ重要
params.push(Box::new(offset as i64));  // ← ここ重要

let mut stmt = conn.prepare(&list_sql).unwrap();

// ★ &dyn ToSql のスライスに変換
let param_refs: Vec<&dyn ToSql> = params.iter().map(|p| p.as_ref()).collect();

let rows_iter = stmt
    .query_map(&param_refs[..], |row| {
        Ok(MitsumoriListRow {
            mitsumori_no: row.get(0)?,
            sakusei: row.get(1).ok(),
            mitsumorisaki_meisho: row.get(2).ok(),
            keisho: row.get(3).ok(),
            goukei_kingaku: row.get(4).ok(),
        })
    })
    .unwrap();


    let mut rows = Vec::new();
    for r in rows_iter {
        rows.push(r.unwrap());
    }

    Json(MitsumoriListResult { total, rows })
}

async fn get_mitsumori_header(
    Path(no): Path<i32>,
) -> Json<MitsumoriHeader> {
    let conn = Connection::open("data.db").unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT mitsumori_no, sakusei, mitsumorisaki_meisho, keisho, goukei_kingaku
             FROM mitsumori
             WHERE mitsumori_no = ?"
        )
        .unwrap();

    let header = stmt
        .query_row([no], |row| {
            Ok(MitsumoriHeader {
                mitsumori_no: row.get(0)?,
                sakusei: row.get(1).ok(),
                mitsumorisaki_meisho: row.get(2).ok(),
                keisho: row.get(3).ok(),
                goukei_kingaku: row.get(4).ok(),
                bikou: row.get(5).ok(),
            })
        })
        .unwrap();

    Json(header)
}

async fn get_mitsumori_detail(
    Path(no): Path<i32>,
) -> Json<Vec<MitsumoriDetail>> {
    let conn = Connection::open("data.db").unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT hinmoku, siyou, suryo, tanni, tannka, kingaku, bikou
             FROM mitsumori_item
             WHERE mitsumori_no = ?"
        )
        .unwrap();

    let rows = stmt
        .query_map([no], |row| {
            Ok(MitsumoriDetail {
                hinmoku: row.get::<_, Option<String>>(0)?.unwrap_or_default(),
                siyou: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                suryo: row.get::<_, Option<f64>>(2)?.unwrap_or(0.0),
                tanni: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                tannka: row.get::<_, Option<f64>>(4)?.unwrap_or(0.0),
                kingaku: row.get::<_, Option<f64>>(5)?.unwrap_or(0.0),
                bikou: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
            })
        })
        .unwrap();

    let mut list = Vec::new();
    for r in rows {
        list.push(r.unwrap());
    }

    Json(list)
}

// ----------------------
// Axum 0.6 の安定サーバー起動
// ----------------------

#[tokio::main]
async fn main() {
    let state = AppState;

let cors = CorsLayer::permissive();

let app = Router::new()
    .route("/api/mitsumori/list", get(get_mitsumori_list))
    .route("/api/mitsumori/header/:no", get(get_mitsumori_header))
    .route("/api/mitsumori/detail/:no", get(get_mitsumori_detail))
    .with_state(state)
    .layer(cors);

let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
println!("Server running on http://{}...", addr);

axum::Server::bind(&addr)
    .serve(app.into_make_service())
    .await
    .unwrap();
}
