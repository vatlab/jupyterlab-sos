"""
Invoke tasks for JupyterLab SoS Extension development.

Common usage:
    inv --list          # List all available tasks
    inv setup           # Initial development setup
    inv build           # Build the extension
    inv lint            # Run all linting with auto-fix
    inv format          # Format code with Prettier
    inv test            # Run tests
    inv clean           # Clean build artifacts
    inv watch           # Start watch mode for development
"""

from invoke import task
import sys
from pathlib import Path
import os

# Get the project root directory (where this tasks.py file is located)
PROJECT_ROOT = Path(__file__).parent.resolve()


@task
def setup(c):
    """Initial development setup: install dependencies and build extension."""
    with c.cd(PROJECT_ROOT):
        print("🔧 Setting up development environment...")

        # Install Node.js dependencies
        print("📦 Installing Node.js dependencies...")
        c.run("jlpm install")

        # Fix TypeScript compatibility if needed
        print("🔧 Ensuring TypeScript compatibility...")
        c.run("jlpm add @types/node@~20.0.0")

        # Build the extension
        print("🏗️  Building extension...")
        c.run("jlpm build")

        # Install Python package in development mode
        print("🐍 Installing Python package...")
        c.run("pip install -e .")

        print("✅ Setup complete! You can now run 'inv watch' for development.")


@task
def build(c, prod=False):
    """Build the extension (use --prod for production build)."""
    with c.cd(PROJECT_ROOT):
        if prod:
            print("🏗️  Building extension (production)...")
            c.run("jlpm build:prod")
        else:
            print("🏗️  Building extension (development)...")
            c.run("jlpm build")


@task
def build_lib(c, prod=False):
    """Build only the TypeScript library."""
    with c.cd(PROJECT_ROOT):
        if prod:
            print("📚 Building TypeScript library (production)...")
            c.run("jlpm build:lib:prod")
        else:
            print("📚 Building TypeScript library (development)...")
            c.run("jlpm build:lib")


@task
def watch(c):
    """Start watch mode for development (auto-rebuild on changes)."""
    with c.cd(PROJECT_ROOT):
        print("👀 Starting watch mode...")
        print("💡 Open JupyterLab in another terminal with: jupyter lab")
        print("💡 Press Ctrl+C to stop watching")
        c.run("jlpm watch")


@task
def lint(c, fix=False, check=False):
    """Run all linting (ESLint, Prettier, Stylelint).

    Default behavior: Run with auto-fix enabled.
    --check: Only check for issues without fixing
    --fix: Explicitly run with auto-fix (same as default)
    """
    with c.cd(PROJECT_ROOT):
        if fix:
            print("🔧 Running linting with auto-fix...")
            try:
                c.run("jlpm lint")
                print("✅ All linting issues fixed!")
            except Exception as e:
                print("❌ Some linting issues could not be auto-fixed.")
                print("   Run 'inv lint --check' to see remaining issues.")
                raise
        elif check:
            print("🔍 Running linting checks only...")
            try:
                c.run("jlpm lint:check")
                print("✅ No linting issues found!")
            except Exception:
                print("❌ Linting issues found. Run 'inv lint --fix' to auto-fix them.")
                raise
        else:
            # Default behavior: try to fix, then check
            print("🔧 Running linting with auto-fix...")
            try:
                c.run("jlpm lint")
                print("✅ All linting completed successfully!")
            except Exception:
                print("❌ Some linting issues remain after auto-fix.")
                print("   Please review and fix manually, or check the output above.")
                raise


@task
def lint_eslint(c, fix=False):
    """Run ESLint on TypeScript files."""
    with c.cd(PROJECT_ROOT):
        if fix:
            print("🔧 Running ESLint with auto-fix...")
            c.run("jlpm eslint")
        else:
            print("🔍 Running ESLint checks...")
            c.run("jlpm eslint:check")


@task
def lint_prettier(c, fix=False):
    """Run Prettier on all files."""
    with c.cd(PROJECT_ROOT):
        if fix:
            print("🎨 Running Prettier with auto-fix...")
            c.run("jlpm prettier")
        else:
            print("🔍 Running Prettier checks...")
            c.run("jlpm prettier:check")


@task
def lint_stylelint(c, fix=False):
    """Run Stylelint on CSS files."""
    with c.cd(PROJECT_ROOT):
        if fix:
            print("🎨 Running Stylelint with auto-fix...")
            c.run("jlpm stylelint")
        else:
            print("🔍 Running Stylelint checks...")
            c.run("jlpm stylelint:check")


@task
def format(c):
    """Format all source code with Prettier."""
    with c.cd(PROJECT_ROOT):
        print("🎨 Formatting code with Prettier...")
        c.run("jlpm prettier")
        print("✅ Code formatting complete!")


@task
def format_check(c):
    """Check if source code is properly formatted with Prettier."""
    with c.cd(PROJECT_ROOT):
        print("🔍 Checking code formatting with Prettier...")
        try:
            c.run("jlpm prettier:check")
            print("✅ All files are properly formatted!")
        except Exception:
            print("❌ Some files need formatting. Run 'inv format' to fix.")
            raise


@task
def test(c, coverage=False):
    """Run Jest unit tests."""
    with c.cd(PROJECT_ROOT):
        if coverage:
            print("🧪 Running tests with coverage...")
            c.run("jlpm test --coverage")
        else:
            print("🧪 Running tests...")
            c.run("jlpm test")


@task
def test_integration(c):
    """Run Playwright integration tests."""
    with c.cd(PROJECT_ROOT):
        print("🧪 Running integration tests...")
        with c.cd("ui-tests"):
            c.run("jlpm test")


@task
def clean(c, all=False):
    """Clean build artifacts."""
    with c.cd(PROJECT_ROOT):
        if all:
            print("🧹 Cleaning all build artifacts...")
            c.run("jlpm clean:all")
        else:
            print("🧹 Cleaning TypeScript build...")
            c.run("jlpm clean:lib")


@task
def clean_lib(c):
    """Clean only TypeScript build artifacts."""
    with c.cd(PROJECT_ROOT):
        print("🧹 Cleaning TypeScript build...")
        c.run("jlpm clean:lib")


@task
def clean_labextension(c):
    """Clean only lab extension build artifacts."""
    with c.cd(PROJECT_ROOT):
        print("🧹 Cleaning lab extension build...")
        c.run("jlpm clean:labextension")


@task
def clean_cache(c):
    """Clean lint caches."""
    with c.cd(PROJECT_ROOT):
        print("🧹 Cleaning lint caches...")
        c.run("jlpm clean:lintcache")


@task
def install_deps(c):
    """Install/update Node.js dependencies."""
    with c.cd(PROJECT_ROOT):
        print("📦 Installing Node.js dependencies...")
        c.run("jlpm install")


@task
def install_python(c):
    """Install Python package in development mode."""
    with c.cd(PROJECT_ROOT):
        print("🐍 Installing Python package...")
        c.run("pip install -e .")


@task
def link_extension(c):
    """Link extension for development with JupyterLab."""
    with c.cd(PROJECT_ROOT):
        print("🔗 Linking extension with JupyterLab...")
        c.run("jupyter labextension develop . --overwrite")


@task
def unlink_extension(c):
    """Unlink extension from JupyterLab."""
    with c.cd(PROJECT_ROOT):
        print("🔗 Unlinking extension from JupyterLab...")
        c.run("pip uninstall jupyterlab_sos")


@task
def status(c):
    """Show project status and installed extensions."""
    with c.cd(PROJECT_ROOT):
        print("📊 Project Status")
        print("=" * 50)

        # Check if Node.js dependencies are installed
        if Path("node_modules").exists():
            print("✅ Node.js dependencies: Installed")
        else:
            print("❌ Node.js dependencies: Not installed (run 'inv install-deps')")

        # Check if TypeScript build exists
        if Path("lib").exists():
            print("✅ TypeScript build: Available")
        else:
            print("❌ TypeScript build: Not available (run 'inv build-lib')")

        # Check if lab extension build exists
        if Path("jupyterlab_sos/labextension").exists():
            print("✅ Lab extension build: Available")
        else:
            print("❌ Lab extension build: Not available (run 'inv build')")

        print()
        print("🔗 JupyterLab Extensions:")
        c.run("jupyter labextension list | grep -E '(sos|SoS)' || echo 'No SoS extension found'")


@task
def dev(c):
    """Start full development workflow: build and watch."""
    with c.cd(PROJECT_ROOT):
        print("🚀 Starting development workflow...")

        # Ensure everything is built first
        build(c)

        # Start watch mode
        watch(c)


@task
def release_check(c):
    """Run all checks before release."""
    with c.cd(PROJECT_ROOT):
        print("🚀 Running pre-release checks...")

        # Clean everything first
        clean(c, all=True)

        # Install dependencies
        install_deps(c)

        # Check code formatting
        format_check(c)

        # Run linting with auto-fix
        lint(c, fix=True)

        # Run tests
        test(c, coverage=True)

        # Build for production
        build(c, prod=True)

        print("✅ All pre-release checks passed!")