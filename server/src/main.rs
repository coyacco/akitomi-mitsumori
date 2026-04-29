use axum::{
    extract::{Path, Query},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use rusqlite::{Connection, ToSql};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

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
    goukei_kingaku: Option<f64>,
}

#[derive(Serialize)]
struct MitsumoriListResult {
    total: i32,
    rows: Vec<MitsumoriListRow>,
}

#[derive(Serialize, Deserialize)]
pub struct MitsumoriHeader {
    pub mitsumori_no: i32,
    pub sakusei: Option<String>,
    pub tantou: Option<String>,
    pub tantou_name: Option<String>,

    pub mitsumorisaki_meisho: Option<String>,
    pub keisho: Option<String>,

    pub torihiki_jouken: Option<String>,
    pub yukou_kigen: Option<String>,
    pub ukewatashi_kijitu: Option<String>,
    pub ukewatashi_basho: Option<String>,

    pub goukei_kingaku: Option<f64>,
    pub goukei: Option<f64>,
    pub sotozeigaku: Option<f64>,

    pub zeiritsu: Option<f64>,
    pub zei_type: Option<i32>,
    pub kaishain: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct MitsumoriDetail {
    pub hinmoku: Option<String>,
    pub suryo: Option<f64>,
    pub tanni: Option<String>,
    pub tannka: Option<f64>,
    pub kingaku: Option<f64>,
    pub bikou: Option<String>,
}

// 自社情報
#[derive(Serialize, Deserialize)]
pub struct MitsumoriCompany {
    pub yubin: Option<String>,
    pub jusho1: Option<String>,
    pub daihyou: Option<String>,
    pub tel: Option<String>,
    pub fax: Option<String>,
    pub mail: Option<String>,
    pub ginkou: Option<String>,
    pub zei_type: Option<i32>,
    pub zeiritsu: Option<i32>,
    pub kaishain: Option<i8>,
    pub mix: Option<String>,
}

#[derive(Deserialize)]
struct SaveRequest {
    header: MitsumoriHeader,
    items: Vec<MitsumoriDetail>,
}

#[derive(Serialize, Deserialize)]
pub struct CompanyInfo {
    pub zip: String,
    pub address: String,
    pub daihyo: String,
    pub tel: String,
    pub fax: String,
    pub email: String,
    pub bank: String,
    pub zei_type: i32,
    pub zeiritsu: i32,
}

#[derive(Serialize, Deserialize)]
struct Shain {
    shain_cd: String,
    name: String,
    hide: bool,
}

#[derive(Deserialize)]
struct ShainVisibleRequest {
    shain_cd: String,
    hide: bool,
}

#[tokio::main]
async fn main() {
    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/api/mitsumori/list", get(get_mitsumori_list))
        .route("/api/mitsumori/header/:no", get(get_mitsumori_header))
        .route("/api/mitsumori/detail/:no", get(get_mitsumori_detail))
        .route("/api/mitsumori/create", post(create_mitsumori))
        .route("/api/mitsumori/update/:no", post(update_mitsumori))
        .route("/api/mitsumori/:no", delete(delete_mitsumori))
        .route("/api/mitsumori/company", get(get_mitsumori_company))
        .route(
            "/api/mitsumori/company/update",
            post(update_mitsumori_company),
        )
        .route("/api/shain/:all", get(get_shain_list))
        .route("/api/shain/add", post(add_shain))
        .route("/api/shain/visible", post(update_shain_visible))
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    println!("Server running on http://{}...", addr);

    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn get_mitsumori_list(Query(q): Query<ListQuery>) -> Json<MitsumoriListResult> {
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
        conn.query_row(&total_sql, [params_total[0].clone()], |row| row.get(0))
            .unwrap()
    };

    // --- 一覧 SQL ---
    let mut list_sql = String::from(
        "SELECT
            mitsumori_no,
            sakusei,
            mitsumorisaki_meisho,
            keisho,
            goukei_kingaku
        FROM mitsumori",
    );

    let mut params: Vec<Box<dyn ToSql>> = vec![];

    if !q.search_client.is_empty() {
        list_sql.push_str(" WHERE mitsumorisaki_meisho LIKE ?");
        params.push(Box::new(format!("%{}%", q.search_client)));
    }

    list_sql.push_str(" ORDER BY mitsumori_no DESC LIMIT ? OFFSET ?");
    params.push(Box::new(size as i64)); // ← ここ重要
    params.push(Box::new(offset as i64)); // ← ここ重要

    let mut stmt = conn.prepare(&list_sql).unwrap();

    // &dyn ToSql のスライスに変換
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

async fn get_mitsumori_header(Path(no): Path<i32>) -> Json<MitsumoriHeader> {
    let conn = Connection::open("data.db").unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT 
                m.mitsumori_no,
                m.sakusei,
                m.tantou,
                s.name AS tantou_name,   -- JOIN で取得
                m.mitsumorisaki_meisho,
                m.keisho,
                m.goukei_kingaku,
                m.torihiki_jouken,
                m.yukou_kigen,
                m.ukewatashi_kijitu,
                m.ukewatashi_basho,
                m.goukei,
                m.sotozeigaku,
                m.zeiritsu,
                m.zei_type,
                m.kaishain
            FROM mitsumori m
            LEFT JOIN shain s
                ON m.tantou = s.shain_CD
            WHERE m.mitsumori_no = ?",
        )
        .unwrap();

    let result = stmt.query_row([no], |row| {
        Ok(MitsumoriHeader {
            mitsumori_no: row.get(0)?,
            sakusei: row.get(1).ok(),
            tantou: row.get(2).ok(),
            tantou_name: row.get(3).ok(),
            mitsumorisaki_meisho: row.get(4).ok(),
            keisho: row.get(5).ok(),
            goukei_kingaku: row.get(6).ok(),
            torihiki_jouken: row.get(7).ok(),
            yukou_kigen: row.get(8).ok(),
            ukewatashi_kijitu: row.get(9).ok(),
            ukewatashi_basho: row.get(10).ok(),
            goukei: row.get(11).ok(),
            sotozeigaku: row.get(12).ok(),
            zeiritsu: row.get(13).ok(),
            zei_type: row.get(14).ok(),
            kaishain: row.get(15).ok(),
        })
    });

    let header = match result {
        Ok(h) => h,
        Err(_) => MitsumoriHeader {
            mitsumori_no: no,
            sakusei: None,
            tantou: None,
            tantou_name: None,
            mitsumorisaki_meisho: None,
            keisho: None,
            goukei_kingaku: None,
            torihiki_jouken: None,
            yukou_kigen: None,
            ukewatashi_kijitu: None,
            ukewatashi_basho: None,
            goukei: None,
            sotozeigaku: None,
            zeiritsu: None,
            zei_type: None,
            kaishain: None,
        },
    };

    Json(header)
}

async fn get_mitsumori_detail(Path(no): Path<i32>) -> Json<Vec<MitsumoriDetail>> {
    let conn = Connection::open("data.db").unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT hinmoku, suryo, tanni, tannka, kingaku, bikou
             FROM mitsumori_item
             WHERE mitsumori_no = ?",
        )
        .unwrap();

    let rows = stmt
        .query_map([no], |row| {
            Ok(MitsumoriDetail {
                hinmoku: row.get::<_, Option<String>>(0).ok().flatten(),
                suryo: row.get::<_, Option<f64>>(1).ok().flatten(),
                tanni: row.get::<_, Option<String>>(2).ok().flatten(),
                tannka: row.get::<_, Option<f64>>(3).ok().flatten(),
                kingaku: row.get::<_, Option<f64>>(4).ok().flatten(),
                bikou: row.get::<_, Option<String>>(5).ok().flatten(),
            })
        })
        .unwrap();

    let mut list = Vec::new();
    for r in rows {
        list.push(r.unwrap());
    }

    Json(list)
}

async fn create_mitsumori(Json(req): Json<SaveRequest>) -> impl IntoResponse {
    let mut conn = Connection::open("data.db").unwrap();
    let tx = conn.transaction().unwrap();

    // --- 見積番号を採番（最大値 + 1） ---
    let new_no: i32 = tx
        .query_row(
            "SELECT COALESCE(MAX(mitsumori_no), 0) + 1 FROM mitsumori",
            [],
            |row| row.get(0),
        )
        .unwrap();

    // --- ヘッダー INSERT ---
    tx.execute(
        "INSERT INTO mitsumori (
            mitsumori_no, sakusei, mitsumorisaki_meisho, tantou, keisho,
            goukei_kingaku, torihiki_jouken, yukou_kigen,
            ukewatashi_kijitu, ukewatashi_basho,
            goukei, sotozeigaku, zeiritsu, zei_type, kaishain
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            new_no,
            req.header.sakusei,
            req.header.mitsumorisaki_meisho,
            req.header.tantou,
            req.header.keisho,
            req.header.goukei_kingaku,
            req.header.torihiki_jouken,
            req.header.yukou_kigen,
            req.header.ukewatashi_kijitu,
            req.header.ukewatashi_basho,
            req.header.goukei,
            req.header.sotozeigaku,
            req.header.zeiritsu,
            req.header.zei_type,
            req.header.kaishain,
        ],
    )
    .unwrap();

    // --- 明細 INSERT ---
    {
        let mut stmt = tx
            .prepare(
                "INSERT INTO mitsumori_item (
                    mitsumori_no, hinmoku, suryo, tanni, tannka, kingaku, bikou
                ) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .unwrap();

        for i in req.items {
            stmt.execute(rusqlite::params![
                new_no, i.hinmoku, i.suryo, i.tanni, i.tannka, i.kingaku, i.bikou,
            ])
            .unwrap();
        }
    }

    tx.commit().unwrap();

    Json(serde_json::json!({ "mitsumori_no": new_no }))
}

async fn update_mitsumori(Path(no): Path<i32>, Json(req): Json<SaveRequest>) -> impl IntoResponse {
    let mut conn = Connection::open("data.db").unwrap();
    let tx = conn.transaction().unwrap();

    // --- ヘッダー UPDATE ---
    tx.execute(
        "UPDATE mitsumori SET
            sakusei = ?, mitsumorisaki_meisho = ?, tantou = ?, keisho = ?,
            goukei_kingaku = ?, torihiki_jouken = ?, yukou_kigen = ?,
            ukewatashi_kijitu = ?, ukewatashi_basho = ?,
            goukei = ?, sotozeigaku = ?, zeiritsu = ?, zei_type = ?, kaishain = ?
        WHERE mitsumori_no = ?",
        rusqlite::params![
            req.header.sakusei,
            req.header.mitsumorisaki_meisho,
            req.header.tantou,
            req.header.keisho,
            req.header.goukei_kingaku,
            req.header.torihiki_jouken,
            req.header.yukou_kigen,
            req.header.ukewatashi_kijitu,
            req.header.ukewatashi_basho,
            req.header.goukei,
            req.header.sotozeigaku,
            req.header.zeiritsu,
            req.header.zei_type,
            req.header.kaishain,
            no,
        ],
    )
    .unwrap();

    // --- 明細 DELETE ---
    tx.execute("DELETE FROM mitsumori_item WHERE mitsumori_no = ?", [no])
        .unwrap();

    // --- 明細 INSERT ---
    {
        let mut stmt = tx
            .prepare(
                "INSERT INTO mitsumori_item (
                    mitsumori_no, hinmoku, suryo, tanni, tannka, kingaku, bikou
                ) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .unwrap();

        for i in req.items {
            stmt.execute(rusqlite::params![
                no, i.hinmoku, i.suryo, i.tanni, i.tannka, i.kingaku, i.bikou,
            ])
            .unwrap();
        }
    }

    tx.commit().unwrap();

    Json(serde_json::json!({ "status": "ok" }))
}

async fn delete_mitsumori(Path(no): Path<i32>) -> impl IntoResponse {
    let mut conn = Connection::open("data.db").unwrap();
    let tx = conn.transaction().unwrap();

    tx.execute("DELETE FROM mitsumori_item WHERE mitsumori_no = ?", [no])
        .unwrap();
    tx.execute("DELETE FROM mitsumori WHERE mitsumori_no = ?", [no])
        .unwrap();

    tx.commit().unwrap();

    Json(serde_json::json!({ "status": "deleted" }))
}

async fn get_mitsumori_company() -> Result<Json<MitsumoriCompany>, StatusCode> {
    let company = load_company();
    Ok(Json(company))
}

async fn get_shain_list(Path(all): Path<i32>) -> Json<Vec<Shain>> {
    let conn = Connection::open("data.db").unwrap();

    let sql = if all == 1 {
        "SELECT shain_CD, name, hide FROM shain ORDER BY shain_CD"
    } else {
        "SELECT shain_CD, name, hide FROM shain WHERE hide = 0 ORDER BY shain_CD"
    };

    let mut stmt = conn.prepare(sql).unwrap();

    let rows = stmt
        .query_map([], |row| {
            Ok(Shain {
                shain_cd: row.get(0)?,
                name: row.get(1)?,
                hide: row.get(2)?,
            })
        })
        .unwrap();

    let mut list = Vec::new();
    for r in rows {
        list.push(r.unwrap());
    }

    Json(list)
}

async fn add_shain(Json(req): Json<Shain>) -> impl IntoResponse {
    let conn = Connection::open("data.db").unwrap();

    // 文字列を数値に変換して採番する
    let new_code: String = {
        conn.query_row(
            "SELECT printf('%4d', COALESCE(MAX(CAST(shain_CD AS INTEGER)), 0) + 1)
             FROM shain",
            [],
            |row| row.get(0),
        )
        .unwrap()
    };

    conn.execute(
        "INSERT INTO shain (shain_CD, name, hide) VALUES (?1, ?2, ?3)",
        rusqlite::params![new_code, req.name, req.hide],
    )
    .unwrap();

    Json(serde_json::json!({ "status": "ok", "shain_cd": new_code }))
}

async fn update_shain_visible(Json(req): Json<ShainVisibleRequest>) -> impl IntoResponse {
    let conn = Connection::open("data.db").unwrap();

    conn.execute(
        "UPDATE shain SET hide = ?1 WHERE shain_CD = ?2",
        rusqlite::params![if req.hide { 1 } else { 0 }, req.shain_cd],
    )
    .unwrap();

    Json(serde_json::json!({ "status": "ok" }))
}

fn load_company() -> MitsumoriCompany {
    let conn = Connection::open("data.db").unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT 
                yubin,
                jusho1,
                daihyou,
                tel,
                fax,
                mail,
                ginkou,
                zei_type,
                zeiritsu,
                kaishain,
                mix
             FROM mitsumori_company
             LIMIT 1",
        )
        .unwrap();

    stmt.query_row([], |row| {
        Ok(MitsumoriCompany {
            yubin: row.get(0).ok(),
            jusho1: row.get(1).ok(),
            daihyou: row.get(2).ok(),
            tel: row.get(3).ok(),
            fax: row.get(4).ok(),
            mail: row.get(5).ok(),
            ginkou: row.get(6).ok(),
            zei_type: row.get(7).ok(),
            zeiritsu: row.get(8).ok(),
            kaishain: row.get(9).ok(),
            mix: row.get(10).ok(),
        })
    })
    .unwrap()
}

async fn update_mitsumori_company(Json(req): Json<MitsumoriCompany>) -> impl IntoResponse {
    let mut conn = Connection::open("data.db").unwrap();
    let tx = conn.transaction().unwrap();

    tx.execute(
        "
            UPDATE mitsumori_company SET
                yubin = ?1,
                jusho1 = ?2,
                daihyou = ?3,
                tel = ?4,
                fax = ?5,
                mail = ?6,
                ginkou = ?7,
                zei_type = ?8,
                zeiritsu = ?9,
                kaishain = ?10,
                mix = ?11
            ",
        rusqlite::params![
            req.yubin,
            req.jusho1,
            req.daihyou,
            req.tel,
            req.fax,
            req.mail,
            req.ginkou,
            req.zei_type,
            req.zeiritsu,
            req.kaishain,
            req.mix,
        ],
    )
    .unwrap();

    tx.commit().unwrap();

    Json(serde_json::json!({ "status": "ok" }))
}
