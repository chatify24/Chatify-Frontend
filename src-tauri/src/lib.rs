use tauri::Manager;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default();

  #[cfg(mobile)]
  let builder = builder.plugin(tauri_plugin_fcm::init());

  builder
    .plugin(tauri_plugin_opener::init())  
    .plugin(tauri_plugin_notification::init())  
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_os::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

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
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();

        let app_handle = window.app_handle().clone();

        tauri::async_runtime::spawn(async move {
          // Agar koi cleanup chahiye (socket disconnect etc) yahan daal
          tokio::time::sleep(std::time::Duration::from_millis(300)).await;
          app_handle.exit(0);
        });
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}