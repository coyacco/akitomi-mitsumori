import { useEffect, useState } from "react";
import Detail from "./Detail";
import EditForm from "./EditForm";
import ServerSettings from "./ServerSettings";
import SettingsRoot from "./SettingsRoot";
import CompanySettings from "./CompanySettings";
import ShainSettings from "./ShainSettings";
import { loadServerAddress } from "./loadServerAddress";
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
  // -----------------------------
  // Hooks はすべてここに集める（順番固定）
  // -----------------------------
  const [server, setServer] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  const [page, setPage] = useState(0);
  const [data, setData] = useState<MitsumoriListResult | null>(null);
  const [selectedNo, setSelectedNo] = useState<number | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [searchClient, setSearchClient] = useState("");
  const [creating, setCreating] = useState(false);
  const [shainList, setShainList] = useState([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settingsPage, setSettingsPage] = useState<null | "root" | "company" | "shain">(null);

  // -----------------------------
  // サーバー設定読み込み
  // -----------------------------
  useEffect(() => {
    loadServerAddress().then((addr) => {
      setServer(addr);
      setConfigLoaded(true);
    });
  }, []);

  // -----------------------------
  // 検索語が変わったら page=0
  // -----------------------------
  useEffect(() => {
    setPage(0);
  }, [searchClient]);

  // -----------------------------
  // 見積一覧取得
  // -----------------------------
  useEffect(() => {
    if (!server) return;
    fetchList();
  }, [page, pageSize, searchClient, server]);

  // -----------------------------
  // 社員一覧取得
  // -----------------------------
  useEffect(() => {
    if (!server) return;

    fetch(`${server}/api/shain/0`)
      .then((r) => {
        if (!r.ok) throw new Error("Server error");
        return r.json();
      })
      .then((data) => setShainList(data))
      .catch((e) => {
        console.error("shain fetch error:", e);
        setErrorMessage("サーバーに接続できませんでした。設定を確認してください。");
      });
  }, [server]);

  async function fetchList() {
    if (!server) return;

    try {
      const url =
        `${server}/api/mitsumori/list` +
        `?page=${page + 1}` +
        `&page_size=${pageSize}` +
        `&search_client=${encodeURIComponent(searchClient)}`;

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`サーバーエラー: ${res.status}`);
      }

      const json = await res.json();
      setData(json);
    } catch (e: any) {
      console.error("fetchList error:", e);
      setErrorMessage("サーバーに接続できませんでした。設定を確認してください。");
    }
  }

  if (errorMessage) {
    return (
      <div style={{ padding: 20 }}>
        <h2 style={{ color: "red" }}>エラー</h2>
        <p>{errorMessage}</p>

        <button
          onClick={() => {
            setErrorMessage(null);
            setServer(null); // ← 設定画面へ戻す
          }}
          style={{ marginTop: 20 }}
        >
          サーバー設定を開く
        </button>
      </div>
    );
  }

  // -----------------------------
  // ここから return（Hooks の後）
  // -----------------------------
  if (!configLoaded) return <div>Loading...</div>;

  if (!server) {
    return <ServerSettings onSaved={() => window.location.reload()} />;
  }

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
          zeiritsu: null,
          zei_type: 0,
          kaishain: null,
        }}
        items={[]}
        shainList={shainList}
        onCancel={() => setCreating(false)}
        onSaved={(no) => {
          setCreating(false);
          setSelectedNo(no);
          fetchList();
        }}
      />
    );
  }

  if (selectedNo !== null) {
    return (
      <Detail
        no={selectedNo}
        onBack={() => {
          setSelectedNo(null);
          fetchList();
        }}
        onMove={(nextNo) => setSelectedNo(nextNo)}
      />
    );
  }

  if (settingsPage === "root") {
    return (
      <SettingsRoot
        onSelect={(p) => setSettingsPage(p)}
        onBack={() => {
          setSettingsPage(null);
        }}
      />
    );
  }

  if (settingsPage === "company") {
    return (
      <CompanySettings
        server={server}
        onBack={() => setSettingsPage("root")}
      />
    );
  }

  if (settingsPage === "shain") {
    return (
      <ShainSettings
        server={server}
        onBack={() => setSettingsPage("root")}
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

      <button
        onClick={() => setSettingsPage("root")}
        style={{ marginBottom: 10, marginLeft: 10 }}
      >
        設定
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

        {/* 🔍 検索ボックス */}
        🔍<input
          type="text"
          placeholder="見積先で検索"
          value={searchClient}
          onChange={(e) => setSearchClient(e.target.value)}
          style={{ padding: 6, width: 200, marginRight: 10 }}
        />

        {/* 件数選択 */}
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
