import { readTextFile } from "@tauri-apps/plugin-fs";
import { appConfigDir, join } from "@tauri-apps/api/path";

export async function loadServerAddress() {
  // vite ではローカルファイルが読めないので、開発中は固定値を返す
  // return "http://localhost:3001";
  const dir = await appConfigDir();
  const path = await join(dir, "server-config.json");

  try {
    const text = await readTextFile(path);
    const json = JSON.parse(text);

    // 空文字・null・undefined を弾く
    if (!json.server || json.server.trim() === "") {
      return null;
    }

    return json.server.trim();
  } catch {
    return null;
  }
}
