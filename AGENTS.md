- 使用TDD开发模式
- 优先使用shadcn组件库,能用组件库就不要编写自定义样式
- 不要使用大量的Emoji符号
- 处理外部获取的数据（如网络 API 响应、本地文件或 Tauri 后端返回的 JSON 对象等）：
  - 严禁使用 `any`，应将返回值声明为 `unknown`。
  - 在 `domain` 层定义对应的 Zod Schema 进行运行时验证（如 `safeParse`），确保数据完整性并消除类型安全隐患。

