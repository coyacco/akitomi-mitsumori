import { useEffect, useState, useRef } from "react";
import { displayTantou } from "./utils";
import { todayJST } from "./utils";
import "./App.css";

// UUID生成用の簡易関数
const generateId = () => `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
  id?: string;
  hinmoku: string;
  suryo: number | null;
  tanni: string;
  tannka: number | null;
  kingaku: number | null;
  bikou: string;
}

// 編集可能なセルのカラム定義
const EDITABLE_COLS = ["hinmoku", "suryo", "tanni", "tannka", "kingaku", "bikou"];
const NUMERIC_COLS = ["suryo", "tannka", "kingaku"];

export default function EditForm({
  header,
  items,
  shainList,
  onCancel,
  onSaved,
  isDuplicate,
}: {
  header: Header;
  items: DetailRow[];
  shainList: { shain_cd: string; name: string }[];
  onCancel: () => void;
  onSaved: (no: number) => void;
  isDuplicate?: boolean;
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
      // 既存データの編集 - IDが無ければ付与
      return items.map(item => ({
        ...item,
        id: item.id || generateId()
      }));
    }

    // 新規作成 → 30 行の空行を作る
    return Array.from({ length: 30 }, () => ({
      id: generateId(),
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

  // キーボード操作用 refs
  const cellRefsMap = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const [isComposing, setIsComposing] = useState(false);

  // ドラッグ・アンド・ドロップ用の state
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

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

  // ドキュメント全体でマウスアップを監視
  useEffect(() => {
    const handleGlobalMouseUp = (_e: MouseEvent) => {
      if (draggedRowId) {
        console.log('Global mouseUp - dragging ended');
        setDraggedRowId(null);
        setHoveredRowId(null);
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggedRowId]);

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
      { id: generateId(), hinmoku: "", suryo: null, tanni: "", tannka: null, kingaku: null, bikou: "" },
    ]);
  }

  // --- 明細行削除 ---
  function removeRow(idx: number) {
    const newRows = rows.filter((_, i) => i !== idx);
    setRows(newRows);
  }

  // --- セル ID 生成 ---
  const getCellId = (rowIdx: number, colName: string) => `cell-${rowIdx}-${colName}`;

  // --- ドラッグ・アンド・ドロップハンドラ ---
  const handleRowDragStart = (e: React.DragEvent<HTMLTableRowElement>, rowId: string) => {
    console.log('dragStart:', rowId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.currentTarget.innerHTML);
    setDraggedRowId(rowId);
  };

  const handleRowDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    console.log('dragOver');
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleRowDrop = (e: React.DragEvent<HTMLTableRowElement>, targetRowId: string) => {
    console.log('drop:', targetRowId, 'from:', draggedRowId);
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedRowId === null || draggedRowId === targetRowId) {
      setDraggedRowId(null);
      return;
    }

    setRows(prev => {
      const draggedIdx = prev.findIndex(r => r.id === draggedRowId);
      const targetIdx = prev.findIndex(r => r.id === targetRowId);
      
      console.log('draggedIdx:', draggedIdx, 'targetIdx:', targetIdx);
      
      if (draggedIdx === -1 || targetIdx === -1) {
        return prev;
      }

      const newRows = [...prev];
      const draggedRow = newRows[draggedIdx];
      
      // 1. ドラッグ行を削除
      newRows.splice(draggedIdx, 1);
      
      // 2. 削除後、ターゲットのインデックスが変わる場合がある
      let insertIdx: number;
      if (draggedIdx < targetIdx) {
        // 下に移動する場合：ターゲットが1つ上にシフト
        // ターゲットの直後に挿入するため、targetIdx - 1 + 1 = targetIdx
        insertIdx = targetIdx;
      } else {
        // 上に移動する場合：ターゲットはシフトしない
        insertIdx = targetIdx;
      }
      
      // 3. 計算した位置に挿入
      newRows.splice(insertIdx, 0, draggedRow);
      
      console.log('rows reordered - insertIdx:', insertIdx);
      return newRows;
    });

    setDraggedRowId(null);
    setHoveredRowId(null);
  };

  const handleRowDragEnd = () => {
    console.log('dragEnd');
    setDraggedRowId(null);
  };

  const handleHandleMouseDown = (e: React.MouseEvent, rowId: string) => {
    console.log('handleMouseDown:', rowId);
    setDraggedRowId(rowId);
    e.preventDefault();
  };

  const handleRowMouseUp = (_e: React.MouseEvent, targetRowId: string) => {
    console.log('rowMouseUp:', targetRowId);
    if (draggedRowId && draggedRowId !== targetRowId) {
      setRows(prev => {
        const draggedIdx = prev.findIndex(r => r.id === draggedRowId);
        const targetIdx = prev.findIndex(r => r.id === targetRowId);
        
        console.log('mouseUp reorder - draggedIdx:', draggedIdx, 'targetIdx:', targetIdx);
        
        if (draggedIdx === -1 || targetIdx === -1) {
          return prev;
        }

        const newRows = [...prev];
        const draggedRow = newRows[draggedIdx];
        
        // 1. ドラッグ行を削除
        newRows.splice(draggedIdx, 1);
        
        // 2. 削除後、ターゲットのインデックスが変わる場合がある
        let insertIdx: number;
        if (draggedIdx < targetIdx) {
          // 下に移動する場合：ターゲットが1つ上にシフト
          // ターゲットの直後に挿入するため、targetIdx - 1 + 1 = targetIdx
          insertIdx = targetIdx;
        } else {
          // 上に移動する場合：ターゲットはシフトしない
          insertIdx = targetIdx;
        }
        
        // 3. 計算した位置に挿入
        newRows.splice(insertIdx, 0, draggedRow);
        
        console.log('rows reordered by mouse - insertIdx:', insertIdx);
        return newRows;
      });
    }
    setDraggedRowId(null);
    setHoveredRowId(null);
  };

  const handleRowMouseEnter = (rowId: string) => {
    if (draggedRowId) {
      setHoveredRowId(rowId);
    }
  };

  const handleRowMouseLeave = () => {
    setHoveredRowId(null);
  };

  // --- 次の編集可能セルへ移動 ---
  const focusCell = (rowIdx: number, colIdx: number) => {
    if (rowIdx < 0 || rowIdx >= rows.length) return;

    let targetCol = EDITABLE_COLS[colIdx];
    if (!targetCol) return;

    const cellId = getCellId(rowIdx, targetCol);
    const input = cellRefsMap.current.get(cellId);
    if (input) {
      input.focus();
      input.select?.();
    }
  };

  // --- キーダウンハンドラ ---
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colName: string) => {
    if (isComposing) return; // IME変換中は無効

    const colIdx = EDITABLE_COLS.indexOf(colName);
    if (colIdx === -1) return;

    const isNumeric = NUMERIC_COLS.includes(colName);

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (rowIdx > 0) {
          focusCell(rowIdx - 1, colIdx);
        }
        break;

      case "ArrowDown":
        e.preventDefault();
        if (rowIdx < rows.length - 1) {
          focusCell(rowIdx + 1, colIdx);
        }
        break;

      case "ArrowLeft":
        e.preventDefault();
        if (colIdx > 0) {
          focusCell(rowIdx, colIdx - 1);
        }
        break;

      case "ArrowRight":
        e.preventDefault();
        if (colIdx < EDITABLE_COLS.length - 1) {
          focusCell(rowIdx, colIdx + 1);
        }
        break;

      case "Tab":
        if (e.shiftKey) {
          // Shift+Tab: 前へ
          e.preventDefault();
          if (colIdx > 0) {
            focusCell(rowIdx, colIdx - 1);
          } else if (rowIdx > 0) {
            focusCell(rowIdx - 1, EDITABLE_COLS.length - 1);
          }
        } else {
          // Tab: 次へ
          e.preventDefault();
          if (colIdx < EDITABLE_COLS.length - 1) {
            focusCell(rowIdx, colIdx + 1);
          } else if (rowIdx < rows.length - 1) {
            focusCell(rowIdx + 1, 0);
          }
        }
        break;

      case "Enter":
        e.preventDefault();
        if (isNumeric) {
          // 数値フィールド: 次行先頭へ
          if (rowIdx < rows.length - 1) {
            focusCell(rowIdx + 1, 0);
          }
        } else {
          // テキストフィールド: 次行同列へ
          if (rowIdx < rows.length - 1) {
            focusCell(rowIdx + 1, colIdx);
          }
        }
        break;

      case "Escape":
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
        break;

      default:
        break;
    }
  };

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

  // 見出しを決定
  let heading = "見積書 編集";
  if (isNew) {
    heading = isDuplicate ? "見積書 複製" : "見積書 新規作成";
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>
        {heading}
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
            <th style={{ width: 30 }}></th>
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
            <tr
              key={r.id}
              draggable
              onDragStart={(e) => handleRowDragStart(e, r.id || '')}
              onDragOver={handleRowDragOver}
              onDrop={(e) => handleRowDrop(e, r.id || '')}
              onDragEnd={handleRowDragEnd}
              onMouseEnter={() => handleRowMouseEnter(r.id || '')}
              onMouseLeave={handleRowMouseLeave}
              onMouseUp={(e) => handleRowMouseUp(e, r.id || '')}
              style={{
                opacity: draggedRowId === r.id ? 0.6 : 1,
                cursor: draggedRowId === r.id ? 'grabbing' : 'grab',
                backgroundColor: draggedRowId === r.id ? '#ffd54f' : (hoveredRowId === r.id && draggedRowId ? '#ffe082' : 'transparent'),
                transition: 'all 0.15s ease-out',
              }}
            >
              <td 
                style={{ textAlign: 'center', color: '#999', cursor: draggedRowId ? 'grabbing' : 'grab', userSelect: 'none' }}
                onMouseDown={(e) => handleHandleMouseDown(e, r.id || '')}
              >
                ☰
              </td>
              <td>
                <input
                  ref={(el) => {
                    const cellId = getCellId(idx, "hinmoku");
                    if (el) {
                      cellRefsMap.current.set(cellId, el);
                    } else {
                      cellRefsMap.current.delete(cellId);
                    }
                  }}
                  value={r.hinmoku}
                  onChange={(e) =>
                    updateRow(idx, "hinmoku", e.target.value)
                  }
                  onKeyDown={(e) => handleKeyDown(e, idx, "hinmoku")}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                />
              </td>

              <td>
                <input
                  ref={(el) => {
                    const cellId = getCellId(idx, "suryo");
                    if (el) {
                      cellRefsMap.current.set(cellId, el);
                    } else {
                      cellRefsMap.current.delete(cellId);
                    }
                  }}
                  type="number"
                  className="right"
                  value={r.suryo ?? ""}
                  onChange={(e) => updateRow(idx, "suryo", e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, idx, "suryo")}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                />
              </td>

              <td>
                <input
                  ref={(el) => {
                    const cellId = getCellId(idx, "tanni");
                    if (el) {
                      cellRefsMap.current.set(cellId, el);
                    } else {
                      cellRefsMap.current.delete(cellId);
                    }
                  }}
                  className="center"
                  value={r.tanni}
                  onChange={(e) =>
                    updateRow(idx, "tanni", e.target.value)
                  }
                  onKeyDown={(e) => handleKeyDown(e, idx, "tanni")}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                />
              </td>

              <td>
                <input
                  ref={(el) => {
                    const cellId = getCellId(idx, "tannka");
                    if (el) {
                      cellRefsMap.current.set(cellId, el);
                    } else {
                      cellRefsMap.current.delete(cellId);
                    }
                  }}
                  type="number"
                  className="right"
                  value={r.tannka ?? ""}
                  onChange={(e) => updateRow(idx, "tannka", e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, idx, "tannka")}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                />
              </td>

              <td>
                <input
                  ref={(el) => {
                    const cellId = getCellId(idx, "kingaku");
                    if (el) {
                      cellRefsMap.current.set(cellId, el);
                    } else {
                      cellRefsMap.current.delete(cellId);
                    }
                  }}
                  type="number"
                  className="right"
                  value={r.kingaku ?? ""}
                  onChange={(e) => updateRow(idx, "kingaku", e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, idx, "kingaku")}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                />
              </td>

              <td>
                <input
                  ref={(el) => {
                    const cellId = getCellId(idx, "bikou");
                    if (el) {
                      cellRefsMap.current.set(cellId, el);
                    } else {
                      cellRefsMap.current.delete(cellId);
                    }
                  }}
                  value={r.bikou || ""}
                  onChange={(e) =>
                    updateRow(idx, "bikou", e.target.value)
                  }
                  onKeyDown={(e) => handleKeyDown(e, idx, "bikou")}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
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
