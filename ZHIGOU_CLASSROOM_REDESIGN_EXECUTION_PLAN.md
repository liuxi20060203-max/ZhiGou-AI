# 知构 AI 课堂页面风格改造执行方案

## 1. 文档目的

本文档用于指导 `/classroom/[id]` 的课堂页面改造，使课堂从 OpenMAIC 风格的“课件播放与对话工具”转变为知构 AI 的“知识构建现场”。

方案覆盖产品定位、页面结构、视觉规范、组件改造、交互状态、响应式适配、开发阶段、验收标准和回归测试。开发可以依据第 10 节直接拆分任务和排期。

本方案只重构课堂外围结构与表现层，不修改课程生成、课堂状态、场景渲染、播放引擎、持久化和导入导出协议。

---

## 2. 改造结论

### 2.1 新定位

课堂页面统一使用“知识构建舱”作为设计概念：

- **知识路径**回答“我在哪里”；
- **认知舞台**回答“我正在理解什么”；
- **学习控制台**回答“我下一步做什么”；
- **共思台**回答“课堂正在如何展开”；
- **知构助教**回答“我如何继续理解”。

课堂不再以缩略图、播放器工具栏和聊天面板作为主要识别特征，而以“路径—构件—理解—共思”的学习过程作为页面骨架。

### 2.2 第一眼差异目标

即使隐藏 Logo，用户仍应能通过以下特征识别知构课堂：

1. 左侧是带连接线和状态节点的知识路径，而不是 PPT 缩略图列表；
2. 中央内容位于独立的认知舞台中，而不是直接铺满工作区；
3. 当前内容被称为“知识构件”或“教学环节”；
4. AI 区域具有“知构助教”身份和教学型快捷操作；
5. 多角色讨论被组织为“共思台”，而不是通用聊天或 Roundtable；
6. 页面延续首页、创建页和生成页的青蓝色、低对比网格、眉题和圆角卡片语言。

---

## 3. 当前问题

### 3.1 已经具备的知构元素

当前课堂已经使用：

- 知构品牌 Logo；
- `#176B87` 青蓝主色及配套深色主题；
- “学习路径”“课程目录”“课程讲解”“理解检测”等教育化文案；
- 圆角、浅边框、轻阴影和半透明表面。

这些元素让课堂与首页颜色一致，但尚未改变产品骨架。

### 3.2 仍然具有 OpenMAIC 识别的部分

- 左侧仍以场景缩略图卡片为主体；
- 中央画布直接填充内容区，缺少知构特有的承载结构；
- 顶部同时陈列语言、主题、设置、编辑、导出等工具，工具属性过强；
- 固定高度 Roundtable 与右侧 ChatArea 形成典型“播放 + 聊天”布局；
- 页面信息中心是场景和工具，而不是学习进度和认知目标；
- 各区域虽然换色，但权重、比例和行为仍与原 OpenMAIC 相同。

因此，本轮必须改变页面轮廓和信息层级，不能只修改颜色、圆角或用户可见文案。

---

## 4. 范围与保护边界

### 4.1 本轮允许修改

- 课堂 Header 的布局、文案和控件分组；
- SceneSidebar 的视觉结构和场景信息呈现；
- CanvasArea 外围的舞台框架；
- 播放控件的排列和视觉层级；
- Roundtable 的外围结构、标题和默认收展方式；
- ChatArea 的品牌身份、页签名称、空状态和快捷问题；
- 课堂专属 CSS Token、浅色/深色样式和响应式布局；
- Loading、错误、生成中、课程完成等课堂状态的表现层；
- 为视觉与端到端测试增加稳定的 `data-testid`。

### 4.2 本轮禁止修改

- Slide、Quiz、Interactive、PBL、Whiteboard 渲染器；
- `packages/@openmaic/**` 和 `packages/generation/**`；
- Stage、Scene、Action、Playback 的数据结构和状态语义；
- `/api/**`、持久化、存储键和数据库 Schema；
- generation session、课堂继续生成和导入导出协议；
- 为新页面结构复制第二套课堂状态；
- 通过卸载隐藏 ChatArea、Roundtable 或 Interactive iframe，造成草稿或运行状态丢失；
- 顺带重构 `/workspace`。

### 4.3 共享课堂约束

独立课堂和 Workspace 内嵌课堂共用 `ClassroomSurface → Stage`。所有改造必须支持两种宿主：

- `standalone`：完整知构课堂结构；
- `pane`：保留知构视觉语言，但隐藏重复的全局 Header 和不适合窄面板的装饰。

建议在课堂根节点增加稳定的宿主标识，例如：

```tsx
<div data-classroom-shell="zhigou" data-classroom-variant={variant}>
```

课堂专属样式必须作用在该范围内，不通过全局 Token 改动影响 Workspace。

---

## 5. 目标页面结构

### 5.1 桌面端结构

```text
┌────────────────────────────────────────────────────────────────────┐
│ Logo / 课程名 / 当前进度                         编辑 · 分享 · 更多 │
├───────────────┬───────────────────────────────────┬────────────────┤
│ 知识路径      │ 当前构件眉题                      │ 知构助教       │
│               │ ┌───────────────────────────────┐ │                │
│ ● 建立问题    │ │                               │ │ 本节目标       │
│ │             │ │          认知舞台             │ │ 问一问         │
│ ● 理解概念    │ │ Slide / Quiz / Interactive    │ │ 课堂笔记       │
│ │             │ │ PBL / Whiteboard              │ │ 共思记录       │
│ ◉ 当前构件    │ │                               │ │                │
│ │             │ └───────────────────────────────┘ │                │
│ ○ 应用迁移    │      上一步  播放/暂停  下一步     │                │
├───────────────┴───────────────────────────────────┴────────────────┤
│ 共思台：教师引导 / 角色发言 / 学生输入                              │
└────────────────────────────────────────────────────────────────────┘
```

建议初始宽度：

- 知识路径：248px，可在 220–320px 内调整；
- 知构助教：336px，可在 300–440px 内调整；
- 中央舞台：占据剩余空间，最小宽度 520px；
- 顶部身份栏：64px；
- 共思台：默认 52px，活跃时展开到 180–220px。

### 5.2 信息层级

页面必须遵循以下优先级：

1. 当前教学内容；
2. 当前所在知识构件和学习进度；
3. 播放、上一步、下一步；
4. 当前讨论、提问和笔记；
5. 编辑、分享和导出；
6. 语言、主题、设置等全局工具。

这意味着全局工具不能继续与当前课程内容争夺顶部空间。

---

## 6. 分区详细设计

### 6.1 课堂身份栏

#### 结构

- 左侧：返回按钮、知构 Logo；
- 中间：课程名称、当前知识构件标题；
- 进度：`知识构件 03 / 08`；
- 右侧：编辑课程、分享、更多；
- “更多”内收纳语言、主题、设置和全部导出能力。

#### 文案

| 当前表达 | 新表达 |
|---|---|
| 当前场景 | 正在构建 |
| Scene / Page | 知识构件 |
| Pro Mode | 编辑课程 |
| Course outline | 知识路径 |
| Chat | 问一问 |

“知识构件”只用于序号与进度场景；在自然语句中继续使用“教学环节”，避免文案机械化。

#### 交互

- 返回行为继续调用现有 `exitClassroom`；
- 编辑开关继续调用现有 `onToggleEditMode`；
- 分享、导出继续使用现有 Hook；
- 更多菜单必须使用 Portal，避免被课堂容器裁切；
- Workspace `pane` 模式隐藏 Logo、全局工具和重复返回入口。

#### 涉及文件

- `components/header.tsx`
- `components/stage/header-controls.tsx`
- `components/edit/PlaybackChromeRoot.tsx`

### 6.2 知识路径

#### 默认形态

场景列表改为纵向路径节点：

- 左侧为连续路径线；
- 圆形节点表达完成、当前、未开始、生成中和失败；
- 右侧显示标题、类型和辅助状态；
- 当前节点使用薄荷色表面、青色路径和轻量阴影；
- 默认不展示大缩略图；
- 鼠标悬停或键盘聚焦时允许显示缩略图浮层；
- 用户主动切换“预览模式”后，可以在列表内恢复缩略图。

#### 节点状态

| 状态 | 节点 | 路径 | 辅助文案 |
|---|---|---|---|
| 已完成 | 对勾实心圆 | 青绿色实线 | 已完成 |
| 当前 | 青色圆环 + 内点 | 青色实线到当前节点 | 构建中 |
| 未开始 | 空心圆 | 灰色细线 | 待探索 |
| 生成中 | 呼吸点 | 青色虚线 | 正在搭建 |
| 暂停 | 暂停图标 | 灰色虚线 | 已暂停 |
| 失败 | 警示图标 | 红色虚线 | 需要修复 |

完成状态只能使用已有可靠状态推导。第一阶段没有可靠完成数据时，可将“当前节点之前”显示为“已浏览”，不能伪装为“已掌握”。

#### 场景类型

- Slide：课程讲解；
- Quiz：理解检测；
- Interactive：互动探索；
- PBL：项目实践；
- Whiteboard：思考白板。

#### 折叠态

折叠后保留 44px 宽的竖向路径缩略轨道：

- 每个节点仍可点击；
- 当前节点带 Tooltip；
- 不丢失滚动位置；
- 不卸载列表。

#### 涉及文件

- `components/stage/scene-sidebar.tsx`
- `components/edit/PlaybackChromeRoot.tsx`

必须保留：

- `data-testid="scene-list"`
- `data-testid="scene-item"`
- `data-testid="scene-title"`

### 6.3 认知舞台

#### 外围结构

- 课堂内容区使用低对比网格背景；
- CanvasArea 外增加 20–24px 圆角舞台框；
- 舞台上方显示类型眉题和当前知识构件编号；
- 舞台内层保留原渲染器要求的尺寸与比例；
- 画布四周提供 16–28px 安全间距；
- 深色模式下使用边框和内高光区分层级，不使用大面积发光。

#### 不同内容类型

- Slide：保持原缩放算法；
- Quiz：内容表面仍由 Quiz renderer 决定，外围只提供统一舞台；
- Interactive：不得重建 iframe；
- PBL：不得覆盖其内部 Workspace 视觉；
- Whiteboard：打开时允许舞台扩展，但保留返回当前构件的入口；
- Presentation：进入全屏后去除网格、圆角、眉题和外边距。

#### 涉及文件

- `components/edit/PlaybackChromeRoot.tsx`
- `components/canvas/canvas-area.tsx`

优先在 `PlaybackChromeRoot` 添加外壳，不把知构样式写入各场景渲染器。

### 6.4 学习控制台

#### 控件排列

- 左：上一个知识构件；
- 中：播放/暂停主按钮；
- 右：下一个知识构件；
- 辅助：当前进度、白板、元素引用、全屏；
- 停止讨论等上下文操作只在对应状态出现。

#### 视觉

- 使用浮动白色/深色胶囊表面；
- 主按钮使用知构青色实心圆；
- 次级按钮为透明或轻描边；
- 不使用视频播放器式深黑控制条；
- `course-playback-progress` 继续反映真实进度。

#### 行为

- 快捷键语义保持不变；
- 播放、暂停、上一环节和下一环节调用原函数；
- Loading、讨论中和软关闭状态不能被新动画遮挡；
- Presentation 中继续使用现有控制显隐策略。

#### 涉及文件

- `components/edit/PlaybackChromeRoot.tsx`
- `components/canvas/canvas-area.tsx`
- `components/canvas/course-playback-progress.ts`

### 6.5 共思台

#### 默认状态

原 Roundtable 区域改名并包装为“共思台”：

- 无活动时显示 52px 摘要条；
- 摘要包含“共思台”、参与角色和当前状态；
- 点击或按现有快捷键展开；
- 展开后高度为 180–220px；
- 用户正在输入、角色正在发言或讨论活跃时不能自动收起。

#### 活跃状态

- 教师引导使用小型眉题“引导问题”；
- 角色发言显示头像、角色名和实时状态；
- 学生输入框提示改为“写下你的判断或疑问”；
- 讨论结束显示“本轮共思已收束”，并提供“查看记录”；
- 音频、暂停、继续、停止等行为保持原样。

#### 技术约束

- Roundtable 实例持续挂载；
- 收起通过尺寸和可见区域实现；
- 不更改 SSE、TTS、QA 和 discussion 生命周期；
- 不更改现有键盘事件优先级。

#### 涉及文件

- `components/roundtable/index.tsx`
- `components/edit/PlaybackChromeRoot.tsx`
- `components/roundtable/audio-indicator.tsx`

### 6.6 知构助教

#### 顶部身份

- 标题：知构助教；
- 副状态：正在跟随第 N 个知识构件；
- 状态点：空闲、思考中、回答中；
- 折叠按钮使用与知识路径一致的面板语言。

#### 页签

第一阶段优先做文案和结构映射，不增加新的数据模型：

- 问一问：映射现有 Chat；
- 课堂笔记：映射现有 Lecture Notes；
- 共思记录：映射现有 Session/Discussion 内容。

如果现有页签不能一一对应，保留真实功能，不制造没有数据来源的新页签。

#### 空状态

推荐文案：

> 我正在跟随当前教学环节。你可以让我解释概念、举例，或检查你的理解。

推荐快捷问题：

- 换一种方式解释；
- 给我一个例子；
- 检查我是否理解；
- 总结这一环节。

快捷问题最终仍进入现有发送链路，不创建新的请求协议。

#### 折叠与尺寸

- 桌面端保持现有可调整宽度能力；
- 折叠不卸载 ChatArea；
- 打开时恢复上一次宽度和活动页签；
- Workspace `pane` 模式下允许使用更紧凑的标题和最小宽度。

#### 涉及文件

- `components/chat/chat-area.tsx`
- `components/edit/PlaybackChromeRoot.tsx`

---

## 7. 视觉系统

### 7.1 课堂专属 Token

建议在课堂根节点范围内定义语义 Token：

```css
[data-classroom-shell='zhigou'] {
  --classroom-ground: #edf4f6;
  --classroom-surface: #ffffff;
  --classroom-surface-soft: #f4f8fa;
  --classroom-ink: #102a43;
  --classroom-ink-muted: #5f7482;
  --classroom-accent: #176b87;
  --classroom-accent-soft: #ddf7f3;
  --classroom-success: #2a9d8f;
  --classroom-line: #d7e3e8;
  --classroom-warning: #d98b3a;
}

.dark [data-classroom-shell='zhigou'] {
  --classroom-ground: #071b23;
  --classroom-surface: #102e39;
  --classroom-surface-soft: #0c2530;
  --classroom-ink: #eef7f8;
  --classroom-ink-muted: #a5bbc1;
  --classroom-accent: #4fb6c5;
  --classroom-accent-soft: #123e43;
  --classroom-success: #62c7b8;
  --classroom-line: #294953;
  --classroom-warning: #f2b66d;
}
```

Token 应放入课堂专属样式文件，例如 `components/classroom/classroom-shell.css`，再由课堂入口引入。不要继续扩大 `app/globals.css` 中的课堂细节。

### 7.2 形态规范

- 课堂主舞台圆角：20–24px；
- 主面板圆角：16–20px；
- 节点和次级卡片圆角：10–14px；
- 普通边框：1px；
- 当前节点允许 1px ring；
- 阴影只用于舞台、浮动控制台和当前节点；
- 小型眉题：10–12px、半粗、0.12–0.16em 字距；
- 正文继续使用项目现有 Inter/Noto Sans 字体链。

### 7.3 背景纹理

课堂使用与首页、生成页一致的低对比网格：

- 网格尺寸建议 32px；
- 浅色不透明度不超过 0.035；
- 深色不透明度不超过 0.05；
- 网格只出现在外围地面，不覆盖课件、Quiz 或 Interactive 内容。

### 7.4 动效

- 面板展开/收起：180–240ms；
- 节点状态切换：160–200ms；
- 当前节点路径推进：不超过 240ms；
- 页面首次进入只允许 Header、路径和舞台轻量淡入；
- 不对课件本体增加位移动画；
- `prefers-reduced-motion` 下关闭非必要动画。

---

## 8. 响应式方案

### 8.1 大桌面：1440px 及以上

- 完整三部分布局；
- 路径 248px；
- 助教 336px；
- 共思台可在主舞台下方展开；
- 所有面板支持现有折叠与宽度记忆。

### 8.2 小桌面：1024–1439px

- 知识路径缩小至 220px；
- 知构助教默认折叠为 44px 标签轨；
- 打开助教后覆盖舞台右侧，不永久挤压舞台；
- 共思台保持底部形态。

### 8.3 平板：768–1023px

- 左侧知识路径变为 Header 下方的横向节点条；
- 节点条显示当前节点前后各两个节点；
- 知构助教使用右侧抽屉；
- 共思台使用底部抽屉；
- 舞台占据主要可视区域。

### 8.4 手机：390–767px

- Header 只保留返回、课程名和更多；
- 当前知识构件以紧凑进度条显示；
- 知识路径和助教通过底部 Sheet 打开；
- 学习控制台固定在安全区上方；
- 上一步和下一步必须保留文字或明确 Tooltip/aria-label；
- Quiz 与 Interactive 的可操作区域优先于外围装饰。

### 8.5 Presentation

所有宽度下进入演示模式后：

- 隐藏知识路径、助教、普通 Header、舞台装饰和共思台外壳；
- 保留现有演示控制显隐和互动状态；
- 退出演示后恢复此前面板宽度、折叠状态和草稿。

---

## 9. 状态设计清单

每个结构必须覆盖以下状态，不能只实现正常播放画面：

### 9.1 页面级

- 首次加载；
- Stage 不存在；
- 课堂加载失败；
- 本地数据和远程数据恢复；
- 无场景；
- 所有场景完成；
- 后台继续生成。

### 9.2 知识路径

- 正常节点；
- 当前节点；
- 生成中节点；
- 暂停节点；
- 失败和重试节点；
- 课程完成节点；
- 折叠、调整宽度、滚动溢出。

### 9.3 认知舞台

- Slide；
- Quiz；
- Interactive；
- PBL；
- Whiteboard；
- Pending scene；
- Course complete；
- Presentation；
- 编辑模式切换。

### 9.4 共思台和助教

- 空闲；
- 输入中；
- 思考中；
- 流式回答；
- QA；
- Discussion；
- 暂停；
- 软关闭；
- 网络错误；
- 收起后仍在运行。

---

## 10. 开发阶段与任务拆分

## Phase 0：建立课堂样式作用域

**目标：** 为后续改造建立不污染 Workspace 的结构基础。

任务：

1. 在 `ClassroomSurface` 或 `Stage` 的稳定根节点增加课堂 Shell 标识；
2. 增加 `classroom-shell.css` 和课堂语义 Token；
3. 明确 `standalone`、`pane`、`presentation` 三种宿主状态；
4. 增加基础截图基线：1440 浅色、1440 深色、768 浅色、390 浅色；
5. 确认当前相关测试在未改 UI 前通过。

完成标准：

- 页面视觉尚未明显变化；
- 课堂样式可以被根节点完整作用域限制；
- Workspace 不受新 Token 影响；
- TypeScript 和课堂核心测试通过。

预计：0.5–1 天。

## Phase 1：课堂身份栏与认知舞台

**目标：** 先改变页面最显眼的顶部与中央轮廓。

任务：

1. Header 改为课程身份栏；
2. 将低频全局工具收进更多菜单；
3. 增加知识构件编号和真实场景进度；
4. 为 CanvasArea 增加认知舞台外壳；
5. 增加网格地面、舞台圆角和教学类型眉题；
6. 处理 Presentation 下的外壳移除；
7. 处理 Workspace `pane` 下的紧凑 Header。

完成标准：

- 用户进入课堂后第一屏已经明显区别于旧 OpenMAIC；
- 所有 Header 原有操作仍可完成；
- Slide、Quiz、Interactive、PBL 和 Whiteboard 尺寸不受影响；
- 全屏进入与退出没有布局跳动。

预计：1.5–2 天。

## Phase 2：知识路径

**目标：** 用学习路径节点替代缩略图目录的主导地位。

任务：

1. 重写 scene item 的视觉结构；
2. 增加路径线、节点状态、类型徽标和辅助文案；
3. 将缩略图改为可选预览；
4. 完成生成中、暂停、失败、重试和课程完成节点；
5. 完成折叠轨道和滚动位置保持；
6. 保留原测试锚点和点击切换行为；
7. 增加键盘焦点和 aria-current。

完成标准：

- 默认状态下不再呈现 PPT 缩略图列表观感；
- 点击每个节点仍能切换到正确场景；
- 当前节点始终可见；
- 生成中和失败状态仍能操作；
- 侧栏折叠不导致当前场景变化。

预计：1.5–2 天。

## Phase 3：学习控制台与共思台

**目标：** 统一课堂主操作，并重塑多角色讨论的品牌身份。

任务：

1. 重新排列上一环节、播放/暂停、下一环节；
2. 将进度、白板、引用和全屏降为辅助操作；
3. 为 Roundtable 增加共思台外壳和摘要态；
4. 实现摘要态、展开态和活跃态；
5. 保证输入、TTS、SSE、讨论暂停和软关闭期间不会误收起；
6. 校验所有键盘快捷键。

完成标准：

- 主操作路径无需寻找工具栏；
- 共思台收起时讨论仍持续；
- 正在输入的草稿不会丢失；
- 讨论触发、暂停、继续和结束行为与改造前一致。

预计：2–2.5 天。

## Phase 4：知构助教

**目标：** 让右栏从通用 ChatArea 变为具有教学身份的助教区。

任务：

1. 增加知构助教标题、副状态和状态点；
2. 将现有页签映射为教学语言；
3. 重写空状态和输入提示；
4. 增加快捷问题，并接入现有发送链路；
5. 统一面板折叠按钮和宽度拖动视觉；
6. 保证折叠时组件持续挂载；
7. 处理 Workspace 窄面板状态。

完成标准：

- 助教区不再显示通用聊天产品语言；
- 快捷问题可以正常发送；
- 页签、会话和草稿在折叠后保持；
- 流式回复和思考状态展示正常。

预计：1–1.5 天。

## Phase 5：响应式、暗色与统一状态

**目标：** 完成可交付质量，不把移动端作为桌面三栏的压缩版本。

任务：

1. 实现 1024px 助教覆盖模式；
2. 实现 768px 横向知识路径和抽屉；
3. 实现 390px 底部 Sheet 与安全区控制台；
4. 完成暗色模式层级与对比度；
5. 统一 Loading、Error、Pending 和 Complete 状态；
6. 增加 `prefers-reduced-motion`；
7. 完成截图对比和人工验收。

完成标准：

- 390、768、1440 四类目标画面可正常操作；
- 暗色模式没有低对比文字或大面积发光；
- Overlay/Sheet 不遮挡核心操作或引发状态重置；
- 全部保护测试通过。

预计：1.5–2 天。

### 总体排期

- 高辨识度 MVP（Phase 0–2）：3–4 个前端工作日；
- 完整改造（Phase 0–5）：8–10 个前端工作日；
- 如果需要单独进行视觉评审和两轮细节迭代，额外预留 2–3 天。

---

## 11. 文件级改造清单

| 文件 | 改造内容 | 风险级别 |
|---|---|---|
| `components/classroom/ClassroomSurface.tsx` | 增加课堂 Shell 与宿主标识 | 中 |
| `components/classroom/classroom-shell.css` | 新增课堂 Token、布局和响应式样式 | 低 |
| `components/header.tsx` | 课程身份栏、进度和标题层级 | 中 |
| `components/stage/header-controls.tsx` | 高频/低频操作重新分组 | 中 |
| `components/stage/scene-sidebar.tsx` | 知识路径节点、状态和折叠轨道 | 中高 |
| `components/edit/PlaybackChromeRoot.tsx` | 新三分区、舞台、控制台、共思台承载 | 高 |
| `components/canvas/canvas-area.tsx` | 舞台内控制布局适配 | 中高 |
| `components/chat/chat-area.tsx` | 知构助教身份、文案和快捷问题 | 中 |
| `components/roundtable/index.tsx` | 共思台摘要与展开表现 | 高 |
| `components/classroom/classroom-status-state.tsx` | Loading/Error 空状态统一 | 低 |
| `app/globals.css` | 原则上不增加课堂细节，仅保留必要共享变量 | 低 |

`PlaybackChromeRoot` 和 `Roundtable` 风险较高，建议每个 Phase 单独提交，避免在一次改动中同时处理布局、播放和讨论生命周期。

---

## 12. 测试与验证

### 12.1 每个 Phase 的基础检查

```bash
pnpm exec tsc --noEmit --incremental false
pnpm run check:i18n-keys
git diff --check
```

### 12.2 课堂保护测试

```bash
pnpm exec playwright test e2e/tests/classroom-interaction.spec.ts --project=chromium
pnpm exec playwright test e2e/tests/quiz-content-surface-657.spec.ts --project=chromium
pnpm exec playwright test e2e/tests/interactive-iframe-keepalive-619.spec.ts --project=chromium
pnpm exec playwright test e2e/tests/playback-resume-cutover.spec.ts --project=chromium
pnpm exec playwright test e2e/tests/full-happy-path.spec.ts --project=chromium
```

最终运行：

```bash
pnpm run test:e2e:ui-guard -- --project=chromium
```

### 12.3 建议新增的视觉测试

1. 1440px 浅色完整课堂；
2. 1440px 深色完整课堂；
3. 知识路径折叠态；
4. 知构助教折叠和展开态；
5. 共思台摘要、讨论中、输入中；
6. Quiz、Interactive、PBL、Whiteboard；
7. 768px 平板；
8. 390px 手机；
9. Presentation 进入和退出；
10. Workspace 内嵌课堂。

### 12.4 人工行为验收

1. 从首页打开已有课程；
2. 从生成页进入新课程；
3. 点击知识路径切换每一种场景；
4. 播放、暂停、上一环节、下一环节；
5. 完成 Quiz；
6. 打开 Interactive，切换场景后返回，确认 iframe 状态；
7. 打开 Whiteboard 并关闭；
8. 触发 QA 和 Discussion；
9. 输入未发送内容后折叠助教与共思台，再展开检查草稿；
10. 进入和退出 Presentation；
11. 进入编辑模式再返回播放模式；
12. 分享、导出、语言、主题和设置；
13. 返回首页并重新打开课堂；
14. 在 Workspace 中打开同一课堂。

---

## 13. 验收标准

### 13.1 品牌识别

- 隐藏 Logo 后，仍能从知识路径、认知舞台、共思台和知构助教识别产品；
- 默认画面不再以缩略图列表和通用聊天栏作为主要视觉记忆；
- 首页、生成页和课堂页使用同一视觉语法，但课堂拥有独立的学习场景特征。

### 13.2 使用体验

- 5 秒内可以识别当前课程、当前环节和下一步操作；
- 当前知识构件始终有明确位置和状态；
- 播放主操作始终可见或可通过现有快捷键完成；
- 助教、笔记和共思记录的入口清楚；
- 折叠面板不会清空输入或终止运行状态。

### 13.3 技术质量

- 不新增第二套 Stage/Scene 状态；
- 不修改红色保护区；
- 所有现有稳定测试 ID 保留；
- 课堂保护测试和完整 Happy Path 通过；
- Workspace 没有明显视觉或行为回归；
- 浅色、深色、390、768、1440px 均通过检查；
- Presentation 和 Interactive keep-alive 行为不变。

---

## 14. 风险与应对

| 风险 | 表现 | 应对 |
|---|---|---|
| 只完成换色 | 页面仍像 OpenMAIC | Phase 1 和 Phase 2 必须同时改变页面轮廓与路径结构 |
| 共享组件污染 Workspace | Workspace 课堂或工作台样式异常 | 使用课堂根节点作用域和 `variant`，禁止无范围全局选择器 |
| 面板隐藏导致状态丢失 | 草稿、讨论或 iframe 重置 | 通过宽度、可见性和 Overlay 隐藏，保持组件挂载 |
| 舞台外壳影响渲染尺寸 | Quiz/Interactive 被裁切 | 外壳只负责外围布局，逐类验证渲染器 |
| 共思台收展破坏键盘行为 | Space、T 等快捷键冲突 | 保留原事件优先级，增加输入态端到端测试 |
| 响应式过晚处理 | 桌面结构无法在移动端收敛 | Phase 1 即定义区域语义，Phase 5 只改变编排方式 |
| 虚构学习完成度 | 用户被错误告知“已掌握” | 没有真实数据时使用“已浏览”，不显示掌握度和分数 |

---

## 15. 停止条件

出现下列情况时停止扩大修改并先定位问题：

- 必须修改 Stage、Scene 或 Playback 数据协议才能完成布局；
- 需要复制一套课堂状态才能支持新外壳；
- 场景切换导致 Chat、Roundtable、Interactive 或 Whiteboard 状态丢失；
- Workspace 因共享样式产生回归；
- Presentation 不能恢复原面板状态；
- 课堂保护测试持续失败；
- 发现与本方案重叠且来源不明的用户改动。

---

## 16. 推荐交付方式

建议按以下五个独立提交交付：

1. `style(classroom): add scoped zhigou classroom shell`
2. `feat(classroom): redesign identity bar and cognition stage`
3. `feat(classroom): turn scene list into knowledge path`
4. `feat(classroom): add learning controls and co-thinking dock`
5. `feat(classroom): brand assistant and complete responsive states`

每个提交只包含对应 Phase 的 UI、必要测试调整和截图，不混入底层修复、依赖升级或 Workspace 重构。

本轮最终成功标准不是“课堂页也用了知构的颜色”，而是课堂在结构、语言和操作方式上完整表达“知识正在被一步步构建”。
