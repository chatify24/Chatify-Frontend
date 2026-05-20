#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // 👇 YE ADD KAR
      let handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        match tauri_plugin_updater::UpdaterExt::updater(&handle) {
         Ok(updater) => {
  let check_result = updater.check().await;
  match check_result {
    Ok(Some(u)) => {
      println!("✅ Update available!");
      println!("📦 New version: {}", u.version);
      println!("📦 Current version: {}", u.current_version);
    },
    Ok(None) => println!("✅ No update - already latest"),
    Err(e) => println!("❌ Updater error: {:?}", e),
  }
},
          Err(e) => println!("❌ Updater init error: {:?}", e),
        }
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}