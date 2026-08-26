use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use syn::{Attribute, File, Item, ItemFn};

#[derive(Debug, Clone)]
pub struct TauriCommand {
    pub name: String,
    pub is_async: bool,
    pub file: PathBuf,
    pub line: usize,
}

#[derive(Debug, Clone)]
pub struct RegisteredCommand {
    pub name: String,
    pub file: PathBuf,
    pub line: usize,
}

pub fn parse_file_commands(path: &Path) -> Result<Vec<TauriCommand>> {
    let source = std::fs::read_to_string(path)
        .with_context(|| format!("Failed to read file: {}", path.display()))?;

    let file: File = syn::parse_file(&source)
        .with_context(|| format!("Failed to parse file: {}", path.display()))?;

    let mut commands = Vec::new();
    let lines: Vec<&str> = source.lines().collect();

    for item in &file.items {
        if let Item::Fn(func) = item {
            if is_tauri_command(&func.attrs) {
                let line = get_line_number(&lines, func);
                commands.push(TauriCommand {
                    name: func.sig.ident.to_string(),
                    is_async: func.sig.asyncness.is_some(),
                    file: path.to_path_buf(),
                    line,
                });
            }
        }
    }

    Ok(commands)
}

fn is_tauri_command(attrs: &[Attribute]) -> bool {
    attrs.iter().any(|attr| {
        attr.path()
            .segments
            .last()
            .is_some_and(|seg| seg.ident == "command")
    })
}

fn get_line_number(lines: &[&str], func: &ItemFn) -> usize {
    let fn_name = func.sig.ident.to_string();
    for (i, line) in lines.iter().enumerate() {
        if line.contains(&format!("fn {fn_name}")) || line.contains(&format!("fn {fn_name}")) {
            return i + 1;
        }
    }
    0
}

pub fn scan_directory(root: &Path) -> Result<Vec<TauriCommand>> {
    let mut commands = Vec::new();

    for entry in walkdir::WalkDir::new(root)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();
        if path.extension().is_some_and(|ext| ext == "rs") {
            let file_commands = parse_file_commands(path)?;
            commands.extend(file_commands);
        }
    }

    Ok(commands)
}

pub fn parse_generate_handler(path: &Path) -> Result<Vec<RegisteredCommand>> {
    let source = std::fs::read_to_string(path)
        .with_context(|| format!("Failed to read file: {}", path.display()))?;

    let mut registered = Vec::new();
    let lines: Vec<&str> = source.lines().collect();

    let mut in_generate_handler = false;
    let mut depth = 0;

    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();

        if trimmed.contains("generate_handler!") {
            in_generate_handler = true;
            depth = 0;
        }

        if in_generate_handler {
            depth += trimmed.matches('[').count();
            depth -= trimmed.matches(']').count();

            if depth > 0 || trimmed.contains('[') {
                let content = if trimmed.contains('[') {
                    trimmed.split('[').nth(1).unwrap_or("")
                } else {
                    trimmed
                };

                for item in content.split(',') {
                    let item = item.trim().trim_end_matches(']').trim();
                    if !item.is_empty() && item.chars().all(|c| c.is_alphanumeric() || c == '_') {
                        registered.push(RegisteredCommand {
                            name: item.to_string(),
                            file: path.to_path_buf(),
                            line: i + 1,
                        });
                    }
                }
            }

            if depth <= 0 && (trimmed.contains(']') || trimmed.contains("]")) {
                in_generate_handler = false;
            }
        }
    }

    Ok(registered)
}
