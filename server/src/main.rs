use axum::{
    extract::{Path, Query},
    response::IntoResponse,
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use rusqlite::{Connection, ToSql};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr};
// use std::{net::SocketAddr, process::Command};
use tower_http::cors::CorsLayer;

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
    pub tantou: Option<String>,      // shain_CD
    pub tantou_name: Option<String>, // ★ 社員名

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
#[derive(Serialize)]
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

async fn get_mitsumori_header(Path(no): Path<i32>) -> Json<MitsumoriHeader> {
    let conn = Connection::open("data.db").unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT 
                m.mitsumori_no,
                m.sakusei,
                m.tantou,
                s.name AS tantou_name,   -- ★ JOIN で取得
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
            tantou: row.get(2).ok(),      // shain_CD
            tantou_name: row.get(3).ok(), // ★ ここを None → row.get(3) に変更
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
        Err(_) => {
            MitsumoriHeader {
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
            }
        }
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

    // --- 明細 INSERT（stmt をブロックで囲んで drop させる） ---
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

    // --- 明細 INSERT（stmt を drop させる） ---
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
    let company = load_company();   // ★ 既存の関数をそのまま使う
    Ok(Json(company))
}

#[derive(Serialize)]
struct Shain {
    shain_cd: String,
    name: String,
}

async fn get_shain_list() -> Json<Vec<Shain>> {
    let conn = Connection::open("data.db").unwrap();

    let mut stmt = conn
        .prepare("SELECT shain_CD, name FROM shain WHERE hide = 0 ORDER BY shain_CD")
        .unwrap();

    let rows = stmt
        .query_map([], |row| {
            Ok(Shain {
                shain_cd: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .unwrap();

    let mut list = Vec::new();
    for r in rows {
        list.push(r.unwrap());
    }

    Json(list)
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
        .route("/api/shain", get(get_shain_list))
        // .route("/api/pdf/:no", get(pdf_handler))
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    println!("Server running on http://{}...", addr);

    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

// async fn pdf_handler(Path(no): Path<i32>) -> impl IntoResponse {
//     println!("pdf_handler {}", no);

//     // 1. DB から header/detail/company を取得
//     let mut header = load_header(no);
//     let items = load_detail(no);
//     let company = load_company();

//     // 2. 全角スペース → 半角スペース
//     fn normalize(s: Option<String>) -> String {
//         s.unwrap_or_default().replace("　", " ")
//     }

//     header.mitsumorisaki_meisho = Some(normalize(header.mitsumorisaki_meisho.clone()));
//     header.keisho = Some(normalize(header.keisho.clone()));
//     header.tantou = Some(normalize(header.tantou.clone()));
//     header.torihiki_jouken = Some(normalize(header.torihiki_jouken.clone()));
//     header.yukou_kigen = Some(normalize(header.yukou_kigen.clone()));
//     header.ukewatashi_kijitu = Some(normalize(header.ukewatashi_kijitu.clone()));
//     header.ukewatashi_basho = Some(normalize(header.ukewatashi_basho.clone()));

//     // 4. HTML を生成
//     let html = build_pdf_html(&header, &items, &company);

//     let html_path = format!("temp_{}.html", no);
//     std::fs::write(&html_path, html).unwrap();

//     let abs = std::fs::canonicalize(&html_path).unwrap();
//     let mut abs_str = abs.to_str().unwrap().to_string();

//     // Windows の UNC パス "\\?\" を除去
//     if abs_str.starts_with(r"\\?\") {
//         abs_str = abs_str.trim_start_matches(r"\\?\").to_string();
//     }

//     // Chrome 用 URL に変換
//     let html_url = format!("file:///{}", abs_str.replace("\\", "/"));

//     println!("HTML URL = {}", html_url);

//     let pdf_abs = std::fs::canonicalize(".")
//         .unwrap()
//         .join(format!("temp_{}.pdf", no));

//     let mut pdf_str = pdf_abs.to_str().unwrap().to_string();

//     if pdf_str.starts_with(r"\\?\") {
//         pdf_str = pdf_str.trim_start_matches(r"\\?\").to_string();
//     }

//     println!("pdf_str = {}", pdf_str);

//     // 5. Chromium の print-to-pdf を実行（stdout/stderr を取得）
//     let chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe";

//     let output = Command::new(chrome_path)
//         .args([
//             "--headless",
//             "--disable-gpu",
//             "--no-sandbox",
//             "--no-pdf-header-footer",
//             &format!("--print-to-pdf={}", pdf_str),
//             &html_url,
//         ])
//         .output()
//         .unwrap();

//     println!("stdout = {}", String::from_utf8_lossy(&output.stdout));
//     println!("stderr = {}", String::from_utf8_lossy(&output.stderr));

//     // 6. PDF を読み込む（失敗時はエラー PDF を返す）
//     let pdf_bytes = match std::fs::read(&pdf_str) {
//         Ok(bytes) => bytes,
//         Err(_) => {
//             let msg = b"%PDF-1.4\n% Chrome failed to generate PDF.\n";
//             msg.to_vec()
//         }
//     };

//     // 7. 後片付け
//     let _ = std::fs::remove_file(&html_path);
//     let _ = std::fs::remove_file(&pdf_str);

//     (
//         axum::http::StatusCode::OK,
//         [
//             ("Content-Type", "application/pdf"),
//             (
//                 "Content-Disposition",
//                 "attachment; filename=\"estimate.pdf\"",
//             ),
//         ],
//         pdf_bytes,
//     )
// }

// fn load_header(no: i32) -> MitsumoriHeader {
//     let conn = Connection::open("data.db").unwrap();

//     let mut stmt = conn
//         .prepare(
//             "SELECT 
//             mitsumori_no,
//             sakusei,
//             mitsumorisaki_meisho,
//             keisho,
//             goukei_kingaku,
//             torihiki_jouken,
//             yukou_kigen,
//             ukewatashi_kijitu,
//             ukewatashi_basho,
//             goukei,
//             sotozeigaku,
//             zeiritsu,
//             zei_type,
//             kaishain
//          FROM mitsumori
//          WHERE mitsumori_no = ?",
//         )
//         .unwrap();

//     let result = stmt.query_row([no], |row| {
//         Ok(MitsumoriHeader {
//             mitsumori_no: row.get(0)?,
//             sakusei: row.get(1).ok(),
//             tantou: row.get(2).ok(),
//             tantou_name: None, // ★ 社員名は別途 JOIN で取得するためここでは None
//             mitsumorisaki_meisho: row.get(3).ok(),
//             keisho: row.get(4).ok(),
//             goukei_kingaku: row.get(5).ok(),
//             torihiki_jouken: row.get(6).ok(),
//             yukou_kigen: row.get(7).ok(),
//             ukewatashi_kijitu: row.get(8).ok(),
//             ukewatashi_basho: row.get(9).ok(),
//             goukei: row.get(10).ok(),
//             sotozeigaku: row.get(11).ok(),
//             zeiritsu: row.get(12).ok(),
//             zei_type: row.get(13).ok(),
//             kaishain: row.get(14).ok(),
//         })
//     });

//     match result {
//         Ok(h) => h,
//         Err(_) => {
//             // ★ 新規作成時・削除済み時でも panic しない
//             MitsumoriHeader {
//                 mitsumori_no: no,
//                 sakusei: None,
//                 tantou: None,
//                 tantou_name: None, // ★ 社員名は別途 JOIN で取得するためここでは None
//                 mitsumorisaki_meisho: None,
//                 keisho: None,
//                 goukei_kingaku: None,
//                 torihiki_jouken: None,
//                 yukou_kigen: None,
//                 ukewatashi_kijitu: None,
//                 ukewatashi_basho: None,
//                 goukei: None,
//                 sotozeigaku: None,
//                 zeiritsu: None,
//                 zei_type: None,
//                 kaishain: None,
//             }
//         }
//     }
// }

// fn load_detail(no: i32) -> Vec<MitsumoriDetail> {
//     let conn = Connection::open("data.db").unwrap();

//     let mut stmt = conn
//         .prepare(
//             "SELECT hinmoku, suryo, tanni, tannka, kingaku, bikou
//              FROM mitsumori_item
//              WHERE mitsumori_no = ?",
//         )
//         .unwrap();

//     let rows = stmt
//         .query_map([no], |row| {
//             Ok(MitsumoriDetail {
//                 hinmoku: row.get::<_, Option<String>>(0).ok().flatten(),
//                 suryo: row.get::<_, Option<f64>>(1).ok().flatten(),
//                 tanni: row.get::<_, Option<String>>(2).ok().flatten(),
//                 tannka: row.get::<_, Option<f64>>(3).ok().flatten(),
//                 kingaku: row.get::<_, Option<f64>>(4).ok().flatten(),
//                 bikou: row.get::<_, Option<String>>(5).ok().flatten(),
//             })
//         })
//         .unwrap();

//     let mut list = Vec::new();
//     for r in rows {
//         list.push(r.unwrap());
//     }

//     list
// }

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

// pub fn build_pdf_html(
//     header: &MitsumoriHeader,
//     items: &[MitsumoriDetail],
//     company: &MitsumoriCompany,
// ) -> String {
//     // 明細行
//     let mut detail_rows = String::new();
//     for i in items {
//         let tannka = show_opt(i.tannka);
//         let suryo = show_opt(i.suryo);

//         let kingaku_calc = match (i.tannka, i.suryo) {
//             (Some(t), Some(s)) => Some(t * s),
//             _ => None,
//         };
//         let kingaku = show_opt(kingaku_calc);

//         detail_rows.push_str(&format!(
//             "<tr>
//                 <td>{}</td>
//                 <td class='right'>{}</td>
//                 <td class='center'>{}</td>
//                 <td class='right'>{}</td>
//                 <td class='right'>{}</td>
//                 <td>{}</td>
//             </tr>",
//             i.hinmoku.clone().unwrap_or_default(),
//             suryo,
//             i.tanni.clone().unwrap_or_default(),
//             tannka,
//             kingaku,
//             i.bikou.clone().unwrap_or_default(),
//         ));
//     }

//     // 合計金額（大文字）
//     let goukei_main = if let Some(g) = header.goukei {
//         format!("￥{}-", kingaku_format(g))
//     } else {
//         "".to_string()
//     };

//     // 会社印
//     let kaishain_html = if header.kaishain.clone().unwrap_or_default() == "1" {
//         r#"
//         <img src="akitomi.JPG" style="position:absolute; left:138mm; top:27mm; width:33mm;">
//         <img src="seta.JPG"    style="position:absolute; left:178mm; top:37mm; width:15mm;">
//         "#
//         .to_string()
//     } else {
//         "".to_string()
//     };

//     // 小計・税・合計
//     let summary_rows = format!(
//         r#"
//         <tr>
//             <td style="border:none;"></td>
//             <td colspan="3" class="left" style="border:1px solid #000;">小計</td>
//             <td class="right" style="border:1px solid #000;">{goukei_kingaku}</td>
//             <td style="border:none;"></td>
//         </tr>
//         <tr>
//             <td style="border:none;"></td>
//             <td colspan="3" class="left" style="border:1px solid #000;">消費税（{zeiritsu}％）</td>
//             <td class="right" style="border:1px solid #000;">{sotozeigaku}</td>
//             <td style="border:none;"></td>
//         </tr>
//         <tr>
//             <td style="border:none;"></td>
//             <td colspan="3" class="left" style="border:1px solid #000;">合計</td>
//             <td class="right" style="border:1px solid #000;">{goukei}</td>
//             <td style="border:none;"></td>
//         </tr>
//         "#,
//         goukei_kingaku = kingaku_format(header.goukei_kingaku.unwrap_or(0.0)),
//         zeiritsu = header.zeiritsu.unwrap_or(10.0),
//         sotozeigaku = kingaku_format(header.sotozeigaku.unwrap_or(0.0)),
//         goukei = kingaku_format(header.goukei.unwrap_or(0.0)),
//     );

//     let detail_and_summary = format!("{}{}", detail_rows, summary_rows);

//     // HTML
//     format!(
//         r#"
// <html>
// <head>
// <meta charset="UTF-8">
// <style>
//     @page {{
//         size: A4 portrait;
//         margin: 10mm;
//     }}

//     body {{
//         font-family: 'Noto Sans JP', sans-serif;
//         font-size: 11px;
//         margin: 0;
//         padding: 0;
//     }}

//     .title {{
//         position:absolute; left:100mm; top:10mm;
//         font-size:20px; font-weight:bold;
//     }}

//     .mitsumori-no {{
//         position:absolute; left:20mm; top:10mm;
//         font-size:10px;
//     }}

//     .sakuseibi {{
//         position:absolute; left:150mm; top:10mm;
//         font-size:10px; text-align:right; width:50mm;
//     }}

//     .mitsumorisaki {{
//         position:absolute; left:20mm; top:22mm;
//         width:80mm; font-size:16px;
//         border-bottom:1px solid #000;
//         text-align:center; padding-bottom:2mm;
//     }}

//     .company-block {{
//         position: absolute;
//         left: 130mm;
//         top: 28mm;
//         width: 90mm;
//         font-size: 11px;
//     }}

//     .item-header {{
//         position:absolute; left:10mm; top:76mm;
//         width:190mm;
//     }}

//     table.item-table {{
//         border-collapse: collapse;
//         font-size: 11px;
//         width: 100%;
//     }}

//     table.item-table th, table.item-table td {{
//         border:1px solid #000;
//         padding:2px 3px;
//         height: 29px;
//         vertical-align: middle;
//     }}

//     table.item-table th {{
//         text-align:center;
//         background:#f0f0f0;
//     }}

//     table.item-table th:nth-child(1) {{ width:110mm; }}
//     table.item-table th:nth-child(2) {{ width:13mm; }}
//     table.item-table th:nth-child(3) {{ width:10mm; }}
//     table.item-table th:nth-child(4) {{ width:20mm; }}
//     table.item-table th:nth-child(5) {{ width:23mm; }}
//     table.item-table th:nth-child(6) {{ width:40mm; }}

//     .right {{ text-align:right; }}
//     .center {{ text-align:center; }}

//     .wrapper {{
//         width: 180mm;
//         margin: 0 auto;
//     }}
// </style>
// </head>

// <body>
// <div class="wrapper">

// <div class="mitsumori-no">No. {no}</div>
// <div class="title">御見積書</div>
// <div class="sakuseibi">{sakusei}</div>

// <div style="
//     position:absolute;
//     left:20mm;
//     top:22mm;
//     width:80mm;
//     height:8mm;
//     border-bottom:1px solid #000;
//     text-align:center;
//     overflow:hidden;
//     padding-bottom:2mm;
// ">
//     <div style="
//         display:inline-block;
//         font-size:20px;
//         white-space:nowrap;
//         transform-origin:left center;
//         max-width:80mm;
//     "
//         onload="this.style.transform = this.scrollWidth > 300 ? 'scale(' + (300 / this.scrollWidth) + ')' : 'scale(1)'"
//     >
//         {mitsumorisaki} {keisho}
//     </div>
// </div>

// <table style="position:absolute; left:20mm; top:34mm; width:80mm; font-size:18px; border-collapse:collapse;">
//   <tr><td style="width:20mm;">合計金額</td>
//   <td style="text-align:center; font-size:22px; border-bottom:2px solid #000;">{goukei_main}</td></tr>
// </table>

// {kaishain_html}

// <table style="position:absolute; left:20mm; top:48mm; width:80mm; font-size:12px; border-collapse:collapse;">
//   <tr><td style="width:20mm;">取引条件</td><td style="border-bottom:1px solid #000;">{torihiki}</td></tr>
//   <tr><td>有効期限</td><td style="border-bottom:1px solid #000;">{yukou}</td></tr>
//   <tr><td>受渡期日</td><td style="border-bottom:1px solid #000;">{kijitu}</td></tr>
//   <tr><td>受渡場所</td><td style="border-bottom:1px solid #000;">{basho}</td></tr>
// </table>

// <div class="company-block">
//     <div style="display:inline-block; font-size:16px; vertical-align:bottom;">
//         株式会社
//     </div>
//     <div style="display:inline-block; font-size:20px; vertical-align:bottom; margin-left:2mm; letter-spacing:2mm;">
//         秋富商店
//     </div>
//     <div style="margin-top:2mm;">{daihyou}</div>
//     <div>〒{yubin} {jusho1}</div>
//     <div>TEL:{tel} FAX:{fax}</div>
//     <div>取引銀行:{ginkou}</div>
// </div>


// <!-- 明細 -->
// <div class="item-header">
// <table class="item-table">
//     <tr>
//         <th>品名・仕様</th>
//         <th>数量</th>
//         <th>単位</th>
//         <th>単価</th>
//         <th>金額</th>
//         <th>備考</th>
//     </tr>
//     {detail_and_summary}
// </table>
// </div>

// </div>
// </body>
// </html>
// "#,
//         no = header.mitsumori_no,
//         sakusei = header.sakusei.clone().unwrap_or_default(),
//         mitsumorisaki = header.mitsumorisaki_meisho.clone().unwrap_or_default(),
//         keisho = header.keisho.clone().unwrap_or_default(),
//         goukei_main = goukei_main,
//         torihiki = header.torihiki_jouken.clone().unwrap_or_default(),
//         yukou = header.yukou_kigen.clone().unwrap_or_default(),
//         kijitu = header.ukewatashi_kijitu.clone().unwrap_or_default(),
//         basho = header.ukewatashi_basho.clone().unwrap_or_default(),
//         yubin = company.yubin.clone().unwrap_or_default(),
//         jusho1 = company.jusho1.clone().unwrap_or_default(),
//         daihyou = company.daihyou.clone().unwrap_or_default(),
//         tel = company.tel.clone().unwrap_or_default(),
//         fax = company.fax.clone().unwrap_or_default(),
//         ginkou = company.ginkou.clone().unwrap_or_default(),
//         kaishain_html = kaishain_html,
//     )
// }

// fn kingaku_format(n: f64) -> String {
//     // まず小数点以下 2 桁に丸める
//     let mut s = format!("{:.2}", n);

//     // 末尾の 0 を削除
//     if s.contains('.') {
//         while s.ends_with('0') {
//             s.pop();
//         }
//         if s.ends_with('.') {
//             s.pop();
//         }
//     }

//     // 整数部と小数部に分割
//     let parts: Vec<&str> = s.split('.').collect();
//     let int_part = parts[0].to_string();

//     // 整数部に 3 桁区切りを入れる
//     let chars: Vec<char> = int_part.chars().rev().collect();
//     let mut with_commas = String::new();
//     for (i, c) in chars.iter().enumerate() {
//         if i != 0 && i % 3 == 0 {
//             with_commas.push(',');
//         }
//         with_commas.push(*c);
//     }
//     let int_formatted: String = with_commas.chars().rev().collect();

//     // 小数部がある場合
//     if parts.len() == 2 {
//         format!("{}.{}", int_formatted, parts[1])
//     } else {
//         int_formatted
//     }
// }

// fn show_opt(n: Option<f64>) -> String {
//     match n {
//         None => "<span style='opacity:0'>0</span>".to_string(), // NULL → 透明の0
//         Some(v) if v == 0.0 => "<span style='opacity:0'>0</span>".to_string(), // 0 → 透明の0
//         Some(v) => kingaku_format(v),                           // 値あり → 表示
//     }
// }
