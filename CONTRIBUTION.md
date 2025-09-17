# Contributing to JupyterLab SoS Extension

This guide covers the development workflow for contributing to the JupyterLab SoS extension.

## Prerequisites

- **Node.js**: Required for building the TypeScript extension
- **Python**: For JupyterLab and SoS kernel
- **JupyterLab >= 4.0.0**: The extension targets JupyterLab 4.x

## Development Setup

### Quick Setup with Invoke

We use [Invoke](https://www.pyinvoke.org/) for task automation. For the simplest setup:

```bash
# Clone the repository
git clone https://github.com/vatlab/jupyterlab-sos.git
cd jupyterlab-sos

# One-command setup (installs dependencies, builds, and links extension)
inv setup

# Start development mode
inv watch
```

### Manual Setup

If you prefer manual control over each step:

#### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/vatlab/jupyterlab-sos.git
cd jupyterlab-sos

# Install Node.js dependencies first
jlpm install
# OR: inv install-deps

# Fix TypeScript compilation compatibility (if needed)
jlpm add @types/node@~20.0.0
```

#### 2. Initial Build

```bash
# Build the extension first
jlpm build
# OR: inv build
```

#### 3. Install Python Package

```bash
# Install Python package in development mode
pip install -e "."
# OR: inv install-python

# Alternative: Link your development version with JupyterLab
# jupyter labextension develop . --overwrite
# OR: inv link-extension
```

## Development Workflow

### Invoke Commands

We provide comprehensive Invoke tasks for all common development operations:

```bash
# List all available tasks
inv --list

# Development workflow
inv setup          # Initial setup (install deps + build + link)
inv watch           # Watch mode for development
inv build           # Build extension (add --prod for production)
inv dev             # Build + start watch mode

# Code quality
inv lint            # Run linting with auto-fix (default behavior)
inv lint --fix      # Run linting with auto-fix (explicit)
inv lint --check    # Check linting without fixing
inv lint-eslint     # Run only ESLint (add --fix to auto-fix)
inv lint-prettier   # Run only Prettier (add --fix to auto-fix)
inv lint-stylelint  # Run only Stylelint (add --fix to auto-fix)
inv format          # Format code with Prettier
inv format-check    # Check if code is properly formatted

# Testing
inv test            # Run Jest tests (add --coverage for coverage)
inv test-integration # Run Playwright integration tests

# Cleaning
inv clean           # Clean TypeScript build (add --all for everything)
inv clean-lib       # Clean only TypeScript build
inv clean-cache     # Clean lint caches

# Utilities
inv status          # Show project status
inv release-check   # Run all pre-release checks
```

### Watch Mode Development

For active development, use watch mode to automatically rebuild on changes:

```bash
# Using invoke (recommended)
inv watch

# OR manually
jlpm watch
```

Open JupyterLab in another terminal: `jupyter lab`

With watch mode running, changes to TypeScript files will automatically trigger rebuilds. Refresh your browser to see changes (may take a few seconds for rebuild to complete).

### Manual Build Commands

```bash
# Using invoke
inv build           # Development build
inv build --prod    # Production build
inv build-lib       # Build only TypeScript library

# OR manually
jlpm build          # Development build (with source maps)
jlpm build:prod     # Production build (optimized)
jlpm build:lib      # Build only TypeScript library
jlpm build:labextension # Build only the lab extension
```

### Code Quality

```bash
# Using invoke (recommended)
inv format          # Format code with Prettier
inv format-check    # Check code formatting
inv lint            # Run linting with auto-fix (default)
inv lint --check    # Check linting without fixing
inv lint --fix      # Run linting with auto-fix (explicit)

# OR manually
jlpm prettier       # Format code with Prettier
jlpm prettier:check # Check code formatting
jlpm lint           # Run all linting (stylelint + prettier + eslint)
jlpm lint:check     # Check linting without fixing
```

### Testing

#### Frontend Tests

```bash
# Using invoke
inv test            # Run Jest unit tests
inv test --coverage # Run tests with coverage

# OR manually
jlpm test           # Run Jest unit tests
jlpm test --coverage # Run tests with coverage
```

#### Integration Tests

```bash
# Using invoke
inv test-integration # Run Playwright integration tests

# OR manually
cd ui-tests
jlpm install        # Install Playwright dependencies (first time only)
jlpm playwright install
jlpm test           # Run integration tests
```

See `ui-tests/README.md` for detailed integration testing instructions.

## Code Architecture Guidelines

### TypeScript Development

- Follow the existing ESLint configuration
- Use single quotes for strings
- Interface names must start with 'I' (e.g., `INotebookModel`)
- Avoid `any` types where possible
- Enable strict type checking for new code

### Key Development Areas

1. **Cell Management** (`src/selectors.ts`): Language selectors, cell styling
2. **Communication** (`src/index.ts`): Jupyter comm handling, message processing
3. **Execution** (`src/execute.ts`): Notebook and console execution wrappers
4. **Syntax Highlighting** (`src/codemirror-sos.ts`): SoS language support

### Testing New Features

1. **Unit Tests**: Add Jest tests for utility functions and isolated components
2. **Manual Testing**:
   - Test with different kernels (Python, R, etc.)
   - Verify workflow status updates
   - Check cell kernel switching
   - Test task management UI

## Cleaning and Troubleshooting

### Clean Build

```bash
# Using invoke
inv clean           # Clean TypeScript build
inv clean --all     # Clean all build artifacts
inv clean-lib       # Clean only TypeScript build
inv clean-cache     # Clean lint caches

# OR manually
jlpm clean:all      # Clean all build artifacts
jlpm clean:lib      # Clean only TypeScript build
jlpm clean:labextension # Clean only lab extension build
jlpm clean:lintcache # Clean lint caches
```

### Development Issues

1. **TypeScript compilation errors**:
   - Install compatible @types/node: `jlpm add @types/node@~20.0.0`
   - Ensure `"skipLibCheck": true` is set in `tsconfig.json`
2. **pip install -e . fails**:
   - Install Node.js dependencies first: `jlpm install`
   - Build the extension first: `jlpm build`
   - Then run `pip install -e .`
3. **Extension not loading**: Try `jupyter labextension list` to verify installation
4. **Changes not reflecting**: Ensure watch mode is running or rebuild manually
5. **TypeScript errors**: Run `jlpm build:lib` to see detailed compilation errors
6. **Jupyter issues**: Restart JupyterLab after major changes

### Debugging

- Use browser dev tools for frontend debugging
- Check JupyterLab logs in terminal for server-side issues
- Enable source maps with development builds for easier debugging

## Submission Guidelines

### Before Submitting

1. **Run full test suite**:

   ```bash
   # Using invoke (recommended)
   inv release-check

   # OR manually
   jlpm lint
   jlpm test
   jlpm build:prod
   ```

2. **Test manually**:
   - Create a notebook with multiple language cells
   - Test workflow execution and status updates
   - Verify kernel switching works correctly

3. **Check for breaking changes**:
   - Test with existing SoS notebooks
   - Verify backward compatibility

### Pull Request Process

1. Fork the repository
2. Create a feature branch from `master`
3. Make your changes following the development workflow
4. Ensure all tests pass and linting is clean
5. Submit a pull request to the `master` branch

## Additional Resources

- [JupyterLab Extension Developer Guide](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html)
- [SoS Documentation](https://vatlab.github.io/sos-docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
