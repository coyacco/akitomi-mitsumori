// =======================
// Tauri 起動
// =======================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("mobile_entry_point called");

    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

