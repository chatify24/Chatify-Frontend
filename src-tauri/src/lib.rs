#[cfg(desktop)]
use tauri::Manager;

#[cfg(desktop)]
use tauri_plugin_single_instance;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(
        tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        })
    );

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_deep_link::init())
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
                            }
                            Ok(None) => println!("✅ No update - already latest"),
                            Err(e) => println!("❌ Updater error: {:?}", e),
                        }
                    }
                    Err(e) => println!("❌ Updater init error: {:?}", e),
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}