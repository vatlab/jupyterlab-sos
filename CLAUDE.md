# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `jlpm build` (development) or `jlpm build:prod` (production)
- **Watch mode**: `jlpm watch` (auto-rebuild on changes)
- **Lint**: `jlpm lint` (runs stylelint, prettier, and eslint)
- **Type check**: TypeScript compilation via `jlpm build:lib`
- **Test**: `jlpm test` (Jest tests)
- **Clean**: `jlpm clean` or `jlpm clean:all`

## Project Architecture

This is a JupyterLab extension that adds SoS (Script of Scripts) workflow engine support to JupyterLab notebooks, enabling polyglot programming across multiple languages.

### Core Components

**Main Entry Point** (`src/index.ts`):

- Registers the SoS JupyterLab extension plugin
- Sets up communication with SoS kernels via Jupyter comms
- Handles workflow and task status updates
- Manages cell kernel switching and language selection

**Key Modules**:

- `src/manager.ts`: Central manager for tracking notebooks, comms, and kernel information
- `src/execute.ts`: Wraps notebook and console executors to integrate with SoS
- `src/codemirror-sos.ts`: CodeMirror syntax highlighting for SoS language
- `src/selectors.ts`: UI components for kernel selection and cell styling

### Communication Architecture

The extension uses Jupyter's comm system to communicate between frontend and SoS kernel:

- `sos_comm`: Main communication channel for kernel lists, cell execution, workflow status
- Frontend receives messages for: workflow status, task status, kernel updates, cell styling
- Frontend sends messages for: kernel changes, workflow cancellation, task actions

### Cell Management

Each notebook cell can have different kernels (Python, R, Julia, etc.) while maintaining a single SoS session:

- Cell metadata stores kernel information
- Dynamic kernel switching without changing the underlying session
- Visual indicators show which language/kernel each cell uses

### Workflow Features

- Real-time workflow and task status tracking with interactive tables
- Task management UI with controls for status, execution, termination, and cleanup
- Progress indicators and timing information
- Support for distributed task execution across different queues

## Development Setup

1. Install in development mode: `pip install -e "."`
2. Link extension: `jupyter labextension develop . --overwrite`
3. Build: `jlpm build`
4. Start JupyterLab: `jupyter lab`

For active development, use watch mode in a separate terminal: `jlpm watch`

## Testing

- **Unit tests**: Jest framework (`jlpm test`)
- **Integration tests**: Playwright tests in `ui-tests/` directory
- Install dependencies first: `jlpm` before running tests

## Code Style

- ESLint configuration enforces TypeScript best practices
- Prettier for code formatting
- Stylelint for CSS
- Interface naming convention: Must start with 'I' followed by PascalCase
- Single quotes preferred, no trailing commas

The extension integrates deeply with JupyterLab's architecture, particularly the notebook, cell, and kernel systems. Understanding JupyterLab's plugin system and Lumino widgets is essential for modifications.
