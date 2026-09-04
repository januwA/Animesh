- 使用 TDD 开发模式
  - 测试代码里重复的 mock 数据使用变量或工厂函数封装，避免重复编写。
  - 添加 `v8 ignore` 前，需在提交说明或注释中简要说明原因，避免后续维护者误解为遗漏测试。
  - 避免冗余防御：同一约束若有多处实现（例如 `disabled` 属性 + `if` 守卫），只保留一个作为单一职责来源，删除冗余分支，不要为不可达逻辑写测试或 `v8 ignore`。
  - Hook 依赖链测试原则：当 useA → useB → useC → useD 形成依赖链时，测试 useA 应 mock 直接依赖（useB），只测 useA 自身逻辑（即拿到 useB 返回值后做了什么处理），不关心下层 useB/useC/useD 的内部实现。每个 hook 的单测只验证其自身的数据转换、状态管理和副作用。
  - 组件与 Hook 测试边界：组件使用 hook 时，组件测试应 mock 该 hook，只测组件的渲染逻辑和用户交互行为；hook 的内部逻辑由其自身的单测覆盖，无需在组件测试中重复验证。
    - 示例（`src/presentation/components/Layout.test.tsx` 测 `MainLayout` 时 mock `useGlobalEffects`）：
      ```tsx
      vi.mock(import("../hooks/useGlobalEffects"), () => ({
        useGlobalEffects: vi.fn(),
      }));
      ```
    - 组件依赖的子组件内部有深层 hook/DI 依赖链时，若测试不关心该子组件行为，直接 mock 子组件隔离依赖，不要为了提供 DI 而 mock 整个容器：
      ```tsx
      vi.mock(import("@/presentation/components/TranslatableText"), () => ({
        TranslatableText: vi.fn(({ text }) => <span>{text}</span>),
      }));
      ```
  - 所有自定义 React Context 应同时导出 ContextType（类型）和 Context（值），供测试通过 `<XxxContext value={mock}>` 直接注入桩数据（React 19+ 语法），无需创建 Provider 包裹层。
    - 参考实现：`src/presentation/context/TorrentStatusContext.tsx`
      ```tsx
      export interface TorrentStatusContextType {
        torrents: TorrentStatusInfo[];
        isLoading: boolean;
      }
      export const TorrentStatusContext = createContext<TorrentStatusContextType | undefined>(undefined);
      ```
    - 测试注入：`src/presentation/hooks/useGlobalEffects.test.tsx`
      ```tsx
      <DIContext value={{ setThemeUseCase: { execute } } as unknown as DIContainer}>
        {children}
      </DIContext>
      ```

- 优先使用 shadcn 组件库（`src/presentation/components/ui/`），能用组件库就不要编写自定义样式。

- 外部数据处理（网络 API 响应、本地文件、Tauri 后端返回的 JSON 对象、浏览器本地缓存等）：
  - 将返回值或未知结构数据声明为 `unknown`。
  - 前端一切 `unknown` 的结构数据都必须使用 Zod Schema 进行运行时验证（如 `safeParse`），确保数据完整性并消除类型安全隐患。
    - 参考：`src/domain/common/NonEmptyString.ts`、`src/domain/anime/AnimeSchemas.ts`、`src/presentation/hooks/useAccentTheme.ts`

- 页面路由参数（`useParams` 与 `useSearchParams`）必须使用 Zod Schema 进行验证与默认值归一化（如 `safeParse`），验证失败渲染参数错误视图；校验应放在无 hooks 的路由守卫组件中，避免在调用 hooks 之前早返回违反 Rules of Hooks。
  - 参考实现：`src/presentation/pages/Player/index.tsx`
    ```tsx
    const playerParamsSchema = z.object({
      infoHash: NonEmptyStringSchema.min(1, "缺少种子哈希参数"),
      fileId: z.preprocess(
        (value) => (typeof value === "string" && value !== "" ? Number(value) : value),
        z.number().int(),
      ),
      fileName: NonEmptyStringSchema,
    });

    export default function Player() {
      const { infoHash, fileId } = useParams();
      const [searchParams] = useSearchParams();
      const parsed = playerParamsSchema.safeParse({ infoHash, fileId, fileName: searchParams.get("fileName") ?? undefined });
      if (!parsed.success) {
        return <InvalidParamsView title="无效的视频播放参数" error={parsed.error} />;
      }
      return <PlayerView {...parsed.data} />;
    }
    ```

- 界面主题与样式规范：
  - **语义化变量**：禁止在表现层组件中使用硬编码的不透明度/色值类（例如 `border-white/5`、`bg-black/10`），应使用自适应的语义类（如 `border-border`、`bg-secondary`、`bg-muted`），确保深浅色切换时的可用性。此规则唯一例外为全局背景渐变定义（见下条），其余任何场景均不得硬编码色值。
  - **渐变背景自适应**：全局背景采用双色渐变适配，浅色底使用 `#f8fafc` 搭配微弱渐变，深色底（`.dark body`）使用 `#080a10` 搭配明亮渐变——此为唯一允许硬编码色值的位置。
  - **主题来源**：主题由 shadcn preset 驱动（当前为 `b0`：nova 风格 + neutral 中性色），`light`/`dark` 的全部色板变量定义在 `src/presentation/App.css` 的 `:root` 与 `.dark` 中，由 shadcn 上游维护，不要手动改色值。更新主题使用 `npx shadcn@latest apply b0 --only theme`；`npx shadcn@latest preset resolve --json` 可查看当前 preset。
  - **品牌色**：品牌主色（primary/accent/ring）由 `--brand-hue` 驱动，通过 `html[data-accent]` 属性切换（预设在 App.css 的 `:root[data-accent=...]`，逻辑在 `src/presentation/hooks/useAccentTheme.ts`）。改品牌色只动 `--brand-hue`，不动 preset 色板。
  - **深浅模式**：通过 `.dark` class 切换（`@custom-variant dark`）。新增颜色一律使用语义变量，禁止出现 `dark:` 硬编码色值。