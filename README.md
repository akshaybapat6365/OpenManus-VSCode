# OpenManus VS Code Extension

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/akshaybapat/OpenManus-VSCode/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A VS Code extension that integrates OpenManus AI tools with your development environment, providing task management and checkpoint capabilities to streamline your workflow.

## Features

- **Task Management**: Create, organize, and track development tasks
- **Workspace Checkpoints**: Save and restore workspace states at different points in time
- **AI Integration**: Uses Claude 3.7 Sonnet for intelligent task analysis and management
- **MCP Protocol**: Communication bridge with OpenManus AI tools

## Installation

### Option 1: Direct Download

Download the VSIX file directly from the [GitHub Releases page](https://github.com/akshaybapat/OpenManus-VSCode/releases/latest/download/openmanus-vscode-0.1.0.vsix).

### Option 2: Manual Installation

1. Download the `.vsix` file from the [Releases page](https://github.com/akshaybapat/OpenManus-VSCode/releases)
2. Open VS Code
3. Go to Extensions view (Ctrl+Shift+X / Cmd+Shift+X)
4. Click on the "..." menu at the top of the Extensions view
5. Select "Install from VSIX..."
6. Navigate to the downloaded `.vsix` file and select it

## Configuration

1. After installation, open the Settings page (File > Preferences > Settings)
2. Search for "OpenManus"
3. Configure the following settings:
   - `openManus.pythonPath`: Path to the Python executable for OpenManus
   - `openManus.openManusPath`: Path to your OpenManus installation
   - `openManus.apiKey`: Your Anthropic API key for Claude
   - `openManus.checkpoints.location`: (Optional) Custom location to store workspace checkpoints

## Usage

### Commands

The extension provides several commands through the Command Palette (Ctrl+Shift+P / Cmd+Shift+P):

- **OpenManus: Open Panel** - Opens the main OpenManus panel
- **OpenManus: Create New Task** - Create a new task
- **OpenManus: Generate Tasks from PRD** - Generate tasks from a PRD document
- **OpenManus: Get Next Task** - Identify the next task to work on
- **OpenManus: Analyze Task Complexity** - Analyze the complexity of current tasks
- **OpenManus: Create Workspace Checkpoint** - Save the current state of your workspace
- **OpenManus: List Workspace Checkpoints** - View and manage saved checkpoints
- **OpenManus: Restore Workspace Checkpoint** - Restore a previously saved checkpoint

## Development

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/akshaybapat/OpenManus-VSCode.git
   cd OpenManus-VSCode
   ```

2. Install dependencies:
   ```bash
   npm install
   cd webview-ui && npm install && cd ..
   ```

3. Build the extension:
   ```bash
   npm run package
   ```

4. Package as VSIX:
   ```bash
   npx vsce package
   ```

## Requirements

- VS Code 1.80.0 or higher
- Node.js 16.x or higher
- OpenManus installation (for full functionality)

## License

MIT 