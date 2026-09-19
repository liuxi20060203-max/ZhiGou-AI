# 知构“理解闭环”产品升级执行方案

## 1. 文档目的

本文档用于把知构从“具有品牌特色的 AI 课堂”继续升级为“能识别理解证据、发现薄弱点并组织补学路径的知识构建系统”。

方案覆盖产品目标、用户流程、领域模型、事件与状态规则、技术落点、阶段拆分、任务依赖、验收标准、测试矩阵、指标、灰度方式和停止条件。研发可以依据第 10 节直接拆分任务并排期。

本轮核心不是增加更多 AI 按钮，而是建立一条可解释的学习闭环：

> 知识构件 → 学习行为 → 理解证据 → 状态判断 → 补学路径 → 再次验证 → 知识构建报告

### 当前实施状态

- 执行分支：`feature/zhigou-learning-loop`；
- Phase 0：已完成（2026-09-19）；
- Phase 1：已完成（2026-09-19）；
- Phase 2：已完成（2026-09-19）；
- Phase 3：已完成（2026-09-19）；
- Phase 4：已完成（2026-09-19）；
- 当前阶段：正在执行 Phase 5“评测、观测与灰度”；
- Runtime 契约结论见 `LEARNING_LOOP_RUNTIME_CONTRACT.md`；
- 功能默认关闭，现有课堂行为不变。

---

## 2. 项目结论

### 2.1 产品定位

知构课堂下一阶段应从“课程播放与对话”转向“围绕知识构建过程提供反馈”。

用户进入课堂后，应能持续回答四个问题：

1. 我现在正在理解哪个知识构件；
2. 系统基于什么证据判断我的学习状态；
3. 哪些内容需要回看或换一种方式理解；
4. 完成课堂后，我实际构建了什么、下一步应该做什么。

### 2.2 第一阶段产品承诺

MVP 只承诺以下能力：

- 将现有 Scene 映射为可展示的“知识构件”；
- 从 Quiz、显式反馈和补学验证中采集可解释证据；
- 使用离散状态表达学习进展，不展示虚构的“掌握度百分比”；
- 当出现明确薄弱证据时，生成最多三步的补学路径；
- 补学完成后进行一次微型验证，并更新状态；
- 在结课页生成一份带证据来源的知识构建报告；
- 将当前构件和已有证据传给知构助教，减少脱离课程上下文的回答。

### 2.3 暂不承诺

- 不根据停留时长直接推断“已理解”；
- 不将 AI 自评作为唯一验证证据；
- 不在 MVP 中自动重排或改写原始课程 Scene；
- 不建设完整的学科知识图谱平台；
- 不建设教师班级管理、排名或成绩系统；
- 不以单一综合分数替代可解释证据；
- 不同时启动全量内容编辑器、社交协作和复杂推荐系统。

---

## 3. 成功标准

### 3.1 北极星指标

**有效闭环完成率**：产生“需要回看”证据的学习会话中，完成补学并产生新验证证据的会话占比。

计算口径：

```text
有效闭环完成率 = 完成补学且产生 verification 证据的会话数
               / 进入 needs_revisit 状态的会话数
```

### 3.2 MVP 产品指标

| 指标 | 定义 | MVP 观察目标 |
| --- | --- | --- |
| 构件覆盖率 | 至少产生一条有效证据的构件数 / 可验证构件数 | 用于判断闭环是否覆盖课程，而非设硬性成绩目标 |
| 补学启动率 | 用户启动补学的次数 / 收到补学建议的次数 | 验证入口与理由是否清晰 |
| 补学完成率 | 完成全部补学步骤的次数 / 启动次数 | 识别路径是否过长或过难 |
| 再验证改善率 | 补学后验证通过次数 / 完成再验证次数 | 评估补学内容是否有效 |
| 报告查看率 | 打开或停留于结课报告的完成会话 / 课程完成会话 | 验证报告价值 |
| 证据解释可见率 | 展开查看“为什么是此状态”的用户占比 | 验证可解释性是否被使用 |

### 3.3 护栏指标

- 课堂首屏和 Scene 切换性能不得明显回退；
- 学习事件写入失败不得阻塞播放、答题或聊天；
- 补学路径不得修改原 Scene、播放序列或生成会话；
- 同一业务事件重试不得产生重复有效证据；
- 旧课程在无知识模型、无证据时必须正常播放；
- AI 生成失败时必须提供规则化的本地降级路径。

---

## 4. 核心用户流程

### 4.1 正常学习路径

```text
进入课堂
  → 左侧看到知识构件及当前状态
  → 学习当前 Scene
  → 完成 Quiz / 主动表达“没懂” / 请求检查理解
  → 系统记录证据并解释状态
  → 若证据充分：标记“已有验证”
  → 若出现明确薄弱证据：标记“建议回看”
  → 用户启动最多三步补学
  → 完成微型验证
  → 更新构件状态
  → 结课时生成知识构建报告
```

### 4.2 补学路径结构

每次补学只包含以下三类步骤，最多各一个：

1. **换种解释**：从原 Scene 提取目标，使用另一种表述或类比；
2. **对比例子**：给出一个正例、反例或易混淆概念对比；
3. **微型验证**：一道判断、选择、简答或“用自己的话解释”。

补学卡片必须说明触发原因，例如：

> 在“闭包与作用域”的两道检测中，你对变量捕获的判断不一致，因此建议先看一个对比例子，再做一次快速验证。

不得只显示“AI 认为你掌握不足”。

### 4.3 主动触发入口

即使没有 Quiz，用户也可以从学习控制台或知构助教触发：

- “这里没懂”；
- “换个例子”；
- “检查我是否理解”；
- “把这段和前面的内容连起来”。

这些入口记录的是用户显式意图，不能直接记录为“未掌握”或“已掌握”。

---

## 5. 产品与数据原则

### 5.1 证据优先，不伪造精确度

MVP 使用以下状态，不使用 0–100 的掌握度：

| 状态 | 用户文案 | 进入条件 |
| --- | --- | --- |
| `not_started` | 未开始 | 没有与该构件相关的事件 |
| `in_progress` | 构建中 | 已访问或已互动，但没有可判断结果的证据 |
| `evidence_available` | 已有证据 | 已产生有效证据，但不足以得出验证或回看结论 |
| `needs_revisit` | 建议回看 | 出现失败验证、明确错误或用户主动标记困惑 |
| `verified` | 已有验证 | 满足构件验证规则，且没有更新的未解决反证 |

状态必须能展开查看证据来源、发生时间和关联 Scene。

### 5.2 事件追加，状态派生

- RuntimeStore 中保存不可变学习事件；
- 当前状态由事件折叠计算，不直接作为唯一事实写入；
- 同一 `eventId` 重放必须幂等；
- 新证据可以覆盖旧判断，但不能删除旧证据；
- 报告展示当前结论，同时保留证据时间线。

### 5.3 课程定义与学习运行时分离

- 知识构件属于课程定义；
- 学习证据、补学计划和完成情况属于特定 learner 的运行时；
- 不把 learner 数据写回 Stage/Scene 文档；
- 不让补学临时内容混入课程 Scene 数组；
- 课程导出默认不包含个人学习证据，除非未来明确增加单独导出能力。

### 5.4 AI 只负责建议，规则负责落账

- AI 可以生成补学内容、给简答提供评价建议；
- 是否形成有效证据由确定性校验和规则决定；
- AI 输出必须使用结构化 Schema；
- 解析失败、引用不存在构件、缺少依据时拒绝落账；
- AI 结论必须关联原问题、答案或用户文本，不接受无来源判断。

---

## 6. 领域模型

### 6.1 知识构件

建议在 `lib/learning-loop/types.ts` 定义应用层类型，验证稳定后再决定是否进入 DSL：

```ts
export interface KnowledgeComponent {
  id: string;
  stageId: string;
  title: string;
  objective?: string;
  keyPoints: string[];
  sceneIds: string[];
  prerequisiteIds: string[];
  verification: {
    requiredEvidenceCount: number;
    acceptedEvidenceTypes: LearningEvidenceType[];
  };
  source: 'scene-derived' | 'outline-derived' | 'authored';
  version: 1;
}
```

MVP 映射规则：

- 默认一个 Scene 对应一个知识构件；
- `title` 来自 `Scene.title`；
- `objective` 和 `keyPoints` 优先来自 `SceneOutline`；
- 没有 Outline 时从 Scene 标题、描述和 Quiz 内容生成降级信息；
- 构件 ID 必须可稳定重建，例如 `kc:${stageId}:${sceneId}`；
- 第一版不自动推断跨课程关系；
- 同一课程内仅支持线性前置关系，且必须允许人工覆盖。

### 6.2 学习证据

```ts
export type LearningEvidenceType =
  | 'scene_visited'
  | 'quiz_reviewed'
  | 'learner_confusion'
  | 'learner_explanation'
  | 'repair_step_completed'
  | 'verification_passed'
  | 'verification_failed';

export interface LearningEvidence {
  eventId: string;
  stageId: string;
  learnerKey: string;
  componentId: string;
  sceneId?: string;
  type: LearningEvidenceType;
  outcome: 'neutral' | 'supports' | 'contradicts';
  strength: 'weak' | 'medium' | 'strong';
  source: 'playback' | 'quiz' | 'learner' | 'tutor' | 'repair';
  payload: Record<string, unknown>;
  occurredAt: string;
  schemaVersion: 1;
}
```

事件规则：

| 事件 | 强度 | 是否可单独验证 | 说明 |
| --- | --- | --- | --- |
| `scene_visited` | weak | 否 | 仅代表到达，不代表理解 |
| `quiz_reviewed` | strong | 视题目映射而定 | 必须在 review 完成后写入，记录逐题结果 |
| `learner_confusion` | medium / contradicts | 否 | 用户主动声明困惑，进入建议回看 |
| `learner_explanation` | medium | 否 | 只有经过评价并留存依据后才可支持验证 |
| `repair_step_completed` | weak | 否 | 只代表完成步骤 |
| `verification_passed` | strong | 是 | 与构件目标匹配的微型验证通过 |
| `verification_failed` | strong / contradicts | 否 | 更新为建议回看 |

### 6.3 补学计划

```ts
export interface RepairPlan {
  id: string;
  stageId: string;
  learnerKey: string;
  componentId: string;
  triggerEvidenceIds: string[];
  rationale: string;
  steps: RepairStep[];
  status: 'proposed' | 'active' | 'completed' | 'dismissed' | 'expired';
  contentVersion: 1;
  createdAt: string;
}
```

约束：

- 每个计划最多三步；
- 每一步必须关联同一构件，跨构件补学推迟到后续版本；
- 一个构件同一时间只能有一个 active 计划；
- 课程内容或构件版本变化后，旧计划标为 expired；
- 计划是 learner runtime，不写入 `scenes`；
- 关闭计划不改变原课堂播放位置。

### 6.4 知识构建报告

```ts
export interface KnowledgeConstructionReport {
  stageId: string;
  learnerKey: string;
  generatedAt: string;
  components: Array<{
    componentId: string;
    status: LearningComponentStatus;
    evidenceIds: string[];
    explanation: string;
    suggestedNextAction?: string;
  }>;
  repairedComponentIds: string[];
  unresolvedComponentIds: string[];
}
```

报告默认由本地聚合器确定性生成。AI 只可为现有事实生成摘要，不得新增不存在的学习结论。

---

## 7. 技术方案

### 7.1 总体结构

```text
Stage + Scenes + SceneOutlines
          │
          ▼
  KnowledgeModelBuilder
          │
          ├──────────────► 知识路径 UI
          │
Quiz / 显式反馈 / 补学验证
          │
          ▼
 LearningEvidence RuntimeStore
          │
          ▼
   Evidence Fold / Status Engine
          │
          ├──────────────► 知构助教上下文
          ├──────────────► 补学计划生成器
          └──────────────► 知识构建报告
```

### 7.2 存储边界

MVP 使用现有 RuntimeStore，不增加 Dexie 表：

- 新 runtime kind：`learningJourney`；
- 每个 `stageId + learnerKey` 一个 journey session；
- evidence 和 repair plan 状态变化以 records 追加；
- 使用现有 learner partition 与匿名用户合并机制；
- 通过 payload validator 注册新记录类型；
- 写入失败在 UI 中显示非阻塞提示，并允许重试。

实施前必须先确认 `CoreRuntimeKind` 对扩展 kind 的限制。若类型层允许 string 扩展，仅在应用 validator 中注册；若服务端白名单限制新 kind，则先补齐 Runtime DSL 与 HTTP/PG 存储兼容测试，再接 UI。

### 7.3 知识模型的落地顺序

为了降低课程协议风险，分两步实施：

1. **MVP**：在客户端通过 `buildKnowledgeModel(stage, scenes, outlines)` 稳定派生，不修改 Stage DSL；
2. **验证后**：如确实需要人工编辑关系，再引入可选、版本化的课程 sidecar 或 DSL 字段，并补齐导入导出迁移。

这样旧课程无需迁移即可进入闭环。

### 7.4 状态折叠优先级

建议在 `lib/learning-loop/fold.ts` 实现纯函数，规则按事件时间和证据优先级计算：

1. 没有事件：`not_started`；
2. 只有访问或步骤完成：`in_progress`；
3. 最新未解决的强反证：`needs_revisit`；
4. 最新验证通过且晚于所有反证：`verified`；
5. 有中等或强度证据但不满足以上条件：`evidence_available`。

必须覆盖以下边界：

- 先失败、后补学验证通过 → `verified`；
- 先通过、后一次新验证失败 → `needs_revisit`；
- 用户点“没懂”、随后只看了解释但未验证 → `needs_revisit`；
- 重复事件 ID → 只计算一次；
- 未知事件版本 → 跳过并记录诊断，不中断课堂。

### 7.5 Quiz 接入

复用 `components/scene-renderers/quiz-view.tsx` 与 `lib/quiz/runtime.ts` 的 reviewed 生命周期：

- 只有 attempt 进入 reviewed 后才派生正式 Quiz 证据；
- 每个问题映射到当前 Scene 的默认知识构件；
- payload 保留 questionId、是否正确、得分、attemptId，不复制完整敏感文本；
- eventId 使用 `quiz:${attemptId}:${questionId}:reviewed`，保证重试幂等；
- 草稿与 submitted 未 review 状态不影响构件状态；
- 旧 attempt 加载后不得重复追加同一证据。

### 7.6 知构助教接入

扩展 `components/chat/use-chat-sessions.ts` 的 store state，加入精简上下文：

```ts
learningContext: {
  currentComponent: { id: string; title: string; objective?: string };
  status: LearningComponentStatus;
  recentEvidence: EvidenceSummary[];
  activeRepairPlan?: RepairPlanSummary;
}
```

规则：

- 只发送当前构件和最近必要证据，避免上下文无限增长；
- 系统提示要求引用构件标题或 Scene 来源；
- “换个例子”“检查理解”等快捷操作使用明确 action，而非只依赖自然语言猜测；
- 助教回答本身不自动形成 `verified`；
- 只有用户完成结构化检查后，才写入验证事件。

### 7.7 补学生成接口

建议新增 `app/api/learning-loop/repair-plan/route.ts`：

输入：

- 当前构件的标题、目标和关键点；
- 原 Scene 的受控摘要；
- 触发证据摘要；
- 允许的步骤类型和最大步数；
- 课程语言与难度上下文。

输出：

- 符合 JSON Schema 的 rationale 和 1–3 个步骤；
- 微型验证的题目、可验证答案与解释；
- 明确引用的 componentId。

服务端必须校验：

- componentId 是否存在于请求上下文；
- 步骤是否超限；
- 验证题是否包含可判定规则；
- 输出是否包含不允许的 Scene 修改指令；
- 超时、模型错误和 Schema 错误是否走本地模板降级。

### 7.8 UI 落点

| 区域 | 改造内容 | 建议文件 |
| --- | --- | --- |
| 知识路径 | 在现有节点上增加离散状态、证据入口和回看提示 | `components/stage/knowledge-path-sidebar.tsx` 或现有 Sidebar 对应文件 |
| 学习控制台 | 增加“没懂”“换个例子”“检查理解” | 新建 `components/learning-loop/learning-actions.tsx` |
| 补学面板 | 覆盖式抽屉/卡片，不卸载 Scene renderer | 新建 `components/learning-loop/repair-panel.tsx` |
| 证据说明 | 展示状态原因、来源和时间线 | 新建 `components/learning-loop/evidence-drawer.tsx` |
| Quiz | reviewed 后写入逐题证据 | `components/scene-renderers/quiz-view.tsx` |
| 知构助教 | 注入当前构件、状态和活动补学摘要 | `components/chat/use-chat-sessions.ts`、`app/api/chat/route.ts` |
| 课程完成 | 从答题摘要升级为知识构建报告 | `components/scene-renderers/classroom-complete.tsx` |

补学面板关闭或切换时不得卸载 Interactive iframe、Quiz 草稿或 Roundtable 状态。

### 7.9 建议目录

```text
lib/learning-loop/
  types.ts
  knowledge-model.ts
  evidence.ts
  fold.ts
  runtime.ts
  repair-plan.ts
  report.ts
  validators.ts

components/learning-loop/
  component-status-badge.tsx
  evidence-drawer.tsx
  learning-actions.tsx
  repair-panel.tsx
  repair-step.tsx
  knowledge-report.tsx

app/api/learning-loop/
  repair-plan/route.ts
  evaluate-explanation/route.ts   # 后续阶段，可不进入 MVP
```

---

## 8. 埋点与隐私

### 8.1 产品埋点

产品分析事件与学习证据必须分离。产品埋点用于分析功能使用，不得参与学习状态折叠。

建议事件：

- `learning_loop_component_viewed`；
- `learning_loop_evidence_opened`；
- `learning_loop_repair_suggested`；
- `learning_loop_repair_started`；
- `learning_loop_repair_step_completed`；
- `learning_loop_verification_completed`；
- `learning_loop_report_viewed`；
- `learning_loop_generation_failed`。

### 8.2 数据最小化

- 分析埋点只记录匿名 componentId、事件类型和结果枚举；
- 学习证据 payload 不默认保存完整聊天文本；
- 简答评价如需原文，必须明确用途并设置可删除边界；
- 前端日志不得输出 learnerKey、完整答案或模型上下文；
- 删除课程时复用现有 stage runtime cascade，覆盖 `learningJourney`；
- 匿名账户合并必须覆盖新 runtime kind。

---

## 9. Feature Flag 与灰度

新增以下开关：

```env
NEXT_PUBLIC_LEARNING_LOOP_ENABLED=false
OPENMAIC_LEARNING_LOOP_AI_ENABLED=false
```

- 公共开关控制知识状态、证据入口和补学 UI；
- 服务端开关控制 AI 补学生成；
- 公共开关开、AI 开关关时，使用规则化补学模板；
- 任何开关关闭时，旧课堂行为保持不变。

灰度顺序：

1. 本地开发与自动化测试；
2. 内部账号 + 指定测试课程；
3. 10% 新创建课程；
4. 50% 新课程，继续观察护栏；
5. 全量新课程；
6. 验证旧课程兼容后再默认覆盖存量课程。

每个阶段至少观察一个完整发布周期，发生数据重复、状态错误或显著性能回退时回滚开关。

---

## 10. 分阶段执行计划

以下工期按一名前端/全栈开发者估算，可并行部分不代表必须并行。每个 Phase 应独立提交、独立验收，不跨阶段堆积未验证改动。

### Phase 0：契约审计与基线建立（1–2 人日）

目标：确认 RuntimeStore、learner 合并、课程删除、Quiz reviewed 和聊天上下文边界，避免后续返工。

任务：

- `LL-001` 记录 `CoreRuntimeKind`、validator、HTTP/PG RuntimeStore 对自定义 kind 的支持结论；
- `LL-002` 验证 stage 删除和 clear database 是否会清除新 kind；
- `LL-003` 验证匿名 learner 合并是否覆盖新 kind；
- `LL-004` 为 Quiz draft → submitted → reviewed 流程补一条集成测试基线；
- `LL-005` 记录课堂首屏、Scene 切换、Quiz review 的性能基线；
- `LL-006` 在 `lib/config/feature-flags.ts` 增加默认关闭的双开关及测试。

交付物：

- 运行时契约说明或 ADR；
- Feature Flag；
- 关键路径基线测试；
- 已确认的阻塞清单。

验收标准：

- 新功能关闭时产物与当前 main 行为一致；
- 能说明新 runtime kind 在浏览器、HTTP、PG 三种存储中的行为；
- learner 合并和 stage 删除有自动化测试或明确的后续阻塞项；
- 若发现服务端 kind 白名单，不允许绕过，必须先进入 Phase 1 的基础设施任务。

提交建议：

```text
chore(learning-loop): establish runtime contracts and feature gates
```

### Phase 1：知识构件模型与只读路径（2–3 人日）

目标：在不改变课程协议的前提下，把 Scene 稳定映射为知识构件并显示在知识路径中。

任务：

- `LL-101` 新建 `lib/learning-loop/types.ts`；
- `LL-102` 实现 `buildKnowledgeModel(stage, scenes, outlines)`；
- `LL-103` 为缺失 Outline、重复顺序、空标题和 legacy scene 提供降级；
- `LL-104` 在课堂 store selector 中提供 memoized knowledge model；
- `LL-105` 在左侧路径展示构件标题、目标摘要和默认 `not_started` 状态；
- `LL-106` 增加构件详情轻量弹层；
- `LL-107` 添加单元、组件和旧课程回归测试。

验收标准：

- 同一课程重复加载得到相同 componentId；
- 所有可播放 Scene 均有对应构件；
- Outline 不存在时仍可展示；
- 路径 UI 不改变 Scene 顺序和播放逻辑；
- 关闭 Feature Flag 后不渲染新增元素；
- Workspace pane 与 standalone 均不溢出。

提交建议：

```text
feat(learning-loop): derive and display knowledge components
```

### Phase 2：学习证据与状态引擎（3–4 人日）

目标：形成可持久化、可重放、可解释的证据链，并接入 Quiz reviewed。

任务：

- `LL-201` 注册 `learningJourney` runtime kind 和 payload validator；
- `LL-202` 实现 deterministic journey/session/event ID；
- `LL-203` 实现 append queue、冲突重试和幂等读取；
- `LL-204` 实现纯函数 `foldLearningEvidence`；
- `LL-205` 接入 `scene_visited`，但仅产生弱证据；
- `LL-206` 在 Quiz reviewed 后写入逐题证据；
- `LL-207` 增加“这里没懂”入口并写入显式困惑证据；
- `LL-208` 在知识路径展示状态 badge；
- `LL-209` 实现证据抽屉，解释状态来源；
- `LL-210` 补齐离线、重试、重复 review、刷新恢复测试。

验收标准：

- 刷新页面后证据和状态可恢复；
- 同一 Quiz review 重放不会重复计数；
- 访问 Scene 不会使状态变为 verified；
- 错题或失败验证能进入 needs_revisit；
- 新的通过证据晚于旧反证时能进入 verified；
- RuntimeStore 失败不阻塞 Quiz review，且用户可看到非阻塞提示；
- 删除 Stage 后无残留 journey runtime。

提交建议：

```text
feat(learning-loop): persist evidence and derive component states
```

### Phase 3：自适应补学路径 MVP（4–5 人日）

目标：基于明确薄弱证据生成最多三步的补学路径，并完成再验证。

任务：

- `LL-301` 定义 RepairPlan Schema 与服务端校验器；
- `LL-302` 实现规则化本地补学模板，作为稳定降级；
- `LL-303` 新增 repair-plan API 和结构化 AI 输出；
- `LL-304` 只传当前构件、相关 Scene 摘要与触发证据；
- `LL-305` 实现补学建议卡和触发理由；
- `LL-306` 实现不卸载 Scene renderer 的补学面板；
- `LL-307` 持久化 plan proposed/active/completed/dismissed/expired 事件；
- `LL-308` 实现微型验证及 pass/fail 证据；
- `LL-309` 为超时、Schema 错误、非法引用提供模板降级；
- `LL-310` 增加 API、组件、E2E 与并发冲突测试。

验收标准：

- 只有 needs_revisit 或用户主动请求时才建议补学；
- 补学理由可追溯到已有证据；
- 计划不超过三步且至少包含一次验证；
- 计划不会插入或修改原 Scene；
- 关闭补学面板后原播放/Quiz/Interactive 状态仍在；
- AI 不可用时仍能完成模板补学与验证；
- 完成验证后状态按证据时间线正确更新。

提交建议：

```text
feat(learning-loop): add evidence-based repair paths
```

### Phase 4：知构助教与知识构建报告（3–4 人日）

目标：让助教理解当前学习状态，并让课程完成页呈现可解释的学习结果。

任务：

- `LL-401` 向 chat store state 注入精简 learningContext；
- `LL-402` 为“换个例子”“检查理解”“连接前文”增加结构化 action；
- `LL-403` 要求助教回答引用当前构件或关联 Scene；
- `LL-404` 实现确定性的 `buildKnowledgeConstructionReport`；
- `LL-405` 将 `classroom-complete.tsx` 升级为构件状态、证据和建议视图；
- `LL-406` 保留原 Quiz summary，作为报告中的证据模块；
- `LL-407` 增加状态与报告一致性测试；
- `LL-408` 验证聊天上下文不会因快速切换 Scene 而串台。

验收标准：

- 助教能正确识别当前构件和最新状态；
- 助教回答不会仅因自然语言表态就写入 verified；
- 报告中的每个状态都能展开查看证据；
- 报告不得声称不存在的分数、掌握度或学习时长；
- Quiz summary 与构件证据不矛盾；
- 旧课程无证据时显示友好空状态，而非错误或伪结论。

提交建议：

```text
feat(learning-loop): connect tutor context and construction report
```

### Phase 5：评测、观测与灰度（2–3 人日）

目标：在小流量中验证闭环价值，建立 AI 与规则回归机制。

任务：

- `LL-501` 接入产品埋点并与证据存储隔离；
- `LL-502` 建立 20–30 个补学样例评测集；
- `LL-503` 建立结构合规、依据一致、难度适配、验证可判定四项 rubric；
- `LL-504` 增加 latency、Schema failure、fallback rate 和重复事件监控；
- `LL-505` 按第 9 节执行内部与 10% 灰度；
- `LL-506` 完成至少 5 次真实任务式可用性测试；
- `LL-507` 根据指标决定扩大、调整或停止。

验收标准：

- AI 评测在固定测试集上可重复执行；
- Schema failure 与 fallback 有明确监控；
- 能区分“建议已显示、用户已启动、已完成、已验证”；
- 灰度可通过开关即时关闭，不需要数据回滚；
- 完成一份上线复盘与下一阶段决策记录。

提交建议：

```text
test(learning-loop): add evals telemetry and rollout safeguards
```

### Phase 6：验证后扩展项（不进入 MVP）

只有 Phase 5 证明闭环有效后才进入：

- 多 Scene 对一个知识构件；
- 课程内非线性前置关系；
- 教师/创作者人工编辑构件与验证规则；
- 把 Roundtable 中的观点显式“沉淀为知识卡”；
- 简答、口述或作品型证据的 AI 辅助评价；
- 跨课程知识地图；
- 教师班级视角与群体薄弱点；
- 基于证据的生成质量检查。

---

## 11. 任务依赖与建议顺序

```text
LL-001/002/003
      │
      ├──► LL-201 Runtime 基础 ──► LL-206 Quiz 证据
      │                              │
LL-101/102 知识模型 ──► LL-204 状态引擎 ──► LL-208 状态 UI
                                      │
                                      └──► LL-301 补学 Schema
                                                │
                         LL-302 模板降级 ───────┤
                                                ▼
                                         LL-303~309 补学闭环
                                                │
                         LL-401 助教上下文 ◄────┤
                         LL-404 结课报告  ◄─────┘
                                                │
                                                ▼
                                         LL-501~507 灰度
```

不可跳过的依赖：

- 状态 UI 依赖纯函数状态引擎；
- 补学建议依赖可追溯证据；
- AI 补学依赖模板降级先完成；
- 报告依赖状态与证据聚合稳定；
- 灰度依赖数据删除、learner 合并和幂等测试通过。

---

## 12. 测试矩阵

### 12.1 单元测试

- 知识构件 ID 稳定性；
- legacy Scene/Outline 降级；
- event validator 与未知版本处理；
- eventId 去重；
- evidence fold 的全部状态转换；
- 新旧反证的时间顺序；
- RepairPlan 三步上限和非法 componentId；
- 报告与状态引擎使用相同结果；
- Feature Flag 默认关闭。

### 12.2 集成测试

- Quiz reviewed → learning evidence → component status；
- 重载旧 attempt 不重复写证据；
- learner 匿名合并后证据可见且不重复；
- stage 删除级联删除 journey；
- HttpRuntimeStore 与 PgRuntimeStore 接受新 kind；
- AI Schema 错误 → 模板降级；
- 快速切换 Scene 时 chat learningContext 不串台；
- RuntimeStore 暂时失败后的重试与恢复。

### 12.3 E2E 场景

1. 打开旧课程，知识路径可显示，播放无回归；
2. 访问 Slide 后状态为构建中，不是已有验证；
3. Quiz 答错并 review 后，对应构件显示建议回看；
4. 打开证据抽屉，可看到题目结果来源；
5. 启动补学，完成解释、例子和微型验证；
6. 验证通过后状态更新为已有验证；
7. 刷新页面，证据、补学历史和状态恢复；
8. AI 接口失败时，模板补学仍可完成；
9. 补学面板开关前后 Interactive iframe 状态不丢失；
10. 课程结束后报告与路径状态一致；
11. 关闭 Feature Flag 后回到现有课堂；
12. Workspace pane 与移动端无关键操作遮挡。

### 12.4 AI 评测 rubric

每个样例按 0–2 分评分：

| 维度 | 0 分 | 1 分 | 2 分 |
| --- | --- | --- | --- |
| 依据一致 | 脱离或误读证据 | 部分相关 | 明确针对触发证据 |
| 概念准确 | 有事实错误 | 基本正确但含混 | 准确且与课程一致 |
| 难度适配 | 过难/过易 | 可用 | 明显降低理解门槛 |
| 步骤合规 | 超限或缺验证 | 结构勉强可用 | 1–3 步且包含可判定验证 |
| 可解释性 | 无理由 | 理由泛化 | 理由引用具体证据 |

任何“概念准确”为 0 的样例判定整体失败，不以总分抵消。

---

## 13. 风险与应对

| 风险 | 表现 | 应对 |
| --- | --- | --- |
| 伪精确 | 用户把状态当成绩 | 禁用百分比，展示证据和限制说明 |
| 事件重复 | 刷新/重试导致状态偏差 | deterministic eventId + fold 去重 |
| AI 幻觉 | 补学内容偏离课程 | 受控上下文、结构校验、模板降级、评测集 |
| 数据串 learner | 匿名与登录切换后混乱 | 复用 learnerKey 与 merge 契约，增加集成测试 |
| UI 过载 | 路径上 badge、提示过多 | 默认只显示状态，证据放抽屉，补学按需展开 |
| 性能回退 | 每次渲染扫描全部 records | session 级缓存、增量 fold、memoized selector |
| 课程协议膨胀 | 过早修改 Stage DSL | MVP 采用可重建的派生模型 |
| 旧课程失效 | 无 Outline 或 legacy 内容报错 | 全路径降级，Feature Flag 可回退 |
| 把参与当理解 | 访问、聊天被误算为掌握 | 弱证据永不单独触发 verified |
| 补学打断主线 | 用户失去播放位置或草稿 | overlay UI，不卸载 renderer，不改 Scene 数组 |

---

## 14. 停止条件与决策门

出现以下任一情况时暂停扩大范围，先修正基础问题：

- 存在跨 learner 的证据泄漏；
- Stage 删除后无法可靠清除学习证据；
- 重复事件导致状态不可解释；
- 旧课程在关闭开关后仍受影响；
- AI 输出绕过 Schema 或错误引用构件；
- 补学 UI 导致 Quiz 草稿、Interactive 或播放状态丢失；
- 10% 灰度中关键性能或错误率超过当前基线的可接受范围；
- 用户测试中多数用户把“已有验证”误解为正式成绩。

进入 Phase 6 前必须同时满足：

- 核心闭环稳定运行；
- 至少一类触发证据证明补学路径有实际使用；
- 用户能够理解状态与证据的关系；
- AI 降级率和错误率可观测；
- 团队确认扩展项解决的是已验证需求，而非只增加展示复杂度。

---

## 15. Definition of Done

MVP 完成必须同时满足：

- 新功能由默认关闭的 Feature Flag 控制；
- 旧课程无需迁移即可正常使用；
- 知识构件可稳定派生并展示；
- Quiz review 和用户显式困惑能产生幂等证据；
- 状态由纯函数从不可变证据派生；
- 每个状态都可以解释“为什么”；
- needs_revisit 可启动最多三步补学；
- AI 失败时存在完整的模板降级；
- 再验证可以更新状态；
- 结课报告只陈述有证据支持的结论；
- learner 合并、Stage 删除、刷新恢复均通过测试；
- 单元、集成、E2E 和 AI eval 全部达到发布门槛；
- 有埋点、监控、灰度和回滚方案；
- 文档同步更新数据契约与用户可见行为。

---

## 16. 启动清单

开始实施时，建议按以下顺序创建首批任务：

1. `LL-001` Runtime kind 兼容性审计；
2. `LL-002/003` 删除与 learner 合并契约测试；
3. `LL-006` 双 Feature Flag；
4. `LL-101/102` 类型与知识模型 builder；
5. `LL-204` 先以纯函数实现状态引擎测试表；
6. `LL-201/202/203` 接入 journey runtime；
7. `LL-206` 只接 Quiz reviewed，形成第一条端到端证据链。

第一个可演示里程碑不是 AI 补学，而应是：

> 用户完成一次 Quiz review 后，知识路径中的对应构件状态发生可解释变化；刷新页面后状态仍然存在，并且点击状态可以看到证据来源。

这个里程碑通过后，再进入补学生成，可以显著降低“AI 界面已完成、证据基础仍不可靠”的项目风险。
