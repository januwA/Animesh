use std::path::Path;

use anyhow::{Context, Result};

use crate::parser::TauriCommand;

pub fn generate_typescript_registry(commands: &[TauriCommand], output_path: &Path) -> Result<()> {
    let mut content = String::from("// 自动生成的 Tauri Command 注册表\n");
    content.push_str("// 请勿手动编辑，运行 `cargo run -p xtask -- generate` 重新生成\n\n");

    content.push_str("export const commands = {\n");
    for cmd in commands {
        content.push_str(&format!("  {}: \"{}\",\n", cmd.name, cmd.name));
    }
    content.push_str("} as const;\n");

    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create directory: {}", parent.display()))?;
    }

    std::fs::write(output_path, &content)
        .with_context(|| format!("Failed to write file: {}", output_path.display()))?;

    Ok(())
}
