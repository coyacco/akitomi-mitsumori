import { useEffect, useState } from "react";

interface Header {
  mitsumori_no: number;
  sakusei: string | null;
  mitsumorisaki_meisho: string | null;
  keisho: string | null;
  goukei_kingaku: number | null;
  bikou: string | null;
}

interface DetailRow {
  hinmoku: string;
  siyou: string;
  suryo: number;
  tanni: string;
  tannka: number;
  kingaku: number;
  bikou: string;
}

export default function Detail({ no, onBack }: { no: number; onBack: () => void }) {
  const [header, setHeader] = useState<Header | null>(null);
  const [items, setItems] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // --- Header ---
        const h = await fetch(`http://localhost:3001/api/mitsumori/header/${no}`)
          .then((res) => res.json());
        setHeader(h);

        // --- Detail rows ---
        const d = await fetch(`http://localhost:3001/api/mitsumori/detail/${no}`)
          .then((res) => res.json());
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

  return (
    <div style={{ padding: 20 }}>
      <button onClick={onBack}>← 一覧へ戻る</button>

      <h2>見積書 詳細（No: {header.mitsumori_no}）</h2>

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
          <tr>
            <th>備考</th>
            <td>{header.bikou || ""}</td>
          </tr>
        </tbody>
      </table>

      {/* --- 明細一覧 --- */}
      <table className="detail-table">
        <thead className="table-header">
          <tr>
            <th>品目</th>
            <th>仕様</th>
            <th>数量</th>
            <th>単位</th>
            <th>単価</th>
            <th>金額</th>
            <th>備考</th>
          </tr>
        </thead>

        <tbody>
          {items.map((i, idx) => {
            const hide = i.suryo === 0 && (i.tannka === 0 || i.kingaku === 0);
            const empty = <span style={{ opacity: 0 }}>0</span>;

            return (
              <tr key={idx}>
                <td>{i.hinmoku}</td>
                <td>{i.siyou}</td>

                <td className="text-right">{hide ? empty : i.suryo}</td>
                <td>{i.tanni}</td>

                <td className="text-right">
                  {hide ? empty : "￥" + i.tannka.toLocaleString()}
                </td>

                <td className="text-right">
                  {hide ? empty : "￥" + i.kingaku.toLocaleString()}
                </td>

                <td>{i.bikou}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
