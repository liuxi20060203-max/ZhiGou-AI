<p align="center">
  <img src="public/brand/logo-horizontal.svg" alt="ZhiGou AI" width="360"/>
</p>

<h1 align="center">ZhiGou AI · 知构 AI</h1>

<p align="center">
  AI-powered course design and immersive interactive classrooms
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README-zh.md">简体中文</a>
</p>

## About

ZhiGou AI is a university innovation project for turning a topic or a set of learning materials into an interactive AI course. It combines course planning, multi-format lesson generation, AI-guided classroom playback, quizzes, simulations, project-based learning, whiteboard interaction, and course export in one workflow.

The current project focuses on a complete and reliable demonstration experience for student innovation programs and competitions. Its product identity, information hierarchy, visual system, course-planning experience, and classroom interface have been redesigned around the ZhiGou AI brand.

## Product Workflow

```text
Topic or learning materials
        ↓
AI course plan
        ↓
Slides · Quizzes · Interactive content · PBL
        ↓
AI interactive classroom
        ↓
Edit · Review · Export
```

## Core Features

- **AI course creation** — Build a structured lesson from a prompt or uploaded materials.
- **Course plan review** — Review, reorder, and refine the outline before generating the classroom.
- **Multiple learning formats** — Combine slides, quizzes, interactive simulations, and project-based learning.
- **AI classroom** — Learn with AI teachers and classmates through narration, discussion, and guided interaction.
- **Playback progress** — Track course-level and video-level progress while navigating lesson scenes.
- **Teaching tools** — Use whiteboard, speech, media, and in-class interactions during playback.
- **Course management** — Reopen, organize, edit, import, and export generated courses.
- **Responsive themes** — Use the interface on desktop and mobile in light or dark mode.

## Project Scope

ZhiGou AI currently prioritizes:

- independent brand and visual identity;
- course space, course creation, course planning, and classroom experience;
- stable reuse of the existing generation and playback capabilities;
- low-risk UI changes with automated regression checks.

Full school administration, class rosters, grading, LMS integration, and complex role permissions are outside the current phase.

The UI refactoring boundary is documented in [ZHIGOU_UI_PROTECTION_BOUNDARY.md](ZHIGOU_UI_PROTECTION_BOUNDARY.md).

## Quick Start

### Requirements

- Node.js 22.19.0 or later
- pnpm
- At least one supported LLM provider API key

### Install

```bash
git clone https://github.com/liuxi20060203-max/ZhiGou-AI.git
cd ZhiGou-AI
pnpm install
```

### Configure

Copy the environment template and configure only the providers you need:

```bash
cp .env.example .env.local
```

For example:

```env
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=
OPENAI_MODELS=
```

The project also supports other LLM, image, video, speech, document-parsing, search, and storage providers. See [`.env.example`](.env.example) for the complete configuration list.

Never commit `.env.local`, API keys, access tokens, or private course materials.

### Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). If the port is occupied, Next.js may select another available port.

### Production Build

```bash
pnpm build
pnpm start
```

## Quality Checks

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
```

Run the core UI regression suite after changing the home page, generation flow, or classroom:

```bash
pnpm test:e2e:ui-guard
```

## Technology

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Vitest and Playwright
- OpenMAIC generation, classroom, playback, and multi-agent capabilities

Internal `@openmaic/*` package names are retained for compatibility with the upstream architecture. They are technical dependency identifiers, not the ZhiGou AI product name.

## Repository Structure

```text
app/          Pages, routes, and API endpoints
components/   Product and classroom UI components
lib/          Shared logic, configuration, storage, and i18n
packages/     Internal and third-party workspace packages
public/brand/ ZhiGou AI logos and application icons
e2e/          End-to-end tests
tests/        Unit and integration tests
```

## Contributing and Security

- Development workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security reporting: [SECURITY.md](SECURITY.md)
- UI protection boundary: [ZHIGOU_UI_PROTECTION_BOUNDARY.md](ZHIGOU_UI_PROTECTION_BOUNDARY.md)

## Open-Source Attribution

ZhiGou AI is a secondary development based on [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC). The project retains the original copyright notices, MIT license, package licenses, and required attribution.

ZhiGou AI adds its own brand identity, product presentation, course workflow, classroom UI, responsive experience, and related tests. This project is not affiliated with or endorsed by THU-MAIC.

See [NOTICE](NOTICE) for the detailed attribution statement.

## License

The repository is distributed under the [MIT License](LICENSE). Some bundled workspace packages retain their own licenses; those terms continue to apply to their respective files.
