import * as vscode from 'vscode';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { OpenManusPanel } from './panels/OpenManusPanel';
import { TaskManager } from './tasks/TaskManager';
import { CheckpointManager } from './checkpoints/CheckpointManager';
import { OpenManusProcess, type OpenManusOptions } from './process/OpenManusProcess';

let taskManager: TaskManager;
let checkpointManager: CheckpointManager;
let openManusProcess: OpenManusProcess | undefined;

/**
 * Activates the extension
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('OpenManus extension is now active');
  
  // Initialize the task manager
  taskManager = new TaskManager(context);
  
  // Initialize checkpoint manager
  try {
    checkpointManager = new CheckpointManager(context);
    await checkpointManager.initialize();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to initialize checkpoint manager: ${error}`);
  }
  
  // Initialize OpenManus process
  initializeOpenManusProcess();
  
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('openManus.openPanel', () => {
      OpenManusPanel.createOrShow(context.extensionUri, taskManager, openManusProcess);
    }),

    vscode.commands.registerCommand('openManus.newTask', async () => {
      const prompt = await vscode.window.showInputBox({
        placeHolder: 'Enter task description',
        prompt: 'Create a new task for OpenManus'
      });

      if (prompt) {
        await taskManager.addTask({ prompt });
        vscode.window.showInformationMessage('Task created successfully');
      }
    }),

    vscode.commands.registerCommand('openManus.createCheckpoint', async () => {
      const name = await vscode.window.showInputBox({
        placeHolder: 'Enter checkpoint name',
        prompt: 'Create a new workspace checkpoint'
      });

      if (name && checkpointManager) {
        const description = await vscode.window.showInputBox({
          placeHolder: 'Enter checkpoint description (optional)',
          prompt: 'Describe the checkpoint'
        });

        try {
          await checkpointManager.createCheckpoint(name, description || '');
          vscode.window.showInformationMessage(`Checkpoint "${name}" created successfully`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to create checkpoint: ${error}`);
        }
      } else if (!checkpointManager) {
        vscode.window.showErrorMessage('Checkpoint manager not initialized');
      }
    }),

    vscode.commands.registerCommand('openManus.listCheckpoints', async () => {
      if (!checkpointManager) {
        vscode.window.showErrorMessage('Checkpoint manager not initialized');
        return;
      }

      try {
        const checkpoints = await checkpointManager.listCheckpoints();
        
        if (checkpoints.length === 0) {
          vscode.window.showInformationMessage('No checkpoints found');
          return;
        }

        const items = checkpoints.map(cp => ({
          label: cp.name,
          description: new Date(cp.timestamp).toLocaleString(),
          detail: cp.description,
          checkpoint: cp
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a checkpoint',
          canPickMany: false
        });

        if (selected) {
          const action = await vscode.window.showQuickPick(['Restore', 'Delete'], {
            placeHolder: `What do you want to do with checkpoint "${selected.label}"?`
          });

          if (action === 'Restore') {
            const confirm = await vscode.window.showWarningMessage(
              `Are you sure you want to restore checkpoint "${selected.label}"? This will overwrite your current workspace.`,
              { modal: true },
              'Yes'
            );

            if (confirm === 'Yes' && checkpointManager) {
              await checkpointManager.restoreCheckpoint(selected.checkpoint.id);
              vscode.window.showInformationMessage(`Checkpoint "${selected.label}" restored successfully`);
            }
          } else if (action === 'Delete' && checkpointManager) {
            await checkpointManager.deleteCheckpoint(selected.checkpoint.id);
            vscode.window.showInformationMessage(`Checkpoint "${selected.label}" deleted successfully`);
          }
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to list checkpoints: ${error}`);
      }
    })
  );

  // Check if OpenManus is available
  checkOpenManusAvailability();
}

/**
 * Initialize the OpenManus process
 */
function initializeOpenManusProcess() {
  const config = vscode.workspace.getConfiguration('openManus');
  const openManusPath = config.get('openManusPath') as string;
  const pythonPath = config.get('pythonPath') as string;
  const apiKey = config.get('apiKey') as string;
  
  if (!openManusPath) {
    return; // Path not configured
  }
  
  const options: OpenManusOptions = {
    openManusPath,
    pythonPath,
    apiKey,
    useMCP: true
  };
  
  openManusProcess = new OpenManusProcess(options);
}

/**
 * Check if OpenManus is available on the system
 */
function checkOpenManusAvailability() {
  const config = vscode.workspace.getConfiguration('openManus');
  const openManusPath = config.get('openManusPath') as string;
  
  if (!openManusPath) {
    const message = 'OpenManus path is not configured. Please set the path to your OpenManus installation.';
    vscode.window.showWarningMessage(message, 'Configure').then(selection => {
      if (selection === 'Configure') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'openManus.openManusPath');
      }
    });
    return;
  }
  
  const mainPyPath = join(openManusPath, 'main.py');
  if (!existsSync(mainPyPath)) {
    const message = 'OpenManus main.py not found at the configured path. Please check your configuration.';
    vscode.window.showWarningMessage(message, 'Configure').then(selection => {
      if (selection === 'Configure') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'openManus.openManusPath');
      }
    });
    return;
  }
  
  vscode.window.showInformationMessage('OpenManus found successfully!');
}

/**
 * Deactivates the extension
 */
export function deactivate() {
  console.log('OpenManus extension is now deactivated');
  
  // Clean up the OpenManus process
  if (openManusProcess) {
    openManusProcess.dispose();
    openManusProcess = undefined;
  }
}