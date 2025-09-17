# UI Tests for jupyterlab-sos

This directory contains integration tests for the jupyterlab-sos extension using [Playwright](https://playwright.dev) and [Galata](https://github.com/jupyterlab/jupyterlab/tree/master/galata).

## Running Tests

```bash
# Install dependencies
jlpm install

# Install Playwright browsers
jlpm playwright install

# Run tests
jlpm playwright test
```

## Test Structure

- `tests/` - Contains test files
- `playwright.config.js` - Playwright configuration using Galata
- `package.json` - Dependencies and scripts

## Adding Tests

Create new `.spec.ts` files in the `tests/` directory. Tests should use the Galata framework which provides JupyterLab-specific utilities for testing extensions.
