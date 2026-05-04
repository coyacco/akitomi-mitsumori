import { useEffect, useState } from "react";
import { displayTantou } from "./utils";
import { todayJST } from "./utils";
import "./App.css";

interface Header {
  mitsumori_no: number;
  sakusei: string | null;
  mitsumorisaki_meisho: string | null;
  keisho: string | null;
  tantou: string | null;
  tantou_name: string | null;
  goukei_kingaku: number | null;

  torihiki_jouken: string | null;
  yukou_kigen: string | null;
  ukewatashi_kijitu: string | null;
  ukewatashi_basho: string | null;

  goukei: number | null;
  sotozeigaku: number | null;
  zeiritsu: number | null;
  zei_type: number | null;
  kaishain: number | null;
}

interface DetailRow {
  hinmoku: string;
  suryo: number | null;
  tanni: string;
  tannka: number | null;
  kingaku: number | null;
  bikou: string;
}

export default function EditForm({
  header,
  items,
  shainList,
  onCancel,
  onSaved,
}: {
  header: Header;
  items: DetailRow[];
  shainList: { shain_cd: string; name: string }[];
  onCancel: () => void;
  onSaved: (no: number) => void;
}) {
  const isNew = header.mitsumori_no === 0;

  const [h, setH] = useState(() => {
    // 新規作成
    if (isNew) {
      const today = todayJST();

      return {
        ...header,
        sakusei: today,   // ← 今日の日付をセット
      };
    }

    // 既存データ編集
    return header;
  });

  const [rows, setRows] = useState(() => {
    if (items.length > 0) {
      return items; // 既存データの編集
    }

    // 新規作成 → 30 行の空行を作る
    return Array.from({ length: 30 }, () => ({
      hinmoku: "",
      suryo: null,
      tanni: "",
      tannka: null,
      kingaku: null,
      bikou: "",
    }));
  });

  // 初期状態を保持する state
  const [originalHeader, setOriginalHeader] = useState<Header | null>(null);
  const [originalRows, setOriginalRows] = useState<DetailRow[] | null>(null);

  // 新規作成時の初期化
  useEffect(() => {
    if (h.mitsumori_no === 0) {
      fetch("http://localhost:3001/api/mitsumori/company")
        .then((r) => r.json())
        .then((company) => {
          const newHeader = {
            ...h,
            zeiritsu: company.zeiritsu,
            zei_type: company.zei_type ?? 0,
          };
          setH(newHeader);

          // 初期化が終わった後に original をセット
          setOriginalHeader(newHeader);
          setOriginalRows(rows);
        });
    } else {
      // 編集時は最初から original をセット
      setOriginalHeader(h);
      setOriginalRows(rows);
    }
  }, []);

  function hasChanges() {
    if (!originalHeader || !originalRows) return false;

    return (
      JSON.stringify(originalHeader) !== JSON.stringify(h) ||
      JSON.stringify(originalRows) !== JSON.stringify(rows)
    );
  }

  // --- 明細行の変更 ---
  function updateRow(idx: number, key: keyof DetailRow, value: any) {
    setRows(prev => {
      const newRows = [...prev];
      const row = { ...newRows[idx] };

      // 数値フィールドを null / number に正規化
      const normalizeNumber = (v: any) =>
        v === "" || v === null || v === undefined ? null : Number(v);

      if (key === "suryo" || key === "tannka") {
        // 数量・単価の更新
        row[key] = normalizeNumber(value);

        // 数量 or 単価が変わったら kingaku を再計算
        const s = row.suryo;
        const t = row.tannka;
        row.kingaku = s != null && t != null ? s * t : null;

      } else if (key === "kingaku") {
        // 金額は手入力を許可
        row.kingaku = normalizeNumber(value);

      } else {
        // 文字列項目（品名・単位・備考）
        row[key] = value;
      }

      newRows[idx] = row;
      return newRows;
    });
  }

  // --- 明細行追加 ---
  function addRow() {
    setRows([
      ...rows,
      { hinmoku: "", suryo: null, tanni: "", tannka: null, kingaku: null, bikou: "" },
    ]);
  }

  // --- 明細行削除 ---
  function removeRow(idx: number) {
    const newRows = rows.filter((_, i) => i !== idx);
    setRows(newRows);
  }

  // --- 集計計算 ---
  function calcSummary(rows: DetailRow[], zeiritsu: number | null, zei_type: number | null) {
    const subtotal = rows.reduce((sum, r) => {
      if (r.kingaku != null) return sum + r.kingaku;
      if (r.suryo != null && r.tannka != null) return sum + r.suryo * r.tannka;
      return sum;
    }, 0);

    if (zei_type === 1) {
      // なし（非課税）
      return { subtotal: null, tax: null, total: subtotal };
    }

    // 外税
    const tax = zeiritsu != null ? Math.floor(subtotal * (zeiritsu / 100)) : 0;
    const total = subtotal + tax;

    return { subtotal, tax, total };
  }

  // --- 保存処理 ---
  async function save() {

    if (isNew && (!h.tantou || h.tantou === "")) {
      alert("作成者を選択してください。");
      return;
    }

    // 表示用の集計（保存には使わない）
    const summary = calcSummary(rows, h.zeiritsu ?? 0, h.zei_type ?? 0);
    const subtotal = summary.subtotal ?? 0;
    const tax = summary.tax ?? 0;
    const total = summary.total ?? 0;

    const payload = {
      header: {
        ...h,
        goukei: subtotal,
        sotozeigaku: tax,
        goukei_kingaku: total,
        zeiritsu: h.zeiritsu ?? 0,   // null を許さない
      },
      items: rows,  // input の kingaku をそのまま保存
    };

    let mitsumoriNo = h.mitsumori_no;

    if (isNew) {
      const res = await fetch("http://localhost:3001/api/mitsumori/create", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      mitsumoriNo = data.mitsumori_no;
    } else {
      await fetch(
        `http://localhost:3001/api/mitsumori/update/${h.mitsumori_no}`,
        {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log("payload", payload);

    onSaved(mitsumoriNo);
  }

  const { subtotal, tax, total } = calcSummary(rows, h.zeiritsu ?? 0, h.zei_type ?? 1);

  return (
    <div style={{ padding: 20 }}>
      <h1>
        {isNew ? "見積書 新規作成" : `見積書 編集`}
      </h1>

      <div style={{ marginBottom: 10 }}>
        <button onClick={save} style={{ marginRight: 10 }}>
          保存
        </button>
        <button
          onClick={() => {
            if (hasChanges()) {
              if (!window.confirm("編集内容が失われます。よろしいですか？")) {
                return;
              }
            }
            onCancel();
          }}
        >
          キャンセル
        </button>

      </div>

      {/* --- ヘッダー入力 --- */}
      <table className="detail-header-table">
        <tbody>
          <tr>
            <th>No.</th>
            <td>
              {h.mitsumori_no}
            </td>
          </tr>
          <tr>
            <th>作成日</th>
            <td>
              <input
                type="date"
                value={h.sakusei ?? ""}
                onChange={(e) =>
                  setH({ ...h, sakusei: e.target.value })
                }
              />
            </td>
          </tr>

          <tr>
            <th>作成者</th>
            <td>
              {isNew ? (
                // 新規作成 → プルダウン
                <select
                  value={h.tantou ?? ""}
                  onChange={(e) => setH({ ...h, tantou: e.target.value })}
                >
                  <option value="">（選択してください）</option>
                  {shainList.map((s) => (
                    <option key={s.shain_cd} value={s.shain_cd}>
                      {s.shain_cd}：{s.name}
                    </option>
                  ))}
                </select>
              ) : (
                // 編集 → テキスト表示（変更不可）
                <span>
                  {displayTantou(h.tantou, h.tantou_name)}
                </span>
              )}
            </td>
          </tr>

          <tr>
            <th>見積先</th>
            <td>
              <input
                className="tokuisaki-input"
                type="text"
                value={h.mitsumorisaki_meisho ?? ""}
                onChange={(e) =>
                  setH({ ...h, mitsumorisaki_meisho: e.target.value })
                }
              />
            </td>
          </tr>

          <tr>
            <th>敬称</th>
            <td>
              <input
                className="keisho-input"
                type="text"
                value={h.keisho ?? "様"}
                onChange={(e) => setH({ ...h, keisho: e.target.value })}
                placeholder="様、御中など"
              />
            </td>
          </tr>

          <tr>
            <th>取引条件</th>
            <td>
              <input
                type="text"
                value={h.torihiki_jouken ?? ""}
                onChange={(e) =>
                  setH({ ...h, torihiki_jouken: e.target.value })
                }
              />
            </td>
          </tr>

          <tr>
            <th>有効期限</th>
            <td>
              <input
                type="text"
                value={h.yukou_kigen ?? ""}
                onChange={(e) =>
                  setH({ ...h, yukou_kigen: e.target.value })
                }
              />
            </td>
          </tr>

          <tr>
            <th>受渡期日</th>
            <td>
              <input
                type="text"
                value={h.ukewatashi_kijitu ?? ""}
                onChange={(e) =>
                  setH({ ...h, ukewatashi_kijitu: e.target.value })
                }
              />
            </td>
          </tr>

          <tr>
            <th>受渡場所</th>
            <td>
              <input
                type="text"
                value={h.ukewatashi_basho ?? ""}
                onChange={(e) =>
                  setH({ ...h, ukewatashi_basho: e.target.value })
                }
              />
            </td>
          </tr>
          <tr>
            <th>消費税</th>
            <td>
              <label>
                <input
                  type="radio"
                  name="zei_type"
                  checked={h.zei_type === 0}
                  onChange={() => setH({ ...h, zei_type: 0 })}
                />
                外税（税別）
              </label>

              <label style={{ marginLeft: 20 }}>
                <input
                  type="radio"
                  name="zei_type"
                  checked={h.zei_type === 1}
                  onChange={() => setH({ ...h, zei_type: 1 })}
                />
                なし（非課税）
              </label>
            </td>
          </tr>
        </tbody>
      </table>

      {/* --- 明細テーブル --- */}
      <table className="detail-table">
        <thead>
          <tr>
            <th>品目</th>
            <th>数量</th>
            <th>単位</th>
            <th>単価</th>
            <th>金額</th>
            <th>備考</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx}>
              <td>
                <input
                  value={r.hinmoku}
                  onChange={(e) =>
                    updateRow(idx, "hinmoku", e.target.value)
                  }
                />
              </td>

              <td>
                <input
                  type="number"
                  className="right"
                  value={r.suryo ?? ""}
                  onChange={(e) => updateRow(idx, "suryo", e.target.value)}
                />
              </td>

              <td>
                <input
                  className="center"
                  value={r.tanni}
                  onChange={(e) =>
                    updateRow(idx, "tanni", e.target.value)
                  }
                />
              </td>

              <td>
                <input
                  type="number"
                  className="right"
                  value={r.tannka ?? ""}
                  onChange={(e) => updateRow(idx, "tannka", e.target.value)}
                />
              </td>

              <td>
                <input
                  type="number"
                  className="right"
                  value={r.kingaku ?? ""}
                  onChange={(e) => updateRow(idx, "kingaku", e.target.value)}
                />
              </td>

              <td>
                <input
                  value={r.bikou || ""}
                  onChange={(e) =>
                    updateRow(idx, "bikou", e.target.value)
                  }
                />
              </td>

              <td>
                <button onClick={() => removeRow(idx)}>削除</button>
              </td>
            </tr>
          ))}

          {h.zei_type === 0 && (
            <>
              <tr>
                <td className="no-border"></td>
                <td colSpan={3} className="summary-label">小計</td>
                <td className="text-right">
                  {subtotal != null ? subtotal.toLocaleString() : ""}
                </td>
                <td className="no-border"></td>
              </tr>

              <tr>
                <td className="no-border"></td>
                <td colSpan={3} className="summary-label">
                  {h.zeiritsu == null ? "消費税" : `消費税（${h.zeiritsu}％）`}
                </td>
                <td className="text-right">
                  {tax != null ? tax.toLocaleString() : ""}
                </td>
                <td className="no-border"></td>
              </tr>
            </>
          )}

          <tr>
            <td className="no-border"></td>
            <td colSpan={3} className="summary-label">合計</td>
            <td className="text-right">{total.toLocaleString()}</td>
            <td className="no-border"></td>
          </tr>

        </tbody>
      </table>

      <button onClick={addRow} style={{ marginTop: 10 }}>
        ＋ 行追加
      </button>
    </div>
  );
}
