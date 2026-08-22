mod checker;
mod generator;
mod parser;

use std::path::{Path, PathBuf};

use anyhow::{bail, Result};

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let command = args.get(1).map(|s| s.as_str());

    let workspace_root = get_workspace_root();

    match command {
        Some("check") => check(&workspace_root),
        Some("generate") => generate(&workspace_root),
        Some("fmt") => fmt(&workspace_root),
        Some(cmd) => {
            bail!("未知命令: {cmd}\n\n可用命令:\n  check      检查 Tauri Command 一致性\n  generate   生成 TypeScript Command Registry\n  fmt        格式化 TOML 文件");
        }
        None => {
            eprintln!("用法: cargo run -p xtask -- <命令>\n\n命令:\n  check      检查 Tauri Command 一致性\n  generate   生成 TypeScript Command Registry\n  fmt        格式化 TOML 文件");
            Ok(())
        }
    }
}

fn get_workspace_root() -> PathBuf {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    manifest_dir.parent().unwrap().to_path_buf()
}

fn check(workspace_root: &Path) -> Result<()> {
    let src_dir = workspace_root.join("src");
    let lib_rs = src_dir.join("lib.rs");

    println!("扫描 Tauri Command 定义...");

    let defined = parser::scan_directory(&src_dir)?;
    println!("  找到 {} 个 #[tauri::command]", defined.len());

    println!("解析 generate_handler!...");

    let registered = parser::parse_generate_handler(&lib_rs)?;
    println!("  找到 {} 个注册的 command", registered.len());

    println!("检查一致性...");

    let result = checker::check_commands(&defined, &registered);
    let has_errors = checker::print_check_result(&result, workspace_root);

    if has_errors {
        bail!("Tauri Command 检查失败");
    }

    Ok(())
}

fn generate(workspace_root: &Path) -> Result<()> {
    let src_dir = workspace_root.join("src");
    let output_path = workspace_root
        .parent()
        .unwrap()
        .join("src")
        .join("generated")
        .join("tauri-commands.ts");

    println!("扫描 Tauri Command 定义...");

    let defined = parser::scan_directory(&src_dir)?;
    println!("  找到 {} 个 #[tauri::command]", defined.len());

    println!("生成 TypeScript Registry...");

    generator::generate_typescript_registry(&defined, &output_path)?;

    println!("已生成: {}", output_path.display());

    Ok(())
}

fn fmt(workspace_root: &Path) -> Result<()> {
    println!("格式化 TOML 文件...");

    let toml_files: Vec<PathBuf> = [
        "Cargo.toml",
        "core/Cargo.toml",
        "server/Cargo.toml",
        "xtask/Cargo.toml",
    ]
    .iter()
    .map(|f| workspace_root.join(f))
    .filter(|f| f.exists())
    .collect();

    if toml_files.is_empty() {
        println!("未找到 TOML 文件");
        return Ok(());
    }

    for file in &toml_files {
        println!("  {}", file.display());
    }

    let status = std::process::Command::new("taplo")
        .arg("fmt")
        .args(toml_files.iter().map(|f| f.to_str().unwrap()))
        .status();

    match status {
        Ok(s) if s.success() => {
            println!("格式化完成");
            Ok(())
        }
        Ok(s) => {
            bail!("taplo 执行失败，退出码: {}", s.code().unwrap_or(-1));
        }
        Err(_) => {
            println!("taplo 未安装，跳过格式化");
            println!("安装方法: cargo install taplo-cli");
            Ok(())
        }
    }
}
