import { useEffect, useState } from "react";
import { displayTantou } from "./utils";
import EditForm from "./EditForm";
import PrintPreview from "./PrintPreview";
import type { DetailHeader, DetailRow, MitsumoriCompany } from "./types";

export default function Detail({ no, onBack, onMove }: { no: number; onBack: () => void; onMove: (nextNo: number) => void }) {
  const [header, setHeader] = useState<DetailHeader | null>(null);
  const [items, setItems] = useState<DetailRow[]>([]);
  const [company, setCompany] = useState<MitsumoriCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"view" | "edit" | "duplicate" | "print">("view");
  const [shainList, setShainList] = useState<{ shain_cd: string; name: string }[]>([]);

  async function handleDelete() {
    if (!window.confirm("この見積書を削除しますか？")) return;

    try {
      await fetch(`http://localhost:3001/api/mitsumori/${no}`, {
        method: "DELETE",
      });

      alert("削除しました");
      onBack(); // ← 一覧へ戻る
    } catch (err) {
      console.error("Delete error:", err);
      alert("削除に失敗しました");
    }
  }

  async function load() {
    setLoading(true);
    try {
      const [h, d, c, s] = await Promise.all([
        fetch(`http://localhost:3001/api/mitsumori/header/${no}`).then((r) => r.json()),
        fetch(`http://localhost:3001/api/mitsumori/detail/${no}`).then((r) => r.json()),
        fetch(`http://localhost:3001/api/mitsumori/company`).then((r) => r.json()),
        fetch(`http://localhost:3001/api/shain`).then((r) => r.json()),
      ]);
      setHeader(h);
      setItems(d);
      setCompany(c);
      setShainList(s || []);
    } catch (err) {
      console.error("Load error:", err);
      // shainList が失敗しても continue
      setShainList([]);
    } finally {
      setLoading(false);
    }
  }

  // 初回＆no が変わった時に読み込み
  useEffect(() => {
    load();
  }, [no]);

  if (loading || !header) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  if (!header) {
    return <div>Loading...</div>;
  }

  if (mode === "print") {
    return (
      <PrintPreview
        header={header}
        items={items}
        company={company}
        onClose={() => setMode("view")}
      />
    );
  }

  // 編集モード
  if (mode === "edit") {
    return (
      <EditForm
        header={header}
        items={items}
        shainList={shainList}
        onCancel={() => setMode("view")}
        onSaved={(no) => {
          setMode("view");  // 編集モード終了
          onMove(no);       // App に番号を渡す（Detail を再表示）
          load();           // 最新データを再取得（共通化した load を呼ぶ）
        }}
      />
    );
  }

  // 複製モード
  if (mode === "duplicate") {
    // 新規作成ヘッダ（mitsumori_no = 0）を作成
    const duplicateHeader = {
      ...header,
      mitsumori_no: 0,  // 新規フラグ
    };

    return (
      <EditForm
        header={duplicateHeader}
        items={items}
        shainList={shainList}
        isDuplicate={true}
        onCancel={() => setMode("view")}
        onSaved={(newNo) => {
          setMode("view");  // 複製モード終了
          onMove(newNo);    // 新規見積書の詳細へ遷移
        }}
      />
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1 >見積書 詳細</h1>
      {/* <button onClick={() => setMode("print")}>
        印刷プレビュー
      </button> */}
      <div style={{ marginBottom: 10 }}>
        <button onClick={onBack}>← 一覧へ戻る</button>

        <button onClick={() => onMove(no + 1)} style={{ marginLeft: 10 }}>
          ← 次へ
        </button>

        <button onClick={() => onMove(no - 1)} disabled={no <= 1} style={{ marginLeft: 10 }}>
          前へ →
        </button>

      </div>

      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setMode("print")}>
          印刷
        </button>
        {/* <button onClick={printPdf}>
          印刷
        </button> */}
        {/* <iframe
          ref={iframeRef}
          src={`http://localhost:3001/api/pdf/${header.mitsumori_no}`}
          width="0"
          height="0"
          style={{ display: "none" }}
          title="pdf-print"
        /> */}
        <button
          onClick={() => setMode("edit")}
          style={{ marginLeft: 10 }}
        >
          編集
        </button>
        <button
          onClick={() => setMode("duplicate")}
          style={{ marginLeft: 10 }}
        >
          複製
        </button>
      </div>

      {/* --- 見積ヘッダ --- */}
      <table className="detail-header-table">
        <tbody>
          <tr><th>No.</th><td>{header.mitsumori_no}</td></tr>
          <tr><th>作成日</th><td>{header.sakusei ? new Date(header.sakusei).toLocaleDateString("ja-JP") : ""}</td></tr>
          <tr><th>作成者</th><td>{displayTantou(header.tantou, header.tantou_name)}</td></tr>
          <tr><th>見積先</th><td>{header.mitsumorisaki_meisho} {header.keisho}</td></tr>
          <tr><th>合計金額</th><td className="text-right">{header.goukei_kingaku ? "￥" + header.goukei_kingaku.toLocaleString() : ""}</td></tr>
          <tr><th>取引条件</th><td>{header.torihiki_jouken}</td></tr>
          <tr><th>有効期間</th><td>{header.yukou_kigen}</td></tr>
          <tr><th>受渡期日</th><td>{header.ukewatashi_kijitu}</td></tr>
          <tr><th>受渡場所</th><td>{header.ukewatashi_basho}</td></tr>
          <tr><th>消費税</th><td>{header.zei_type === 0 || (header.sotozeigaku && header.sotozeigaku > 0) ? "外税（税別）" : "なし（非課税）"}</td></tr>
        </tbody>
      </table>

      {/* --- 明細一覧 --- */}
      <table className="detail-table">
        <thead className="table-header">
          <tr>
            <th>品目</th>
            <th>数量</th>
            <th>単位</th>
            <th>単価</th>
            <th>金額</th>
            <th>備考</th>
          </tr>
        </thead>

        <tbody>
          {items.map((i, idx) => (
            <tr key={idx}>
              <td>{i.hinmoku}</td>
              <td className="text-right">{i.suryo ?? ""}</td>
              <td className="text-center">{i.tanni ?? ""}</td>
              <td className="text-right">{i.tannka?.toLocaleString() ?? ""}</td>
              <td className="text-right">{i.kingaku?.toLocaleString() ?? ""}</td>
              <td>{i.bikou}</td>
            </tr>
          ))}
          {/* --- 小計（goukei > 0 かつ sotozeigaku > 0） --- */}
          {(header.goukei ?? 0) > 0 && (header.sotozeigaku ?? 0) > 0 && (
            <tr>
              <td className="no-border"></td>
              <td colSpan={3} className="summary-label">小計</td>
              <td className="text-right">{header.goukei?.toLocaleString() ?? ""}</td>
              <td className="no-border"></td>
            </tr>
          )}

          {/* --- 消費税（goukei > 0 かつ sotozeigaku > 0） --- */}
          {(header.goukei ?? 0) > 0 && (header.sotozeigaku ?? 0) > 0 && (
            <tr>
              <td className="no-border"></td>
              <td colSpan={3} className="summary-label">
                {header.zeiritsu == null
                  ? "消費税"
                  : `消費税（${header.zeiritsu.toFixed(0)}％）`}
              </td>
              <td className="text-right">{header.sotozeigaku?.toLocaleString() ?? ""}</td>
              <td className="no-border"></td>
            </tr>
          )}

          {/* --- 合計（常に表示） --- */}
          <tr>
            <td className="no-border"></td>
            <td colSpan={3} className="summary-label">合計</td>
            <td className="text-right">{header.goukei_kingaku?.toLocaleString() ?? ""}</td>
            <td className="no-border"></td>
          </tr>
        </tbody>
      </table>

      <button onClick={handleDelete} style={{ color: "red", marginLeft: 10 }}>
        削除
      </button>

    </div>
  );
}
