use std::path::Path;

use crate::parser::{RegisteredCommand, TauriCommand};

#[derive(Debug)]
pub struct CheckResult {
    pub defined_not_registered: Vec<TauriCommand>,
    pub registered_not_defined: Vec<RegisteredCommand>,
    pub async_violations: Vec<TauriCommand>,
}

pub fn check_commands(defined: &[TauriCommand], registered: &[RegisteredCommand]) -> CheckResult {
    let defined_names: Vec<&str> = defined.iter().map(|c| c.name.as_str()).collect();
    let registered_names: Vec<&str> = registered.iter().map(|c| c.name.as_str()).collect();

    let defined_not_registered: Vec<TauriCommand> = defined
        .iter()
        .filter(|cmd| !registered_names.contains(&cmd.name.as_str()))
        .cloned()
        .collect();

    let registered_not_defined: Vec<RegisteredCommand> = registered
        .iter()
        .filter(|cmd| !defined_names.contains(&cmd.name.as_str()))
        .cloned()
        .collect();

    let async_violations: Vec<TauriCommand> = defined
        .iter()
        .filter(|cmd| !cmd.is_async)
        .cloned()
        .collect();

    CheckResult {
        defined_not_registered,
        registered_not_defined,
        async_violations,
    }
}

pub fn print_check_result(result: &CheckResult, base_path: &Path) -> bool {
    let mut has_errors = false;

    if !result.defined_not_registered.is_empty() {
        has_errors = true;
        eprintln!("\n错误: 已定义但未注册的 Tauri Command:");
        for cmd in &result.defined_not_registered {
            let relative = cmd.file.strip_prefix(base_path).unwrap_or(&cmd.file);
            eprintln!("  {} ({}:{})", cmd.name, relative.display(), cmd.line);
        }
    }

    if !result.registered_not_defined.is_empty() {
        has_errors = true;
        eprintln!("\n错误: 已注册但未定义的 Tauri Command:");
        for cmd in &result.registered_not_defined {
            let relative = cmd.file.strip_prefix(base_path).unwrap_or(&cmd.file);
            eprintln!("  {} ({}:{})", cmd.name, relative.display(), cmd.line);
        }
    }

    if !result.async_violations.is_empty() {
        has_errors = true;
        eprintln!("\n错误: Tauri Command 必须是 async fn:");
        for cmd in &result.async_violations {
            let relative = cmd.file.strip_prefix(base_path).unwrap_or(&cmd.file);
            eprintln!("  {} ({}:{})", cmd.name, relative.display(), cmd.line);
        }
    }

    has_errors
}
