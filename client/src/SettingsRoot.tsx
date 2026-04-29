import "./App.css";

export default function SettingsRoot({
    onSelect,
    onBack,
}: {
    onSelect: (page: "root" | "company" | "shain") => void;
    onBack: () => void;
}) {
    return (
        <div style={{ padding: 20 }}>
            <h1>設定</h1>

            <button onClick={onBack} style={{ marginBottom: 20 }}>
                戻る
            </button>

            <button onClick={() => onSelect("company")} style={{ display: "block", width: "400px", marginTop: 20 }}>
                見積書設定
            </button>

            <button onClick={() => onSelect("shain")} style={{ display: "block", width: "400px", marginTop: 20 }}>
                社員設定
            </button>
        </div>
    );
}
