import { useState } from "react";

interface Header {
  mitsumori_no: number;
  sakusei: string | null;
  mitsumorisaki_meisho: string | null;
  keisho: string | null;
  
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
  bikou: string;
}

export default function EditForm({
  header,
  items,
  onCancel,
  onSaved,
}: {
  header: Header;
  items: DetailRow[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [h, setH] = useState(header);
  const [rows, setRows] = useState(items);

  // --- 明細の金額計算 ---
  function calcKingaku(r: DetailRow) {
    if (r.suryo == null || r.tannka == null) return null;
    return r.suryo * r.tannka;
  }

  // --- 明細行の変更 ---
  function updateRow(idx: number, key: keyof DetailRow, value: any) {
    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], [key]: value };
    setRows(newRows);
  }

  // --- 明細行追加 ---
  function addRow() {
    setRows([
      ...rows,
      { hinmoku: "", suryo: null, tanni: "", tannka: null, bikou: "" },
    ]);
  }

  // --- 明細行削除 ---
  function removeRow(idx: number) {
    const newRows = rows.filter((_, i) => i !== idx);
    setRows(newRows);
  }

  // --- 保存処理 ---
  async function save() {
    const payload = {
      header: h,
      items: rows.map((r) => ({
        ...r,
        kingaku: calcKingaku(r),
      })),
    };

    if (h.mitsumori_no === 0) {
      // 新規作成
      await fetch("http://localhost:3001/api/mitsumori/create", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
    } else {
      // 更新
      await fetch(
        `http://localhost:3001/api/mitsumori/update/${h.mitsumori_no}`,
        {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    onSaved();
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>
        {h.mitsumori_no === 0 ? "見積書 新規作成" : `見積書 編集（No: ${h.mitsumori_no}）`}
      </h2>

      {/* --- ヘッダー入力 --- */}
      <table className="detail-header-table">
        <tbody>
          <tr>
            <th>発行日付</th>
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
            <th>見積先</th>
            <td>
              <input
                type="text"
                value={h.mitsumorisaki_meisho ?? ""}
                onChange={(e) =>
                  setH({ ...h, mitsumorisaki_meisho: e.target.value })
                }
                style={{ width: "200px" }}
              />
              <input
                type="text"
                value={h.keisho ?? ""}
                onChange={(e) => setH({ ...h, keisho: e.target.value })}
                style={{ width: "80px", marginLeft: 10 }}
                placeholder="御中"
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
                style={{ width: "300px" }}
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
                style={{ width: "300px" }}
              />
            </td>
          </tr>
        </tbody>
      </table>

      <h3 style={{ marginTop: 20 }}>明細</h3>

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
                  value={r.suryo ?? ""}
                  onChange={(e) =>
                    updateRow(idx, "suryo", Number(e.target.value))
                  }
                  style={{ textAlign: "right" }}
                />
              </td>

              <td>
                <input
                  value={r.tanni}
                  onChange={(e) =>
                    updateRow(idx, "tanni", e.target.value)
                  }
                  style={{ textAlign: "center" }}
                />
              </td>

              <td>
                <input
                  type="number"
                  value={r.tannka ?? ""}
                  onChange={(e) =>
                    updateRow(idx, "tannka", Number(e.target.value))
                  }
                  style={{ textAlign: "right" }}
                />
              </td>

              <td style={{ textAlign: "right" }}>
                {calcKingaku(r)?.toLocaleString() ?? ""}
              </td>

              <td>
                <input
                  value={r.bikou}
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
        </tbody>
      </table>

      <button onClick={addRow} style={{ marginTop: 10 }}>
        ＋ 行追加
      </button>

      <div style={{ marginTop: 20 }}>
        <button onClick={save} style={{ marginRight: 10 }}>
          保存
        </button>
        <button onClick={onCancel}>キャンセル</button>
      </div>
    </div>
  );
}
