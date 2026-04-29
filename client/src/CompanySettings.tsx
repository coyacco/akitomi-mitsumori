import { useEffect, useState } from "react";
import "./App.css";

type Props = {
    server: string
    onBack: () => void
}

export default function CompanySettings(props: Props) {
    const { server, onBack } = props
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // -----------------------------
    // 会社情報の読み込み
    // -----------------------------
    useEffect(() => {
        fetch(`${server}/api/mitsumori/company`)
            .then((r) => {
                if (!r.ok) throw new Error("not found");
                return r.json();
            })
            .then((json) => setData(json))
            .catch(() => setError("会社情報を取得できませんでした"));
    }, [server]);

    // -----------------------------
    // 保存処理（全項目を返す）
    // -----------------------------
    async function save() {
        try {
            const res = await fetch(`${server}/api/mitsumori/company/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data), // ← UI に出さない項目も含めて全返却
            });

            if (!res.ok) throw new Error();
        } catch {
            setError("保存に失敗しました");
        }
    }

    if (!data) return <div>Loading...</div>;

    // -----------------------------
    // UI に出す項目だけ定義
    // -----------------------------
    const visibleFields = [
        ["郵便番号", "yubin"],
        ["住所", "jusho1"],
        ["代表", "daihyou"],
        ["TEL", "tel"],
        ["FAX", "fax"],
        ["メール", "mail"],
        ["取引銀行", "ginkou"],
    ];

    return (
        <div style={{ padding: 20 }}>
            <h1>見積書設定</h1>

            {error && <div style={{ color: "red", marginBottom: 10 }}>{error}</div>}

            <button onClick={onBack} style={{ marginBottom: 20 }}>戻る</button>

            {/* 基本情報（7項目）*/}
            {visibleFields.map(([label, key]) => (
                <div key={key} style={{ marginBottom: 10 }}>
                    <label>{label}</label>
                    <input
                        value={data[key] ?? ""}
                        onChange={(e) => setData({ ...data, [key]: e.target.value })}
                        style={{ width: "100%", padding: 8 }}
                    />
                </div>
            ))}

            {/* 消費税設定（2項目） */}
            <div style={{ marginBottom: 10 }}>
                <label>消費税</label>
                <select
                    value={data.zei_type ?? 0}
                    onChange={(e) =>
                        setData({ ...data, zei_type: Number(e.target.value) })
                    }
                    style={{ padding: 8, marginLeft: 10 }}
                >
                    <option value={0}>外税</option>
                    <option value={1}>なし</option>
                </select>
            </div>

            <div style={{ marginBottom: 10 }}>
                <label>消費税率 (%)</label>
                <input
                    type="number"
                    value={data.zeiritsu ?? 10}
                    onChange={(e) =>
                        setData({ ...data, zeiritsu: Number(e.target.value) })
                    }
                    style={{ width: 100, padding: 8, marginLeft: 10 }}
                />
            </div>

            <button onClick={save} style={{ marginRight: 10 }}>
                保存
            </button>
        </div>
    );
}
