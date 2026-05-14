import { useEffect, useState } from "react";
import "./App.css";

type Shain = {
    shain_cd: string;
    name: string;
    hide: boolean;
};

export default function ShainSettings({ server, onBack }: { server: string; onBack: () => void }) {
    const [list, setList] = useState<Shain[]>([]);
    const [error, setError] = useState<string | null>(null);

    // 初期読み込み
    useEffect(() => {
        fetch(`${server}/api/shain?all=1`)
            .then(r => r.json())
            .then(setList)
            .catch(() => setError("社員一覧を取得できませんでした"));
    }, [server]);

    // 新規作成で選択できるかどうかを切替
    async function toggleVisible(code: string, visible: boolean) {
        setList(prev =>
            prev.map(s =>
                s.shain_cd === code ? { ...s, hide: !visible } : s
            )
        );

        // DB 更新
        await fetch(`${server}/api/shain/visible`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                shain_cd: code,
                hide: !visible,   // DB は hide=1/0
            }),
        });
    }

    // 社員追加
    async function addShain() {
        const name = prompt("社員名を入力してください");
        if (!name) return;

        // サーバに新規登録を依頼（shain_cd は空文字）
        await fetch(`${server}/api/shain/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                shain_cd: "",   // 空文字 → サーバで採番
                name,
                hide: false,
            }),
        });

        // 再読み込み（または fetch し直す）
        // window.location.reload();
    }

    return (
        <div style={{ padding: 20 }}>
            <h1>社員設定</h1>

            {error && <div style={{ color: "red" }}>{error}</div>}

            <button onClick={onBack}>戻る</button>

            <button onClick={addShain} style={{ marginBottom: 10 }}>
                ＋ 社員追加
            </button>

            <table className="list-table">
                <thead>
                    <tr>
                        <th>コード</th>
                        <th>名前</th>
                        <th>作成</th>
                    </tr>
                </thead>

                <tbody>
                    {list.map((s: Shain) => (
                        <tr key={s.shain_cd}>
                            <td>{s.shain_cd}</td>

                            <td>
                                {s.name}
                            </td>

                            <td>
                                <input
                                    type="checkbox"
                                    checked={!s.hide}
                                    onChange={(e) => toggleVisible(s.shain_cd, e.target.checked)}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
