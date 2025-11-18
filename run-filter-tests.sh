#!/bin/bash

# Script to run filter tests in a Docker container with Nix
# This script handles the complete test execution for the Prisma-style WHERE clause filtering

set -e

echo "========================================="
echo "Prisma-Style Filter Tests - Docker + Nix"
echo "========================================="
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✓ Docker found: $(docker --version)"
echo ""

# Get the absolute path to the workspace
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📂 Workspace: $WORKSPACE_DIR"
echo ""

echo "🐳 Starting Docker container with Nix..."
echo ""

# Run Docker with Nix and execute tests
docker run --rm -it \
  -v "$WORKSPACE_DIR:/workspace" \
  -w /workspace \
  nixos/nix:latest \
  sh -c '
    echo "🔧 Configuring Nix with flakes support..."
    mkdir -p ~/.config/nix
    echo "experimental-features = nix-command flakes" > ~/.config/nix/nix.conf
    
    echo ""
    echo "🔨 Entering Nix development shell..."
    nix develop --command sh -c "
      echo \"\"
      echo \"✓ Nix dev environment activated\"
      echo \"\"
      echo \"📦 Installing dependencies with bun...\"
      bun install
      
      echo \"\"
      echo \"🧪 Running filter tests...\"
      echo \"\"
      bun test --testPathPattern=filters
      
      echo \"\"
      echo \"✅ Tests completed!\"
    "
  '

TEST_EXIT_CODE=$?

echo ""
echo "========================================="

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ ALL TESTS PASSED!"
    echo "========================================="
    echo ""
    echo "The Prisma-style WHERE clause filtering implementation"
    echo "has been validated and is ready for use."
else
    echo "❌ TESTS FAILED (Exit code: $TEST_EXIT_CODE)"
    echo "========================================="
    echo ""
    echo "Please review the test output above and fix any issues."
fi

exit $TEST_EXIT_CODE
