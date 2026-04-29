import { useEffect, useState } from "react";
import Detail from "./Detail";
import EditForm from "./EditForm";
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
  const [selectedNo, setSelectedNo] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [searchClient, setSearchClient] = useState(""); // 検索語
  const [creating, setCreating] = useState(false);
  const [shainList, setShainList] = useState([]);

  // 検索語が変わったら page=0 に戻す
  useEffect(() => {
    setPage(0);
  }, [searchClient/*, searchItem*/]);

  useEffect(() => {
    fetchList();
  }, [page, pageSize, searchClient]);

  useEffect(() => {
    fetch("http://localhost:3001/api/shain")
      .then((r) => r.json())
      .then((data) => setShainList(data));
  }, []);

  async function fetchList() {
    const url =
      `http://localhost:3001/api/mitsumori/list` +
      `?page=${page + 1}` +
      `&page_size=${pageSize}` +
      `&search_client=${encodeURIComponent(searchClient)}`;

    const res = await fetch(url);
    const json = await res.json();
    setData(json);
  }

  // 新規作成フォーム
  if (creating) {
    return (
      <EditForm
        header={{
          mitsumori_no: 0,
          sakusei: null,
          mitsumorisaki_meisho: null,
          keisho: null,
          tantou: null,
          tantou_name: null,

          torihiki_jouken: null,
          yukou_kigen: null,
          ukewatashi_kijitu: null,
          ukewatashi_basho: null,

          goukei_kingaku: 0,
          goukei: 0,
          sotozeigaku: 0,

          zeiritsu: null,   // ★ 新規作成時は後で会社マスタから取得
          zei_type: 0,      // ★ 新規作成は外税
          kaishain: null,
        }}

        items={[]}
        shainList={shainList}
        onCancel={() => setCreating(false)}
        onSaved={(no) => {
          setCreating(false);
          setSelectedNo(no);   // ★ 詳細画面へ移動
          fetchList();
        }}
      />
    );
  }

  // 詳細画面
  if (selectedNo !== null) {
    return (
      <Detail
        no={selectedNo}
        onBack={() => {
          setSelectedNo(null);
          fetchList();   // ★ 一覧を再読み込み
        }}
        onMove={(nextNo) => setSelectedNo(nextNo)}
      />
    );
  }

  if (!data) return <div>Loading...</div>;

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div style={{ padding: 20 }}>
      <h1>見積書一覧</h1>

      <button
        onClick={() => setCreating(true)}
        style={{ marginBottom: 10 }}
      >
        ＋ 新規作成
      </button>

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
            最新へ
          </button>

          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
            style={{ marginRight: 5 }}
          >
            前へ
          </button>

          ({page + 1}/{totalPages})

          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages - 1}
            style={{ marginLeft: 5 }}
          >
            次へ
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
            <th style={{ width: "80px" }}>No.</th>
            <th style={{ width: "120px" }}>作成日</th>
            <th>見積先</th>
            <th style={{ width: "140px" }}>見積金額</th>
          </tr>
        </thead>

        <tbody>
          {data.rows.map((row) => (
            <tr
              key={row.mitsumori_no}
              onClick={() => setSelectedNo(row.mitsumori_no)}
              className="list-row"
            >
              <td style={{ textAlign: "center" }}>{row.mitsumori_no}</td>

              <td style={{ textAlign: "center" }}>
                {row.sakusei
                  ? new Date(row.sakusei).toLocaleDateString("ja-JP")
                  : ""}
              </td>

              <td>
                {row.mitsumorisaki_meisho} {row.keisho}
              </td>

              <td style={{ textAlign: "right" }}>
                {row.goukei_kingaku?.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
