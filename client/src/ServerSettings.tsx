import { useState, useEffect } from "react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { appConfigDir, join } from "@tauri-apps/api/path";

export default function ServerSettings({ onSaved }: { onSaved: () => void }) {
  const [ip, setIp] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const dir = await appConfigDir();
      const path = await join(dir, "server-config.json");

      try {
        const text = await readTextFile(path);
        const json = JSON.parse(text);

        if (json.server) {
          // "http://192.168.11.20:3001" → "192.168.11.20"
          const m = json.server.match(/^http:\/\/(.+):3001$/);
          if (m) setIp(m[1]);
        }
      } catch {
        setIp("");
      }
    }
    load();
  }, []);

  async function save() {
    if (!ip.trim()) {
      setError("IP アドレスを入力してください");
      return;
    }

    const serverUrl = `http://${ip.trim()}:3001`;

    try {
      const dir = await appConfigDir();
      const path = await join(dir, "server-config.json");

      await writeTextFile(
        path,
        JSON.stringify({ server: serverUrl }, null, 2)
      );

      onSaved();
    } catch (e) {
      setError("設定の保存に失敗しました");
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>サーバー設定</h1>

      {error && (
        <div style={{ color: "red", marginBottom: 10 }}>{error}</div>
      )}

      <label>サーバー IP アドレス（例: 192.168.11.20）</label>
      <input
        type="text"
        value={ip}
        onChange={(e) => setIp(e.target.value)}
        style={{ width: "100%", padding: 8, marginTop: 8 }}
      />

      <div style={{ marginTop: 10, color: "#555" }}>
        接続先：<b>http://{ip || "___" }:3001</b>
      </div>

      <button onClick={save} style={{ marginTop: 20 }}>
        保存
      </button>
    </div>
  );
}
