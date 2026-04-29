// utils.ts
export function displayTantou(code: string | null, name: string | null) {
  if (name) return name;
  if (!code || code === "0") return "（設定なし）";
  return code;
}

export function todayJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // JST補正
  return jst.toISOString().slice(0, 10); // yyyy-mm-dd
}
