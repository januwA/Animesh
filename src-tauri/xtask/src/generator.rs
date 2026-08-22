use std::path::Path;

use anyhow::{Context, Result};

use crate::parser::TauriCommand;

pub fn generate_typescript_registry(commands: &[TauriCommand], output_path: &Path) -> Result<()> {
    let mut content = String::from("// 自动生成的 Tauri Command 注册表\n");
    content.push_str("// 请勿手动编辑，运行 `cargo run -p xtask -- generate` 重新生成\n\n");

    content.push_str("export const commands = {\n");
    for cmd in commands {
        let js_name = to_camel_case(&cmd.name);
        content.push_str(&format!("  {}: \"{}\",\n", js_name, cmd.name));
    }
    content.push_str("} as const;\n\n");

    content.push_str("export type CommandName = typeof commands[keyof typeof commands];\n");

    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create directory: {}", parent.display()))?;
    }

    std::fs::write(output_path, &content)
        .with_context(|| format!("Failed to write file: {}", output_path.display()))?;

    Ok(())
}

fn to_camel_case(snake: &str) -> String {
    let mut result = String::new();
    let mut capitalize_next = false;

    for c in snake.chars() {
        if c == '_' {
            capitalize_next = true;
        } else if capitalize_next {
            result.push(c.to_uppercase().next().unwrap());
            capitalize_next = false;
        } else {
            result.push(c);
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_camel_case() {
        assert_eq!(to_camel_case("search_torrents"), "searchTorrents");
        assert_eq!(to_camel_case("get_user"), "getUser");
        assert_eq!(to_camel_case("login"), "login");
        assert_eq!(to_camel_case("set_download_dir"), "setDownloadDir");
    }
}
