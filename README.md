# Diagramwise

Design architectures. Explain the decisions. Improve the design.

Diagramwise is a browser-based system design workspace for practicing architecture interviews and communicating real systems. Build an architecture on an interactive React Flow canvas, record the assumptions behind it, get structured feedback, and revise the design until the trade-offs are clear.

The live application is available at [diagramwise.com](https://diagramwise.com).

## What you can do

### Practice system design

- Browse a catalog of infrastructure, application, data, AI/ML, and MLOps problems.
- Open a problem guide with requirements, constraints, prompts, and architecture context.
- Design the solution visually and keep the reasoning, interview answers, and assessment history with the attempt.
- Run structured assessment, review findings, address them, and retry the problem.
- Follow guided learning paths covering foundations, estimation, networking, storage, scaling, and operations.

### Build and explain architectures

- Start with a blank design, a practice problem, or a custom problem that you create for yourself, a class, or a team.
- Search and filter the component palette by category and cloud provider.
- Configure labels, descriptions, properties, colors, relationships, and custom fields in the inspector.
- Group components into boundaries and clusters, use undo/redo, and auto-layout diagrams with Dagre or ELK-based ERD layout.
- Use the in-editor assistant for contextual suggestions when the supporting API is configured.

The palette contains generic architecture primitives, provider-backed services, AI/ML components, DevOps and observability components, grouping tools, ER diagram elements, UML elements, and custom components. The catalog is intentionally extensible rather than limited to a fixed component count.

### Work with ER diagrams and imported architecture

- Create editable entities, weak entities, views, triggers, notes, use cases, and UML classes.
- Mark primary, foreign-key, and nullable fields and connect relationships using ER-aware handles and cardinality notation.
- Import Mermaid diagrams or common SQL `CREATE TABLE` schemas, including deferred `ALTER TABLE ... FOREIGN KEY` constraints and composite foreign keys.
- Review the import report before replacing the canvas. Recognized elements are matched to the local catalog where possible; unmatched elements remain editable generic nodes.
- Export images as PNG, JPEG, or SVG, and export/import design data as JSON or draw.io-compatible XML.

SQL import supports common PostgreSQL/pgAdmin, MySQL, Oracle, and SQL Server-style syntax. It is a practical schema importer, not a complete parser for every vendor-specific SQL feature.

### Save, share, and collaborate

- Recover work with local autosave and save diagrams to the backend when authenticated.
- Share designs with public links or invite collaborators with read or edit permissions.
- Use application WebSocket collaboration or the optional Yjs collaboration server, depending on the configured feature flags and backend services.
- View saved designs, shared designs, public canvases, progress, and assessment history from the app.

Authentication, cloud persistence, assessment, provider catalogs, analytics, and collaboration require the companion services described below. The local design studio and local import/export workflows can be used without a backend.

## Routes

| Route                         | Purpose                                   |
| ----------------------------- | ----------------------------------------- |
| `/`                           | Product home and entry points             |
| `/problems`                   | Browse system design problems             |
| `/problems/:slug`             | Read a problem guide and start an attempt |
| `/playground/:id`             | Design studio and problem playground      |
| `/create-problem`             | Create a custom problem                   |
| `/learning-paths`             | Browse structured learning paths          |
| `/learning-paths/:slug`       | Work through a learning path              |
| `/diagrams`                   | Manage saved and shared designs           |
| `/public/:id`                 | View a published design                   |
| `/system-design-interview`    | System design interview guide             |
| `/system-design-practice`     | System design practice guide              |
| `/ai-system-design-interview` | AI system design interview guide          |
| `/kubernetes-architecture`    | Kubernetes architecture guide             |

## Tech stack

- React 19 and TypeScript
- Vite 7 for development and production builds
- React Router for client-side routing
- [React Flow](https://reactflow.dev/) for the diagram editor
- Tailwind CSS 4 for styling
- Redux Toolkit and Zustand for application state
- Dagre and ELK.js for graph layout
- Fuse.js for component search
- Yjs and `y-websocket` for the optional collaboration path
- Vitest and ESLint for validation
- Sentry integration for optional frontend error monitoring

## Getting started

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm

### Frontend only

```bash
git clone https://github.com/satya00089/diagrammatic.git
cd diagrammatic
npm install
# macOS/Linux/Git Bash:
cp .env.example .env.local
# PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The frontend can run its local design, canvas, and import/export workflows without the companion services. Add the API and collaboration settings below when you need authenticated or server-backed features.

### Environment variables

The frontend reads Vite variables from `.env.local` or another local environment file:

| Variable                  | Example                                     | Purpose                               |
| ------------------------- | ------------------------------------------- | ------------------------------------- |
| `VITE_API_URL`            | `http://localhost:8000`                     | Main Diagramwise API                  |
| `VITE_ASSESSMENT_API_URL` | `http://localhost:8000`                     | Assessment/API base URL when separate |
| `VITE_YJS_URL`            | `ws://localhost:1234`                       | Optional Yjs WebSocket server         |
| `VITE_GOOGLE_CLIENT_ID`   | `your-client-id.apps.googleusercontent.com` | Google Sign-In client ID              |
| `VITE_SENTRY_DSN`         | _(empty)_                                   | Optional frontend error monitoring    |
| `VITE_APP_VERSION`        | `local`                                     | Client version label used by the app  |

For local development, the usual values are:

```env
VITE_API_URL=http://localhost:8000
VITE_ASSESSMENT_API_URL=http://localhost:8000
VITE_YJS_URL=ws://localhost:1234
```

### Companion services

The frontend integrates with two separate repositories:

1. [diagrammatic-api](https://github.com/satya00089/diagrammatic-api) - FastAPI service for authentication, diagrams, problems, attempts, assessment, interview practice, provider components, learning progress, sharing, analytics, and transcription.
2. [diagrammatic-yjs-server](https://github.com/satya00089/diagrammatic-yjs-server) - optional Yjs CRDT WebSocket server for collaborative editing.

For the API, follow its repository README and configure its `.env` with the required OpenAI, AWS/DynamoDB, and other service settings. A minimal local launch looks like this:

```bash
cd ../diagrammatic-api
python -m venv .venv
# PowerShell:
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

For Yjs collaboration:

```bash
cd ../diagrammatic-yjs-server
npm install
npm run dev
```

The Yjs server listens on `ws://localhost:1234` by default. Production has Yjs collaboration disabled by default; enable it only when the matching server and deployment configuration are available.

## Useful scripts

Run these from the frontend repository:

| Command                   | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `npm run dev`             | Start the Vite development server                          |
| `npm run build`           | Type-check, build, prerender routes, and run the SEO check |
| `npm run preview`         | Serve the production build locally                         |
| `npm run lint`            | Run ESLint                                                 |
| `npm test`                | Run Vitest in watch mode                                   |
| `npm test -- --run`       | Run the test suite once                                    |
| `npm run catalog:check`   | Validate the problem catalog                               |
| `npm run seo:check`       | Run the SEO validation script                              |
| `npm run storybook`       | Start Storybook                                            |
| `npm run build-storybook` | Build the Storybook static site                            |

Before opening a pull request, run the focused checks relevant to your change, then run `npm run lint`, `npm test -- --run`, and `npm run build`.

## Project structure

```text
src/
|-- components/       Reusable UI, canvas nodes, panels, and dialogs
|-- config/            Component catalog, feature flags, environment, and tours
|-- contexts/          Authentication, chatbot, and onboarding providers
|-- data/              Problem summaries and public problem-guide data
|-- hooks/             Canvas, persistence, collaboration, analytics, and UI hooks
|-- pages/             Route-level screens and the main playground
|-- services/          API, persistence, provider, sprite, and transcription clients
|-- store/             Redux store and slices
|-- types/             Shared TypeScript domain types
`-- utils/             Assessment, layout, import/export, and routing utilities
public/                Static assets, learning-path data, and sitemap
scripts/               Build-time image generation, catalog, and SEO checks
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, branch conventions, testing expectations, and design-system guidance.

For new components, problem guides, or import formats, keep the implementation aligned with the existing typed catalog and shared playground architecture. Add focused tests for parser, layout, persistence, or assessment behavior where applicable.

## Links

- [Live application](https://diagramwise.com)
- [Frontend repository](https://github.com/satya00089/diagrammatic)
- [FastAPI backend](https://github.com/satya00089/diagrammatic-api)
- [Yjs collaboration server](https://github.com/satya00089/diagrammatic-yjs-server)
- [Issue tracker](https://github.com/satya00089/diagrammatic/issues)

## License

Diagramwise is released under the [MIT License](LICENSE).
