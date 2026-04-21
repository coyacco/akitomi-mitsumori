import { useEffect, useState } from "react";
import EditForm from "./EditForm";

interface Header {
  mitsumori_no: number;
  sakusei: string | null;
  mitsumorisaki_meisho: string | null;
  keisho: string | null;
  goukei_kingaku: number | null;

  torihiki_jouken: string | null;
  yukou_kigen: string | null;
  ukewatashi_kijitu: string | null;
  ukewatashi_basho: string | null;
}

interface DetailRow {
  hinmoku: string;
  suryo: number | null;
  tanni: string;
  tannka: number | null;
  kingaku: number | null;
  bikou: string;
}

export default function Detail({ no, onBack }: { no: number; onBack: () => void }) {
  const [header, setHeader] = useState<Header | null>(null);
  const [items, setItems] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"view" | "edit">("view");

  // ★★★ handleDelete をここに置く（Detail の中）
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

  useEffect(() => {
    async function load() {
      try {
        const [h, d] = await Promise.all([
          fetch(`http://localhost:3001/api/mitsumori/header/${no}`).then((r) => r.json()),
          fetch(`http://localhost:3001/api/mitsumori/detail/${no}`).then((r) => r.json()),
        ]);
        setHeader(h);
        setItems(d);
      } catch (err) {
        console.error("Detail fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [no]);

  if (loading || !header) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  if (mode === "edit") {
    return (
      <EditForm
        header={header}
        items={items}
        onCancel={() => setMode("view")}
        onSaved={() => {
          onBack();   // 保存後は一覧へ戻る
        }}
      />
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <button onClick={onBack}>← 一覧へ戻る</button>

      <h2>見積書 詳細（No: {header.mitsumori_no}）</h2>

      <button
        onClick={() => setMode("edit")}
        style={{ marginRight: 10 }}
      >
        編集
      </button>

      <button onClick={handleDelete} style={{ color: "red" }}>
        削除
      </button>

      {/* --- 見積ヘッダ --- */}
      <table className="detail-header-table">
        <tbody>
          <tr>
            <th>発行日付</th>
            <td>
              {header.sakusei
                ? new Date(header.sakusei).toLocaleDateString("ja-JP")
                : ""}
            </td>
          </tr>
          <tr>
            <th>見積先</th>
            <td>
              {header.mitsumorisaki_meisho} {header.keisho}
            </td>
          </tr>
          <tr>
            <th>見積金額</th>
            <td className="text-right">
              {header.goukei_kingaku
                ? "￥" + header.goukei_kingaku.toLocaleString()
                : ""}
            </td>
          </tr>
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
        </tbody>
      </table>
    </div>
  );
}
