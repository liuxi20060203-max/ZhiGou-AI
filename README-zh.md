<p align="center">
  <img src="public/brand/logo-horizontal.svg" alt="知构 AI" width="360"/>
</p>

<h1 align="center">知构 AI · ZhiGou AI</h1>

<p align="center">
  用 AI 构建智能课程与沉浸式互动课堂
</p>

<p align="center">
  <a href="./README-zh.md">简体中文</a> · <a href="./README.md">English</a>
</p>

## 项目简介

知构 AI 是面向大学生创新项目打造的智能课程与互动课堂平台，能够将一个主题或一组学习材料转化为结构完整的 AI 课程。平台将课程规划、多形态内容生成、AI 课堂讲解、测验、互动模拟、项目式学习、白板和课程导出整合在同一条使用流程中。

当前项目以大学生创新创业项目和竞赛展示为主要场景，优先保证核心流程完整、运行稳定和视觉呈现统一。项目已经围绕知构 AI 品牌重新设计产品标识、信息层级、视觉规范、课程计划体验和课堂界面。

## 核心流程

```text
输入课程主题或学习材料
          ↓
生成并确认 AI 课程计划
          ↓
生成幻灯片 · 测验 · 互动内容 · PBL
          ↓
进入 AI 互动课堂
          ↓
编辑 · 复习 · 导出
```

## 核心能力

- **AI 创建课程**：根据主题描述或上传材料生成结构化课程。
- **课程计划确认**：生成课堂前查看、排序和调整课程大纲。
- **多形态教学内容**：组合幻灯片、测验、互动模拟和项目式学习。
- **AI 互动课堂**：由 AI 教师和 AI 同学完成讲解、讨论和引导互动。
- **学习进度反馈**：提供课程级进度和视频播放进度，支持场景切换。
- **课堂教学工具**：提供白板、语音、媒体和课堂互动能力。
- **课程空间**：重新打开、整理、编辑、导入和导出已有课程。
- **响应式与主题**：适配桌面端、移动端、浅色和深色界面。

## 当前开发范围

知构 AI 当前阶段重点包括：

- 独立品牌与统一视觉系统；
- 课程空间、创建课程、课程计划和互动课堂体验；
- 稳定复用已有的课程生成与课堂运行能力；
- 通过自动化回归保障低风险 UI 改造。

完整教务管理、教学班、成绩管理、LMS 接入和复杂角色权限不属于当前阶段。

UI 重构边界详见 [ZHIGOU_UI_PROTECTION_BOUNDARY.md](ZHIGOU_UI_PROTECTION_BOUNDARY.md)。

## 快速开始

### 环境要求

- Node.js 22.19.0 或更高版本
- pnpm
- 至少配置一个受支持的大语言模型服务

### 安装项目

```bash
git clone https://github.com/liuxi20060203-max/ZhiGou-AI.git
cd ZhiGou-AI
pnpm install
```

### 配置环境

复制环境变量模板，并只配置实际需要的服务：

```bash
cp .env.example .env.local
```

示例：

```env
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=
OPENAI_MODELS=
```

项目还支持其他大语言模型、图像、视频、语音、文档解析、联网搜索和存储服务，完整配置见 [`.env.example`](.env.example)。

请勿提交 `.env.local`、API Key、访问令牌或包含隐私信息的课程材料。

### 启动开发环境

```bash
pnpm dev
```

默认访问 [http://localhost:3000](http://localhost:3000)。如果端口被占用，Next.js 可能自动选择其他可用端口。

### 生产环境构建

```bash
pnpm build
pnpm start
```

## 质量检查

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
```

修改首页、课程生成流程或课堂后，运行核心 UI 回归测试：

```bash
pnpm test:e2e:ui-guard
```

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Vitest 与 Playwright
- OpenMAIC 的课程生成、课堂运行、播放和多智能体能力

为保持与上游架构兼容，项目内部继续使用 `@openmaic/*` 包名。这些属于技术依赖标识，不是知构 AI 的产品名称。

## 项目结构

```text
app/          页面、路由与 API
components/   产品界面与课堂组件
lib/          公共逻辑、配置、存储与国际化
packages/     内部及第三方工作区包
public/brand/ 知构 AI Logo 与应用图标
e2e/          端到端测试
tests/        单元测试与集成测试
```

## 参与开发与安全反馈

- 开发规范：[CONTRIBUTING.md](CONTRIBUTING.md)
- 安全问题反馈：[SECURITY.md](SECURITY.md)
- UI 重构保护边界：[ZHIGOU_UI_PROTECTION_BOUNDARY.md](ZHIGOU_UI_PROTECTION_BOUNDARY.md)

## 开源归属

知构 AI 基于 [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) 进行二次开发，保留了原项目版权声明、MIT 许可证、各工作区包许可证以及必要的开源归属。

知构 AI 在其基础上完成了独立品牌、产品呈现、课程工作流、课堂 UI、响应式体验和相关测试。本项目与 THU-MAIC 不存在隶属或官方认可关系。

详细归属说明见 [NOTICE](NOTICE)。

## 许可证

本仓库按照 [MIT License](LICENSE) 分发。部分内置工作区包保留各自许可证，对应文件继续适用其原有许可条款。
