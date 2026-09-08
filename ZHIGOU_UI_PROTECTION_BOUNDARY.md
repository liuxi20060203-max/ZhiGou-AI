# 知构 AI UI 结构重构保护边界

## 1. 目的

本文档定义知构 AI 页面结构重构期间必须保持稳定的产品能力、技术契约和验证要求。

本轮允许重组页面、移动组件、改变视觉层级和新增 `/create` 页面，但不借 UI 重构修改课程生成、课程存储、课堂运行、Workspace 或导入导出协议。页面截图是视觉基线；本文档和自动化测试是行为基线。

## 2. 当前改造范围

本轮目标页面：

- `/`：课程空间首页；
- `/create`：独立课程创建页，与首页复用创建状态和提交链路；
- `/generation-preview`：课程计划与生成进度；
- `/classroom/[id]`：AI 互动课堂外围结构。

冻结范围：

- `/workspace` 和 `/workbench/new`；
- `components/workbench/**`；
- Agent、generation、orchestration、playback、action、DSL 和数据库协议；
- 完整登录、权限、班级、成绩、学习画像和 LMS。

## 3. 改动分区

### 绿色区：可直接修改

只要保持本文件第 4 节的行为契约，以下内容可按设计方案调整：

- 页面布局与组件组合；
- Tailwind 类名和页面专用 CSS；
- 品牌资源和用户可见文案；
- Header、卡片、空状态、Loading、错误状态；
- 响应式布局和浅色/深色主题；
- 为自动化测试增加稳定的 `data-testid`；
- 将页面内部 UI 拆分到 `components/home/**`、`components/course-create/**`、`components/course-plan/**` 和 `components/classroom/**`。

### 黄色区：修改前必须定位调用方，修改后必须跑对应回归

- `app/page.tsx` 中课程创建表单和 `handleGenerate` 的接线；
- `app/generation-preview/page.tsx` 的 session 恢复、生成阶段和跳转；
- `components/generation/outlines-editor.tsx` 的确认、编辑、排序和继续生成行为；
- `components/classroom/ClassroomSurface.tsx` 的课堂区域组合；
- `components/header.tsx`、`components/stage/scene-sidebar.tsx` 和 Canvas 控件的事件接线；
- 首页课程库对 `lib/utils/stage-storage.ts` 的调用；
- 材料上传、导入和草稿恢复 Hook 的调用位置。

黄色区允许“搬迁调用”，不允许在页面组件内复制一套新的持久化或生成实现。

### 红色区：本轮禁止修改

除非用户明确扩大任务范围并单独评审，否则不得修改：

- `packages/@openmaic/**`；
- `packages/generation/**`；
- `app/api/**`；
- `lib/persistence/**`；
- `lib/document-store/**`；
- `lib/playback/**`；
- `lib/store/**` 中的数据模型、持久化协议和状态语义；
- `lib/utils/stage-storage.ts` 的读写语义；
- `lib/import/use-import-classroom.ts` 和 `lib/import/use-import-pptx.ts` 的导入协议；
- `@openmaic/*` 包名、请求头、Cookie、Schema、数据库和导出格式名称；
- `openmaic:*`、`maic:*` 及其他已经发布使用的存储键。

如果红色区现有测试失败，应先判断是否为 UI 接线问题，不通过修改红色区绕过失败。

## 4. 必须保持的产品行为契约

### 4.1 首页与创建课程

- 首页可以加载已有课程和文件夹；
- 用户可以搜索、打开、重命名、移动和删除课程；
- 用户可以导入现有课堂；
- 课程主题为空时不能提交；
- 配置了可用模型且课程主题非空时可以提交；
- 材料、联网搜索、互动模式和语音输入仍进入同一份创建请求；
- 提交期间材料集合被锁定，不能重复提交；
- 提交成功后进入 `/generation-preview`；
- 页面重构后草稿仍可恢复；
- 新增 `/create` 后，首页和创建页必须复用同一套创建状态与提交入口，不能复制生成流程。

稳定自动化锚点：

| 能力 | `data-testid` |
|---|---|
| 首页品牌 | `home-brand-logo` |
| 课程需求输入 | `course-requirement-input` |
| 生成课程提交 | `course-generate-submit` |

布局、元素标签和显示文案可以改变，这三个测试 ID 不随视觉重构更名。

### 4.2 生成与课程计划

- `/generation-preview` 从 `sessionStorage.generationSession` 恢复当前任务；
- 没有 generation session 时显示可恢复的错误状态，而不是崩溃；
- 文档提取、联网搜索、大纲、角色、场景和语音生成顺序保持现有语义；
- 用户可以在审阅机会出现时打开课程大纲；
- 用户可以确认大纲并继续生成；
- “以后总生成前审阅大纲”的设置继续持久化；
- 刷新处于大纲审阅状态的页面可以恢复；
- 成功完成后进入 `/classroom/[stageId]`；
- 取消或返回时按现有规则清理 generation session。

允许把“Outline/Scene”改成“课程计划/教学环节”，但不能更改底层类型和值。

### 4.3 课堂

- `/classroom/[id]` 可以加载既有 Stage；
- 当前场景和场景总数正确；
- 点击教学环节可以切换当前场景；
- Slide、Quiz、Interactive、PBL 和 Whiteboard 仍由现有渲染器处理；
- 播放、暂停、上一环节、下一环节、编辑、分享和导出仍调用原有动作；
- 重组 Header、侧栏、舞台、助手区和底部控制时，不创建第二套课堂状态；
- 折叠、调整宽度、全屏和编辑模式的状态不因纯视觉重构改变；
- 返回行为继续通过现有 classroom exit 接线处理；
- 课堂内未完成的输入和播放状态不因面板隐藏而意外丢失。

课堂场景列表必须继续保留：

| 能力 | `data-testid` |
|---|---|
| 场景列表 | `scene-list` |
| 场景条目 | `scene-item` |
| 场景标题 | `scene-title` |

### 4.4 Workspace 隔离

- 本轮不改变 `/workspace` 的三栏结构、URL 参数和路由行为；
- 不改变会话、课程 Tab、面板折叠、面板宽度和本地记忆；
- 全局 Token 或共享组件修改后，必须确认 Workspace 没有明显视觉回归；
- 为首页新增的组件不得放入 `components/workbench/**`；
- 为首页或课堂创建状态时，不复用 Workspace session 作为持久化容器。

## 5. 稳定技术契约

以下值在本轮保持不变：

| 契约 | 当前值 |
|---|---|
| 生成中转路由 | `/generation-preview` |
| 课堂路由 | `/classroom/[id]` |
| Workspace 路由 | `/workspace` |
| 生成会话键 | `generationSession` |
| 课堂继续生成参数键 | `generationParams` |
| 课程需求草稿键 | `requirementDraft` |
| 设置存储键 | `maic:account:settings-storage` |
| 浏览器数据库 | `MAIC-Database` |

内部 `OpenMAIC` 名称不等于用户可见品牌，不做全仓库字符串替换。

## 6. 每个开发节点的验证门槛

完整的结构重构保护套件可通过以下命令运行：

- `pnpm run test:e2e:ui-guard -- --project=chromium`。

该命令覆盖首页提交、生成流程与恢复、课程大纲审阅、课堂加载与场景切换，以及首页到课堂的完整 Happy Path。各节点仍可按下方清单先运行较小的局部集合。

### 6.1 仅布局或样式修改

- `pnpm exec tsc --noEmit --incremental false`；
- `pnpm run check:i18n-keys`（涉及文案时）；
- `git diff --check`；
- 受影响页面的浅色、深色和响应式人工检查。

### 6.2 首页或创建页接线修改

除 6.1 外，运行：

- `pnpm exec playwright test e2e/tests/home-to-generation.spec.ts --project=chromium`；
- `pnpm exec playwright test e2e/tests/full-happy-path.spec.ts --project=chromium`。

### 6.3 课程计划或生成页修改

除 6.1 外，运行：

- `pnpm exec playwright test e2e/tests/generation-flow.spec.ts --project=chromium`；
- `pnpm exec playwright test e2e/tests/full-happy-path.spec.ts --project=chromium`。

### 6.4 课堂结构修改

除 6.1 外，至少运行：

- `pnpm exec playwright test e2e/tests/classroom-interaction.spec.ts --project=chromium`；
- `pnpm exec playwright test e2e/tests/quiz-content-surface-657.spec.ts --project=chromium`；
- `pnpm exec playwright test e2e/tests/interactive-iframe-keepalive-619.spec.ts --project=chromium`；
- `pnpm exec playwright test e2e/tests/playback-resume-cutover.spec.ts --project=chromium`；
- `pnpm exec playwright test e2e/tests/full-happy-path.spec.ts --project=chromium`。

### 6.5 共享 Token 或全局组件修改

- 检查 `/`、`/generation-preview`、`/classroom/[id]` 和 `/workspace`；
- 运行对应页面测试；
- Workspace 只验证，不顺带重构。

## 7. 人工验收矩阵

每个页面至少检查：

- 390px 浅色；
- 768px 浅色；
- 1440px 浅色；
- 1440px 深色。

关键流程至少检查：

1. 空首页创建第一门课程；
2. 有课程首页打开最近课程；
3. 输入主题并提交；
4. 上传材料并提交；
5. 打开、编辑并确认课程计划；
6. 进入课堂并切换环节；
7. 完成 Quiz；
8. 打开 Interactive；
9. 使用 Whiteboard；
10. 返回首页并重新打开课程。

## 8. 停止条件

遇到以下情况停止扩大修改范围，先定位和报告：

- 需要改变红色区才能完成视觉布局；
- 生成请求字段、路由或存储键必须变化；
- 已有课程无法重新打开；
- 页面重构导致 generation session 无法恢复；
- 课堂切换场景时丢失状态；
- Workspace 因共享样式发生功能回归；
- 相关保护测试持续失败；
- 发现来源不明或与当前任务重叠的用户改动。

## 9. 提交规则

- 在 `feature/ui-redesign` 上按节点提交；
- 不合并 `main`，不推送远程，除非用户明确要求；
- 每次提交只包含一个结构节点和相应测试调整；
- 不把视觉调整、底层修复和依赖升级混在同一提交；
- 提交前工作区中来源不明的文件保持原样；
- `ZHIGOU_PHASE_1_HANDOFF.md` 当前属于用户未跟踪文件，不在未经确认时纳入提交。
