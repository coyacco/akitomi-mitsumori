import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Detail from "./Detail";
import "./App.css";

interface MitsumoriListRow {
  mitsumori_no: number;
  sakusei: string | null;
  mitsumorisaki_meisho: string | null;
  keisho: string | null;
  goukei_kingaku: number | null;
  items: string[];
}

interface MitsumoriListResult {
  total: number;
  rows: MitsumoriListRow[];
}

export default function App() {
  // Hooks
  const [page, setPage] = useState(0);
  const [data, setData] = useState<MitsumoriListResult | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [searchClient, setSearchClient] = useState("");

  // 検索語
  // const [searchClient, setSearchClient] = useState("");
  // const [searchItem, setSearchItem] = useState("");

  // 検索語が変わったら page=0 に戻す
  useEffect(() => {
    setPage(0);
  }, [searchClient/*, searchItem*/]);

  console.log("invoke params:", {
    page,
    // searchClient: searchClient,
    // searchItem: searchItem,
  });

  // 一覧データ取得（検索語も渡す）
  useEffect(() => {
    invoke<MitsumoriListResult>("get_mitsumori_list", {
      page,
      pageSize,
      searchClient,
      // searchItem: searchItem,
    })
      .then((res) => setData(res))
      .catch(console.error);
  }, [page, pageSize, searchClient/*, searchItem*/]);

  // 詳細画面
  if (selected !== null) {
    return <Detail no={selected} onBack={() => setSelected(null)} />;
  }

  if (!data) return <div>Loading...</div>;

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div style={{ padding: 20 }}>
      <h1>見積書一覧</h1>

      {/* 🔍 検索ボックス
      <div style={{ marginBottom: 10 }}>
        <input
          type="text"
          placeholder="見積もり先で検索"
          value={searchClient}
          onChange={(e) => setSearchClient(e.target.value)}
          style={{ marginRight: 10, padding: 6, width: 200 }}
        />

        <input
          type="text"
          placeholder="品目で検索"
          value={searchItem}
          onChange={(e) => setSearchItem(e.target.value)}
          style={{ padding: 6, width: 200 }}
        />
      </div> */}



      {/* ページング */}
      <div
        style={{
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* 左側：ページングボタン */}
        <div style={{ marginRight: 10 }}>
          <button
            onClick={() => setPage(0)}
            disabled={page === 0}
            style={{ marginRight: 5 }}
          >
            ≪ 最新へ
          </button>

          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
            style={{ marginRight: 5 }}
          >
            ＜
          </button>

          ({page + 1}/{totalPages})

          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages - 1}
            style={{ marginLeft: 5 }}
          >
            ＞
          </button>
        </div>

        {/* 🔍 検索ボックス（← select の直前に移動） */}
        🔍<input
          type="text"
          placeholder="見積先で検索"
          value={searchClient}
          onChange={(e) => setSearchClient(e.target.value)}
          style={{ padding: 6, width: 200, marginRight: 10 }}
        />

        {/* 右側：件数選択 */}
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(0);
          }}
          style={{
            padding: 6,
            marginLeft: "auto",
          }}
        >
          <option value={20}>20件</option>
          <option value={50}>50件</option>
          <option value={100}>100件</option>
          <option value={1000}>1000件</option>
        </select>
      </div>



      {/* 一覧テーブル */}
      <table className="list-table">
        <thead className="table-header">
          <tr>
            <th style={{ width: "120px" }}>見積書番号</th>
            <th style={{ width: "120px" }}>発行日付</th>
            <th>見積先</th>
            <th style={{ width: "140px", textAlign: "right" }}>見積金額</th>
          </tr>
        </thead>

        <tbody>
          {data.rows.map((row) => (
            <tr
              key={row.mitsumori_no}
              onClick={() => setSelected(row.mitsumori_no)}
              className="list-row"
            >
              <td>{row.mitsumori_no}</td>

              <td>
                {row.sakusei
                  ? new Date(row.sakusei).toLocaleDateString("ja-JP")
                  : ""}
              </td>

              <td>
                {row.mitsumorisaki_meisho} {row.keisho}
              </td>

              <td style={{ textAlign: "right" }}>
                {row.goukei_kingaku
                  ? row.goukei_kingaku.toLocaleString()
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
