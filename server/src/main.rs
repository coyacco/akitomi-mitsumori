use axum::response::IntoResponse;
use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use rusqlite::Connection;
use rusqlite::ToSql;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::process::Command;
use tower_http::cors::CorsLayer;

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
    goukei_kingaku: Option<f64>,
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

    pub torihiki_jouken: Option<String>,
    pub yukou_kigen: Option<String>,
    pub ukewatashi_kijitu: Option<String>,
    pub ukewatashi_basho: Option<String>,
    pub goukei: Option<f64>,
    pub sotozeigaku: Option<f64>,
    pub zeiritsu: Option<f64>,
    pub zei_type: Option<String>,
    pub kaishain: Option<String>,
    // 自社情報
    // pub yubin: Option<String>,
    // pub jusho1: Option<String>,
    // pub daihyou: Option<String>,
    // pub tel: Option<String>,
    // pub fax: Option<String>,
    // pub mail: Option<String>,
    // pub ginkou: Option<String>,
    // pub mix: Option<String>,
}

#[derive(Serialize)]
pub struct MitsumoriDetail {
    pub hinmoku: String,
    pub suryo: Option<f64>,
    pub tanni: String,
    pub tannka: Option<f64>,
    pub kingaku: Option<f64>,
    pub bikou: String,
}

#[derive(Serialize)]
pub struct MitsumoriCompany {
    pub yubin: Option<String>,
    pub jusho1: Option<String>,
    pub daihyou: Option<String>,
    pub tel: Option<String>,
    pub fax: Option<String>,
    pub mail: Option<String>,
    pub ginkou: Option<String>,
    pub mix: Option<String>,
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
        conn.query_row(&total_sql, [params_total[0].clone()], |row| row.get(0))
            .unwrap()
    };

    // --- 一覧 SQL ---
    let mut list_sql = String::from(
        "SELECT mitsumori_no, sakusei, mitsumorisaki_meisho, keisho, goukei_kingaku
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
            mitsumori_no,
            sakusei,
            mitsumorisaki_meisho,
            keisho,
            goukei_kingaku,
            torihiki_jouken,
            yukou_kigen,
            ukewatashi_kijitu,
            ukewatashi_basho,
            goukei,
            sotozeigaku,
            zeiritsu,
            zei_type,
            kaishain
         FROM mitsumori
         WHERE mitsumori_no = ?",
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

                torihiki_jouken: row.get(5).ok(),
                yukou_kigen: row.get(6).ok(),
                ukewatashi_kijitu: row.get(7).ok(),
                ukewatashi_basho: row.get(8).ok(),

                goukei: row.get(9).ok(),
                sotozeigaku: row.get(10).ok(),
                zeiritsu: row.get(11).ok(),
                zei_type: row.get(12).ok(),
                kaishain: row.get(13).ok(),
            })
        })
        .unwrap();

    Json(header)
}

async fn get_mitsumori_detail(Path(no): Path<i32>) -> Json<Vec<MitsumoriDetail>> {
    let conn = Connection::open("data.db").unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT hinmoku, siyou, suryo, tanni, tannka, kingaku, bikou
             FROM mitsumori_item
             WHERE mitsumori_no = ?",
        )
        .unwrap();

    let rows = stmt
        .query_map([no], |row| {
            Ok(MitsumoriDetail {
                hinmoku: row.get::<_, String>(0)?,
                suryo: row.get::<_, Option<f64>>(2).ok().flatten(),
                tanni: row.get::<_, String>(3)?,
                tannka: row.get::<_, Option<f64>>(4).ok().flatten(),
                kingaku: row.get::<_, Option<f64>>(5).ok().flatten(),
                bikou: row.get::<_, String>(6)?,
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
        .route("/api/pdf/:no", get(pdf_handler))
        .with_state(state)
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    println!("Server running on http://{}...", addr);

    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn pdf_handler(Path(no): Path<i32>) -> impl IntoResponse {
    println!("pdf_handler {}", no);

    // 1. DB から header/detail を取得
    let header = load_header(no);
    let items = load_detail(no);
    let company = load_company();

    // 2. HTML を生成
    let html = build_pdf_html(&header, &items, &company);

    let html_path = format!("temp_{}.html", no);
    std::fs::write(&html_path, html).unwrap();

    let abs = std::fs::canonicalize(&html_path).unwrap();
    let mut abs_str = abs.to_str().unwrap().to_string();

    // Windows の UNC パス "\\?\" を除去
    if abs_str.starts_with(r"\\?\") {
        abs_str = abs_str.trim_start_matches(r"\\?\").to_string();
    }

    // Chrome 用 URL に変換
    let html_url = format!("file:///{}", abs_str.replace("\\", "/"));

    println!("HTML URL = {}", html_url);

    let pdf_abs = std::fs::canonicalize(".")
        .unwrap()
        .join(format!("temp_{}.pdf", no));

    let mut pdf_str = pdf_abs.to_str().unwrap().to_string();

    if pdf_str.starts_with(r"\\?\") {
        pdf_str = pdf_str.trim_start_matches(r"\\?\").to_string();
    }

    println!("pdf_str = {}", pdf_str);

    // 4. Chromium の print-to-pdf を実行
    let chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe";
    // let chrome_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";

    println!("chrome_path = {}", chrome_path);

    let status = Command::new(chrome_path)
        .args([
            "--headless",
            "--disable-gpu",
            &format!("--print-to-pdf={}", pdf_str),
            &html_url,
        ])
        .status()
        .unwrap();

    // 5. PDF を読み込んで返す
    let pdf_bytes = std::fs::read(&pdf_str).unwrap();

    // 6. 後片付け
    let _ = std::fs::remove_file(&html_path);
    let _ = std::fs::remove_file(&pdf_str);

    (
        axum::http::StatusCode::OK,
        [
            ("Content-Type", "application/pdf"),
            (
                "Content-Disposition",
                "attachment; filename=\"estimate.pdf\"",
            ),
        ],
        pdf_bytes,
    )
}

fn load_header(no: i32) -> MitsumoriHeader {
    let conn = Connection::open("data.db").unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT 
                mitsumori_no,
                sakusei,
                mitsumorisaki_meisho,
                keisho,
                goukei_kingaku,
                torihiki_jouken,
                yukou_kigen,
                ukewatashi_kijitu,
                ukewatashi_basho,
                goukei,
                sotozeigaku,
                zeiritsu,
                zei_type,
                kaishain
             FROM mitsumori
             WHERE mitsumori_no = ?",
        )
        .unwrap();

    stmt.query_row([no], |row| {
        Ok(MitsumoriHeader {
            mitsumori_no: row.get(0)?,
            sakusei: row.get(1).ok(),
            mitsumorisaki_meisho: row.get(2).ok(),
            keisho: row.get(3).ok(),
            goukei_kingaku: row.get(4).ok(),

            torihiki_jouken: row.get(5).ok(),
            yukou_kigen: row.get(6).ok(),
            ukewatashi_kijitu: row.get(7).ok(),
            ukewatashi_basho: row.get(8).ok(),

            goukei: row.get(9).ok(),
            sotozeigaku: row.get(10).ok(),
            zeiritsu: row.get(11).ok(),
            zei_type: row.get(12).ok(),
            kaishain: row.get(13).ok(),
        })
    })
    .unwrap()
}

fn load_detail(no: i32) -> Vec<MitsumoriDetail> {
    let conn = Connection::open("data.db").unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT hinmoku, siyou, suryo, tanni, tannka, kingaku, bikou
             FROM mitsumori_item
             WHERE mitsumori_no = ?",
        )
        .unwrap();

    let rows = stmt
        .query_map([no], |row| {
            Ok(MitsumoriDetail {
                hinmoku: row.get::<_, String>(0)?,
                // siyou は存在しないので削除
                suryo: row.get::<_, Option<f64>>(2).ok().flatten(),
                tanni: row.get::<_, String>(3)?,
                tannka: row.get::<_, Option<f64>>(4).ok().flatten(),
                kingaku: row.get::<_, Option<f64>>(5).ok().flatten(),
                bikou: row.get::<_, String>(6)?,
            })
        })
        .unwrap();

    let mut list = Vec::new();
    for r in rows {
        list.push(r.unwrap());
    }

    list
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
            mix: row.get(7).ok(),
        })
    })
    .unwrap()
}

pub fn build_pdf_html(
    header: &MitsumoriHeader,
    items: &[MitsumoriDetail],
    company: &MitsumoriCompany,
) -> String {
    // 明細行
    let mut detail_rows = String::new();
    for i in items {
        let tannka = show_opt(i.tannka);
        let suryo = show_opt(i.suryo);

        let kingaku_calc = match (i.tannka, i.suryo) {
            (Some(t), Some(s)) => Some(t * s), // 両方値があるときだけ計算
            _ => None,                         // どちらか NULL → None
        };
        let kingaku = show_opt(kingaku_calc);

        // // 計算は NULL → 0 として扱う
        // let kingaku_calc = i.tannka.unwrap_or(0.0) * i.suryo.unwrap_or(0.0);

        // // 表示は show_opt に渡す
        // let kingaku = show_opt(Some(kingaku_calc));

        detail_rows.push_str(&format!(
            "<tr>
                <td>{}</td>
                <td class='right'>{}</td>
                <td class='center'>{}</td>
                <td class='right'>{}</td>
                <td class='right'>{}</td>
                <td>{}</td>
            </tr>",
            i.hinmoku,
            suryo,
            i.tanni.clone(),
            tannka,
            kingaku,
            i.bikou.clone(),
        ));
        //     let kingaku = i.tannka * i.suryo;
        //     detail_rows.push_str(&format!(
        //         "<tr>
        //     <td>{}</td>
        //     <td class='right'>{}</td>
        //     <td class='center'>{}</td>
        //     <td class='right'>{}</td>
        //     <td class='right'>{}</td>
        //     <td>{}</td>
        // </tr>",
        //         i.hinmoku,
        //         i.suryo,
        //         i.tanni.clone(),
        //         i.tannka,
        //         i.tannka * i.suryo,
        //         i.bikou.clone(),
        //     ));
    }

    // 合計金額（大文字）
    let goukei_main = if let Some(g) = header.goukei {
        format!("￥{} -", kingaku_format(g))
    } else {
        "".to_string()
    };

    // 会社印（画像）
    let kaishain_html = if header.kaishain.clone().unwrap_or_default() == "1" {
        r#"
        <img src="akitomi.JPG" style="position:absolute; left:138mm; top:27mm; width:33mm;">
        <img src="seta.JPG"    style="position:absolute; left:178mm; top:37mm; width:15mm;">
        "#
        .to_string()
    } else {
        "".to_string()
    };

    // let summary_top = 76.0 + (items.len() as f64 * 6.0);

    let summary_rows = format!(
        r#"
    <!-- 小計 -->
    <tr>
        <td style="border:none;"></td>
        <td colspan="3" class="left" style="border:1px solid #000;">小計</td>
        <td class="right" style="border:1px solid #000;">{goukei_kingaku}</td>
        <td style="border:none;"></td>
    </tr>

    <!-- 消費税 -->
    <tr>
        <td style="border:none;"></td>
        <td colspan="3" class="left" style="border:1px solid #000;">消費税（{zeiritsu}％）</td>
        <td class="right" style="border:1px solid #000;">{sotozeigaku}</td>
        <td style="border:none;"></td>
    </tr>

    <!-- 合計 -->
    <tr>
        <td style="border:none;"></td>
        <td colspan="3" class="left" style="border:1px solid #000;">合計</td>
        <td class="right" style="border:1px solid #000;">{goukei}</td>
        <td style="border:none;"></td>
    </tr>
    "#,
        goukei_kingaku = kingaku_format(header.goukei_kingaku.unwrap_or(0.0)),
        zeiritsu = header.zeiritsu.unwrap_or(10.0),
        sotozeigaku = kingaku_format(header.sotozeigaku.unwrap_or(0.0)),
        goukei = kingaku_format(header.goukei.unwrap_or(0.0)),
    );

    let detail_and_summary = format!("{}{}", detail_rows, summary_rows);

    format!(
        r#"
<html>
<head>
<meta charset="UTF-8">
<style>
    @page {{
        size: A4 portrait;
        margin: 10mm;
    }}

    body {{
        font-family: 'IPAexGothic', sans-serif;
        font-size: 11px;
    }}

    .title {{
        position:absolute; left:100mm; top:10mm;
        font-size:20px; font-weight:bold;
    }}

    .mitsumori-no {{
        position:absolute; left:20mm; top:10mm;
        font-size:10px;
    }}

    .sakuseibi {{
        position:absolute; left:150mm; top:10mm;
        font-size:10px; text-align:right; width:50mm;
    }}

    .mitsumorisaki {{
        position:absolute; left:20mm; top:22mm;
        width:80mm; font-size:16px;
        border-bottom:1px solid #000;
        text-align:center; padding-bottom:2mm;
    }}

    .goukei-label {{
        position:absolute; left:20mm; top:34mm;
        font-size:14px;
    }}

    .goukei-main {{
        position:absolute; left:40mm; top:34mm;
        width:60mm; font-size:20px;
        text-align:center; border-bottom:1px solid #000;
        padding-bottom:2mm;
    }}

    .info-label {{
        position:absolute; left:20mm; font-size:10px;
    }}
    .info-value {{
        position:absolute; left:40mm; font-size:11px;
        width:60mm; border-bottom:1px solid #000;
    }}

    .company-block {{
    position: absolute;
    left: 110mm;
    top: 28mm;
    width: 90mm;
    text-align: center;
    font-size: 10px;
    }}

    .company-name {{
    font-size: 22px;
    margin-top: 2mm;
    position: relative;   /* ← これが重要 */
    }}

    .kabushiki {{
    position: absolute;
    left: 23mm;   /* ← 秋富商店の左に配置 */
    top: 7.5mm;      /* ← 高さを揃える */
    font-size: 11px;
    line-height: 1.0;
    white-space: pre;
    }}

    .item-header {{
        position:absolute; left:10mm; top:76mm;
        width:190mm;
    }}

    .summary-block {{
        position: absolute;
        left: 95mm;   /* 10 + 85 */
        top: 0mm;     /* 後で動的に差し込む */
        width: 66mm;  /* 43 + 23 */
        font-size: 11px;
    }}

    .summary-row {{
        display: flex;
    }}

    .summary-label {{
        width: 43mm;      /* 数量 + 単位 + 単価 */
        border: 1px solid #000;
        padding: 2px;
    }}

    .summary-value {{
        width: 23mm;      /* 金額 */
        border: 1px solid #000;
        padding: 2px;
        text-align: right;
    }}

    table.item-table {{
        width: 180mm;   /* ← 190mm → 180mm に変更 */
        border-collapse: collapse;
        font-size: 11px;
    }}

    table.item-table th, table.item-table td {{
        border:1px solid #000; padding:2px 3px;
    }}

    table.item-table th {{
        text-align:center; background:#f0f0f0;
    }}

    table.item-table th:nth-child(1) {{ width:85mm; }}
    table.item-table th:nth-child(2) {{ width:13mm; }}
    table.item-table th:nth-child(3) {{ width:10mm; }}
    table.item-table th:nth-child(4) {{ width:20mm; }}
    table.item-table th:nth-child(5) {{ width:23mm; }}
    table.item-table th:nth-child(6) {{ width:40mm; }}

    .right {{ text-align:right; }}
    .center {{ text-align:center; }}

    .summary-table {{
        margin-top:4mm; width:180mm;
        border-collapse:collapse; font-size:11px;
    }}

    .summary-table th, .summary-table td {{
        border:1px solid #000; padding:3px;
    }}

    .remarks {{
        margin-top:6mm; width:180mm;
        border:1px solid #000; height:25mm;
        padding:3mm; font-size:11px;
    }}

    .item-table td {{
        height: 22px;          /* ← 好きな高さに調整 */
        vertical-align: middle;
    }}

    body {{
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
    }}

    .wrapper {{
        width: 180mm;     /* ← 210mm → 180mm に変更 */
        padding: 0;       /* ← 余白は @page に任せる */
        box-sizing: border-box;
    }}

    </style>
</head>

<body>
  <div class="wrapper">
      <!-- ここに見積書の全 HTML -->

<div class="mitsumori-no">見積No. {no}</div>
<div class="title">御見積書</div>
<div class="sakuseibi">{sakusei}</div>

<div class="mitsumorisaki">{mitsumorisaki} {keisho}</div>

<div class="goukei-label">合計金額</div>
<div class="goukei-main">{goukei_main}</div>

{kaishain_html}

<!-- 取引条件 -->
<div class="info-label" style="top:43mm;">取引条件</div>
<div class="info-value" style="top:43mm;">{torihiki}</div>

<!-- 有効期限 -->
<div class="info-label" style="top:49mm;">有効期限</div>
<div class="info-value" style="top:49mm;">{yukou}</div>

<!-- 受渡期日 -->
<div class="info-label" style="top:55mm;">受渡期日</div>
<div class="info-value" style="top:55mm;">{kijitu}</div>

<!-- 受渡場所 -->
<div class="info-label" style="top:61mm;">受渡場所</div>
<div class="info-value" style="top:61mm;">{basho}</div>

<!-- 会社情報 -->
<div class="company-block">
    <div>{yubin} {jusho1}</div>
    <div class="company-name">秋 富 商 店</div>
    <div class="kabushiki">株式<br>会社</div>
    <div class="company-rep">{daihyou}</div>
    <div class="company-tel">TEL:{tel}　FAX:{fax}</div>
    <div class="company-bank">取引銀行:{ginkou}</div>
</div>

<!-- 明細 -->
<div class="item-header">
<table class="item-table">
    <tr>
        <th>品名・仕様</th>
        <th>数量</th>
        <th>単位</th>
        <th>単価</th>
        <th>金額</th>
        <th>備考</th>
    </tr>

    {detail_and_summary}
</table>
</div>

</div>
</body>
</html>
"#,
        no = header.mitsumori_no,
        sakusei = header.sakusei.clone().unwrap_or_default(),
        mitsumorisaki = header.mitsumorisaki_meisho.clone().unwrap_or_default(),
        keisho = header.keisho.clone().unwrap_or_default(),
        goukei_main = goukei_main,
        torihiki = header.torihiki_jouken.clone().unwrap_or_default(),
        yukou = header.yukou_kigen.clone().unwrap_or_default(),
        kijitu = header.ukewatashi_kijitu.clone().unwrap_or_default(),
        basho = header.ukewatashi_basho.clone().unwrap_or_default(),
        yubin = company.yubin.clone().unwrap_or_default(),
        jusho1 = company.jusho1.clone().unwrap_or_default(),
        daihyou = company.daihyou.clone().unwrap_or_default(),
        tel = company.tel.clone().unwrap_or_default(),
        fax = company.fax.clone().unwrap_or_default(),
        ginkou = company.ginkou.clone().unwrap_or_default(),
        // detail_rows = detail_rows,
        // goukei_kingaku = header.goukei_kingaku.unwrap_or(0.0),
        // zeiritsu = header.zeiritsu.unwrap_or(10.0),
        // sotozeigaku = header.sotozeigaku.unwrap_or(0.0),
        // goukei = header.goukei.unwrap_or(0.0),
        kaishain_html = kaishain_html,
    )
}

fn kingaku_format(n: f64) -> String {
    // まず小数点以下 2 桁に丸める
    let mut s = format!("{:.2}", n);

    // 末尾の 0 を削除
    if s.contains('.') {
        while s.ends_with('0') {
            s.pop();
        }
        if s.ends_with('.') {
            s.pop();
        }
    }

    // 整数部と小数部に分割
    let parts: Vec<&str> = s.split('.').collect();
    let mut int_part = parts[0].to_string();

    // 整数部に 3 桁区切りを入れる
    let mut chars: Vec<char> = int_part.chars().rev().collect();
    let mut with_commas = String::new();
    for (i, c) in chars.iter().enumerate() {
        if i != 0 && i % 3 == 0 {
            with_commas.push(',');
        }
        with_commas.push(*c);
    }
    let int_formatted: String = with_commas.chars().rev().collect();

    // 小数部がある場合
    if parts.len() == 2 {
        format!("{}.{}", int_formatted, parts[1])
    } else {
        int_formatted
    }
}

fn show_opt(n: Option<f64>) -> String {
    match n {
        None => "<span style='opacity:0'>0</span>".to_string(), // NULL → 透明の0
        Some(v) if v == 0.0 => "<span style='opacity:0'>0</span>".to_string(), // 0 → 透明の0
        Some(v) => kingaku_format(v),                           // 値あり → 表示
    }
}
