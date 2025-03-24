import * as vscode from 'vscode';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { TaskManager } from '../tasks/TaskManager';
import type { OpenManusProcess } from '../process/OpenManusProcess';
import type { TaskStatus, TaskPriority } from '../tasks/TaskManager';
import { MCPMessageType } from '../process/OpenManusProcess';

/**
 * Message types for WebView communication
 */
export enum MessageType {
  Init = 'init',
  NewTask = 'new-task',
  UpdateTask = 'update-task',
  SendPrompt = 'send-prompt',
  TaskList = 'task-list',
  PromptResponse = 'prompt-response',
  Error = 'error',
  ToolList = 'tool-list',
  ExecuteTool = 'execute-tool',
  ToolResponse = 'tool-response',
  TaskAdded = 'taskAdded',
  TaskUpdated = 'taskUpdated',
  TaskDeleted = 'taskDeleted',
  TaskSelected = 'taskSelected',
  DeleteTask = 'delete-task',
  ChatMessage = 'chat-message'
}

/**
 * New task message interface
 */
interface NewTaskMessage {
  type: MessageType.NewTask;
  prompt: string;
  priority: TaskPriority;
}

/**
 * Update task message interface
 */
interface UpdateTaskMessage {
  type: MessageType.UpdateTask;
  taskId: string;
  status: TaskStatus;
}

/**
 * Send prompt message interface
 */
interface SendPromptMessage {
  type: MessageType.SendPrompt;
  text: string;
}

/**
 * Execute tool message interface
 */
interface ExecuteToolMessage {
  type: MessageType.ExecuteTool;
  toolName: string;
  toolInput: Record<string, unknown>;
}

/**
 * Chat message interface
 */
interface ChatMessageData {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

/**
 * Delete task message interface
 */
interface DeleteTaskMessage {
  type: MessageType.DeleteTask;
  taskId: string;
}

/**
 * Chat message interface
 */
interface ChatMessage {
  type: MessageType.ChatMessage;
  message: ChatMessageData;
}

/**
 * Base message interface
 */
type Message = 
  | { type: MessageType.Init }
  | NewTaskMessage
  | UpdateTaskMessage
  | SendPromptMessage
  | ExecuteToolMessage
  | DeleteTaskMessage
  | ChatMessage
  | { type: MessageType.TaskList }
  | { type: MessageType.PromptResponse }
  | { type: MessageType.Error }
  | { type: MessageType.ToolList }
  | { type: MessageType.ToolResponse };

/**
 * Manages the OpenManus panel WebView
 */
export class OpenManusPanel {
  public static currentPanel: OpenManusPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly taskManager: TaskManager;
  private readonly openManusProcess: OpenManusProcess | undefined;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    taskManager: TaskManager,
    openManusProcess?: OpenManusProcess
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.taskManager = taskManager;
    this.openManusProcess = openManusProcess;

    // Set the WebView's initial html content
    this.panel.webview.html = this.getWebviewContent();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from the WebView
    this.panel.webview.onDidReceiveMessage(
      async (message: Message) => {
        switch (message.type) {
          case MessageType.Init: {
            await this.initializeWebView();
            break;
          }
          case MessageType.NewTask: {
            await this.handleNewTask(message);
            break;
          }
          case MessageType.UpdateTask: {
            await this.handleUpdateTask(message);
            break;
          }
          case MessageType.DeleteTask: {
            await this.handleDeleteTask(message);
            break;
          }
          case MessageType.SendPrompt: {
            await this.handleSendPrompt(message);
            break;
          }
          case MessageType.ExecuteTool: {
            await this.handleExecuteTool(message);
            break;
          }
          case MessageType.ChatMessage: {
            await this.handleChatMessage(message);
            break;
          }
        }
      },
      null,
      this.disposables
    );

    // Listen for MCP messages from OpenManus
    if (openManusProcess) {
      this.disposables.push(
        openManusProcess.onMessage((mcpMessage) => {
          switch (mcpMessage.type) {
            case MCPMessageType.PromptResponse:
              if (mcpMessage.content) {
                this.panel.webview.postMessage({ 
                  type: MessageType.PromptResponse, 
                  response: mcpMessage.content 
                });
              }
              break;
            case MCPMessageType.Error:
              if (mcpMessage.error) {
                this.panel.webview.postMessage({ 
                  type: MessageType.Error, 
                  message: mcpMessage.error 
                });
              }
              break;
          }
        })
      );
    }
  }

  /**
   * Creates or shows the panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri, 
    taskManager: TaskManager,
    openManusProcess?: OpenManusProcess
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (OpenManusPanel.currentPanel) {
      OpenManusPanel.currentPanel.panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'openManusPanel',
      'OpenManus',
      column || vscode.ViewColumn.One,
      {
        // Enable JavaScript in the WebView
        enableScripts: true,
        // Restrict the WebView to only load resources from the extension's directory
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist'),
          vscode.Uri.joinPath(extensionUri, 'media')
        ],
        // Retain context when hidden
        retainContextWhenHidden: true
      }
    );

    OpenManusPanel.currentPanel = new OpenManusPanel(panel, extensionUri, taskManager, openManusProcess);
  }

  /**
   * Initialize the WebView with data
   */
  private async initializeWebView() {
    await this.refreshTaskList();
    await this.refreshToolsList();
  }

  /**
   * Refresh the task list in the WebView
   */
  private async refreshTaskList() {
    const tasks = await this.taskManager.getAllTasks();
    this.panel.webview.postMessage({ type: MessageType.TaskList, tasks });
  }

  /**
   * Refresh the available tools list
   */
  private async refreshToolsList() {
    if (this.openManusProcess) {
      const tools = await this.openManusProcess.getAvailableTools();
      if (tools) {
        this.panel.webview.postMessage({ type: MessageType.ToolList, tools });
      }
    }
  }

  /**
   * Returns html for the WebView
   */
  private getWebviewContent() {
    try {
      // Create the WebView with the correct script source path
      const webviewPath = join(this.extensionUri.fsPath, 'webview-ui', 'dist');
      const indexHtmlPath = join(webviewPath, 'index.html');
      
      let html = readFileSync(indexHtmlPath, 'utf-8');
      
      // Replace placeholders for WebView resources
      html = html.replace(
        /(href|src)="([^"]*)"/g,
        (match, p1, p2) => {
          // Skip absolute URLs
          if (p2.startsWith('http') || p2.startsWith('https')) {
            return match;
          }
          
          // Handle relative resource paths
          const resourceUri = vscode.Uri.joinPath(
            this.extensionUri,
            'webview-ui',
            'dist',
            p2
          );
          
          return `${p1}="${this.panel.webview.asWebviewUri(resourceUri)}"`;
        }
      );
      
      return html;
    } catch (error) {
      console.error('Error loading WebView content:', error);
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>OpenManus</title>
          <style>
            body {
              font-family: sans-serif;
              padding: 20px;
              color: #e4e4e4;
              background-color: #1e1e1e;
            }
            .error {
              color: #f85149;
              margin-top: 20px;
            }
            button {
              background-color: #0e639c;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              margin-top: 20px;
            }
            button:hover {
              background-color: #1177bb;
            }
          </style>
        </head>
        <body>
          <h1>OpenManus</h1>
          <p>Failed to load the OpenManus panel UI. The WebView UI may not be built properly.</p>
          <div class="error">
            Error: ${error instanceof Error ? error.message : String(error)}
          </div>
          <button onclick="reload()">Reload</button>
          <script>
            function reload() {
              vscode.postMessage({ type: 'init' });
            }
            const vscode = acquireVsCodeApi();
          </script>
        </body>
        </html>
      `;
    }
  }

  /**
   * Dispose and clean up panel resources when closed
   */
  public dispose() {
    OpenManusPanel.currentPanel = undefined;

    // Clean up resources
    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Handle new task creation
   */
  private async handleNewTask(message: NewTaskMessage): Promise<void> {
    const { prompt, priority } = message;
    const task = await this.taskManager.addTask({ prompt, priority });
    
    // Notify the WebView that a task was added
    this.panel.webview.postMessage({ 
      type: MessageType.TaskAdded, 
      task 
    });
    
    // Refresh the task list
    await this.refreshTaskList();
  }

  /**
   * Handle task update
   */
  private async handleUpdateTask(message: UpdateTaskMessage): Promise<void> {
    const { taskId, status } = message;
    await this.taskManager.updateTaskStatus(taskId, status);
    
    // Get updated task
    const task = await this.taskManager.getTask(taskId);
    
    if (task) {
      // Notify the WebView that a task was updated
      this.panel.webview.postMessage({ 
        type: MessageType.TaskUpdated, 
        task 
      });
    }
    
    // Refresh the task list
    await this.refreshTaskList();
  }

  /**
   * Handle task deletion
   */
  private async handleDeleteTask(message: DeleteTaskMessage): Promise<void> {
    const { taskId } = message;
    await this.taskManager.deleteTask(taskId);
    
    // Notify the WebView that a task was deleted
    this.panel.webview.postMessage({ 
      type: MessageType.TaskDeleted, 
      taskId 
    });
    
    // Refresh the task list
    await this.refreshTaskList();
  }

  /**
   * Handle sending a prompt to OpenManus
   */
  private async handleSendPrompt(message: SendPromptMessage): Promise<void> {
    const { text } = message;
    
    if (!this.openManusProcess) {
      this.panel.webview.postMessage({ 
        type: MessageType.Error, 
        message: 'OpenManus process not available' 
      });
      return;
    }
    
    try {
      // Create a user message
      const userMessageId = this.generateId();
      const userMessage: ChatMessageData = {
        id: userMessageId,
        content: text,
        role: 'user',
        timestamp: new Date().toISOString()
      };
      
      // Send user message to WebView
      this.panel.webview.postMessage({ 
        type: MessageType.ChatMessage, 
        message: userMessage 
      });
      
      // Send prompt to OpenManus
      const response = await this.openManusProcess.sendPrompt(text);
      
      if (response) {
        // Create assistant message
        const assistantMessageId = this.generateId();
        const assistantMessage: ChatMessageData = {
          id: assistantMessageId,
          content: response,
          role: 'assistant',
          timestamp: new Date().toISOString()
        };
        
        // Send assistant message to WebView
        this.panel.webview.postMessage({ 
          type: MessageType.ChatMessage, 
          message: assistantMessage 
        });
      } else {
        this.panel.webview.postMessage({ 
          type: MessageType.Error, 
          message: 'Failed to get response from OpenManus' 
        });
      }
    } catch (error) {
      this.panel.webview.postMessage({ 
        type: MessageType.Error, 
        message: `Error: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * Handle executing a tool
   */
  private async handleExecuteTool(message: ExecuteToolMessage): Promise<void> {
    const { toolName, toolInput } = message;
    
    if (!this.openManusProcess) {
      this.panel.webview.postMessage({ 
        type: MessageType.Error, 
        message: 'OpenManus process not available' 
      });
      return;
    }
    
    try {
      const toolOutput = await this.openManusProcess.executeTool(toolName, toolInput);
      
      if (toolOutput) {
        this.panel.webview.postMessage({ 
          type: MessageType.ToolResponse, 
          toolName,
          toolOutput 
        });
      } else {
        this.panel.webview.postMessage({ 
          type: MessageType.Error, 
          message: `Failed to execute tool: ${toolName}` 
        });
      }
    } catch (error) {
      this.panel.webview.postMessage({ 
        type: MessageType.Error, 
        message: `Error executing tool: ${error instanceof Error ? error.message : String(error)}` 
      });
    }
  }

  /**
   * Handle chat messages
   */
  private async handleChatMessage(message: ChatMessage): Promise<void> {
    // Just relay the message back to the WebView
    this.panel.webview.postMessage(message);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
} 