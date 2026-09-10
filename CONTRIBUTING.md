# Contributing to ZhiGou AI

感谢你关注知构 AI。当前仓库主要用于大学生创新项目的开发、展示与迭代，欢迎通过 Issue 和 Pull Request 提交问题或改进。

## 开始开发

运行环境：

- Node.js 22.19.0 或更高版本；
- pnpm；
- 根据 [`.env.example`](.env.example) 配置本地 `.env.local`。

```bash
git clone https://github.com/liuxi20060203-max/ZhiGou-AI.git
cd ZhiGou-AI
pnpm install
pnpm dev
```

请勿提交 `.env.local`、API Key、访问令牌、数据库凭据或包含个人信息的测试数据。

## 开发流程

1. 从最新的 `main` 创建独立分支；
2. 一个分支只处理一个明确问题；
3. UI 修改附带前后对比截图；
4. 提交前完成相关自动化测试和人工核心流程检查；
5. 通过 Pull Request 合并到 `main`。

推荐使用以下分支前缀：

- `feat/`：功能或体验增强；
- `fix/`：问题修复；
- `docs/`：文档修改；
- `chore/`：工程维护。

提交信息采用 Conventional Commits，例如：

```text
feat(classroom): improve playback progress
fix(ui): align dark theme colors
docs: update project guide
```

## 修改边界

进行界面和品牌开发前，请先阅读 [`ZHIGOU_UI_PROTECTION_BOUNDARY.md`](ZHIGOU_UI_PROTECTION_BOUNDARY.md)。

- UI、布局、品牌资源和用户可见文案可以按设计方案调整；
- 修改课程生成、课堂运行、存储、导入导出或 `@openmaic/*` 包前，必须先评估调用方和兼容性；
- 不得为了视觉改造复制或重写已有的生成、播放和持久化逻辑；
- 必须保留 OpenMAIC 和其他第三方组件的许可证及版权声明。

## 提交前检查

根据改动范围运行以下检查：

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
```

涉及首页、课程生成或课堂交互时，还应运行对应 Playwright 测试：

```bash
pnpm test:e2e:ui-guard
```

如果项目已有与本次修改无关的警告，请在 Pull Request 中如实记录，不要顺手扩大修改范围。

## 问题反馈

- 普通缺陷和功能建议：在本仓库创建 Issue；
- 安全漏洞：按照 [`SECURITY.md`](SECURITY.md) 私下报告，不要公开漏洞细节；
- 如果问题可以在未修改的 OpenMAIC 上复现，可同时参考[上游项目](https://github.com/THU-MAIC/OpenMAIC)，但请避免重复或公开提交敏感信息。

## 许可证

提交贡献即表示你同意该贡献按本仓库的 [MIT License](LICENSE) 发布，并保留 [`NOTICE`](NOTICE) 中列出的上游归属。
