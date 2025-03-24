import * as vscode from 'vscode';
import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Message types for MCP protocol
 */
export enum MCPMessageType {
  Initialize = 'initialize',
  ExecuteTool = 'execute_tool',
  ExecuteToolResponse = 'execute_tool_response',
  Prompt = 'prompt',
  PromptResponse = 'prompt_response',
  Error = 'error'
}

/**
 * MCP Tool interface
 */
export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * MCP Message interface
 */
export interface MCPMessage {
  type: MCPMessageType;
  id?: string;
  tools?: MCPTool[];
  content?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  error?: string;
}

/**
 * Options for starting the OpenManus process
 */
export interface OpenManusOptions {
  pythonPath?: string;
  openManusPath: string;
  useMCP?: boolean;
  apiKey?: string;
  model?: string;
}

/**
 * Callback for MCP message handling
 */
export type MCPMessageCallback = (message: MCPMessage) => void;

/**
 * Manages the OpenManus process
 */
export class OpenManusProcess {
  private process: ChildProcess | null = null;
  private options: OpenManusOptions;
  private outputChannel: vscode.OutputChannel;
  private isReady = false;
  private messageBuffer = '';
  private messageCallbacks: Map<string, MCPMessageCallback> = new Map();
  private onMessageListeners: MCPMessageCallback[] = [];

  constructor(options: OpenManusOptions) {
    this.options = options;
    this.outputChannel = vscode.window.createOutputChannel('OpenManus');
  }

  /**
   * Register a callback for MCP messages
   */
  public onMessage(callback: MCPMessageCallback): vscode.Disposable {
    this.onMessageListeners.push(callback);
    
    return new vscode.Disposable(() => {
      const index = this.onMessageListeners.indexOf(callback);
      if (index !== -1) {
        this.onMessageListeners.splice(index, 1);
      }
    });
  }

  /**
   * Start the OpenManus process
   */
  public async start(): Promise<boolean> {
    if (this.process) {
      return true; // Already running
    }

    try {
      // Validate paths
      if (!existsSync(this.options.openManusPath)) {
        throw new Error(`OpenManus path does not exist: ${this.options.openManusPath}`);
      }

      // Determine which script to run (MCP or standard)
      const scriptPath = this.options.useMCP 
        ? join(this.options.openManusPath, 'run_mcp.py')
        : join(this.options.openManusPath, 'main.py');

      if (!existsSync(scriptPath)) {
        throw new Error(`OpenManus script not found: ${scriptPath}`);
      }

      // Get Python path
      const pythonPath = this.options.pythonPath || 'python';

      // Set environment variables
      const env = { ...process.env };
      
      if (this.options.apiKey) {
        env.OPENAI_API_KEY = this.options.apiKey;
        env.ANTHROPIC_API_KEY = this.options.apiKey;
      }

      // Start the process
      this.outputChannel.appendLine(`Starting OpenManus with ${scriptPath}`);
      
      const args = this.options.useMCP
        ? ['--connection', 'stdio', '--debug']
        : [];
        
      this.process = spawn(pythonPath, [scriptPath, ...args], {
        cwd: this.options.openManusPath,
        env,
        stdio: 'pipe'
      });

      // Set up event handlers
      this.setupProcessHandlers();

      // Wait for ready signal
      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          this.outputChannel.appendLine('Timed out waiting for OpenManus to be ready');
          resolve(false);
        }, 30000); // 30 second timeout

        const disposable = this.onMessage((message) => {
          if (message.type === MCPMessageType.Initialize) {
            this.isReady = true;
            clearTimeout(timeout);
            disposable.dispose();
            resolve(true);
          }
        });
      });
    } catch (error) {
      this.outputChannel.appendLine(`Error starting OpenManus: ${error}`);
      vscode.window.showErrorMessage(`Failed to start OpenManus: ${error}`);
      return false;
    }
  }

  /**
   * Set up process event handlers
   */
  private setupProcessHandlers() {
    if (!this.process) {
      return;
    }

    this.process.stdout?.on('data', (data) => {
      const output = data.toString();
      this.outputChannel.append(output);
      
      // Process MCP messages
      if (this.options.useMCP) {
        this.processOutput(output);
      } else if (output.includes('Ready to process requests')) {
        this.isReady = true;
        vscode.window.showInformationMessage('OpenManus is ready');
      }
    });

    this.process.stderr?.on('data', (data) => {
      const output = data.toString();
      this.outputChannel.append(`[ERROR] ${output}`);
    });

    this.process.on('close', (code) => {
      this.outputChannel.appendLine(`OpenManus process exited with code ${code}`);
      this.process = null;
      this.isReady = false;
    });

    this.process.on('error', (error) => {
      this.outputChannel.appendLine(`OpenManus process error: ${error.message}`);
      vscode.window.showErrorMessage(`OpenManus error: ${error.message}`);
      this.process = null;
      this.isReady = false;
    });
  }

  /**
   * Process output from the OpenManus process
   */
  private processOutput(output: string) {
    this.messageBuffer += output;
    
    // Look for complete JSON objects in the buffer
    const startIndex = this.messageBuffer.indexOf('{');
    if (startIndex === -1) {
      return; // No JSON start found
    }
    
    let depth = 0;
    let endIndex = -1;
    
    // Find the matching closing brace
    for (let i = startIndex; i < this.messageBuffer.length; i++) {
      if (this.messageBuffer[i] === '{') {
        depth++;
      } else if (this.messageBuffer[i] === '}') {
        depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }
    
    // If we found a complete JSON object
    if (endIndex !== -1) {
      try {
        const jsonStr = this.messageBuffer.substring(startIndex, endIndex + 1);
        const message = JSON.parse(jsonStr) as MCPMessage;
        
        // Process the message
        this.handleMessage(message);
        
        // Remove the processed message from the buffer
        this.messageBuffer = this.messageBuffer.substring(endIndex + 1);
        
        // Check for more messages
        if (this.messageBuffer.length > 0) {
          this.processOutput('');
        }
      } catch (error) {
        this.outputChannel.appendLine(`[MCP] Error parsing message: ${error}`);
        // Try to recover by skipping to the next opening brace
        const nextStart = this.messageBuffer.indexOf('{', startIndex + 1);
        if (nextStart !== -1) {
          this.messageBuffer = this.messageBuffer.substring(nextStart);
        } else {
          this.messageBuffer = '';
        }
      }
    }
  }

  /**
   * Handle MCP message
   */
  private handleMessage(message: MCPMessage) {
    // Notify listeners
    for (const listener of this.onMessageListeners) {
      listener(message);
    }
    
    // Check for message ID and callback
    if (message.id && this.messageCallbacks.has(message.id)) {
      const callback = this.messageCallbacks.get(message.id);
      if (callback) {
        callback(message);
        this.messageCallbacks.delete(message.id);
      }
    }
    
    // Check for specific message types
    if (message.type === MCPMessageType.Initialize) {
      this.isReady = true;
      vscode.window.showInformationMessage('OpenManus is ready');
    }
  }

  /**
   * Send a message to the OpenManus process
   */
  private sendMessage(message: MCPMessage): boolean {
    if (!this.process?.stdin) {
      return false;
    }
    
    try {
      const json = JSON.stringify(message);
      this.outputChannel.appendLine(`[MCP] Sending: ${json}`);
      this.process.stdin.write(`${json}\n`);
      return true;
    } catch (error) {
      this.outputChannel.appendLine(`[MCP] Error sending message: ${error}`);
      return false;
    }
  }

  /**
   * Generate a unique message ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * Send a prompt to OpenManus
   */
  public async sendPrompt(prompt: string): Promise<string | null> {
    if (!this.isRunning()) {
      this.outputChannel.appendLine('Cannot send prompt: OpenManus is not running');
      return null;
    }
    
    try {
      if (this.options.useMCP) {
        // Use MCP protocol
        const messageId = this.generateId();
        
        const message: MCPMessage = {
          type: MCPMessageType.Prompt,
          id: messageId,
          content: prompt
        };
        
        if (!this.sendMessage(message)) {
          return null;
        }
        
        return new Promise<string | null>((resolve) => {
          // Register callback for response
          this.messageCallbacks.set(messageId, (responseMsg) => {
            if (responseMsg.type === MCPMessageType.PromptResponse && responseMsg.content) {
              resolve(responseMsg.content);
            } else if (responseMsg.type === MCPMessageType.Error) {
              this.outputChannel.appendLine(`[MCP] Error: ${responseMsg.error}`);
              resolve(null);
            }
          });
          
          // Set timeout for response
          setTimeout(() => {
            if (this.messageCallbacks.has(messageId)) {
              this.messageCallbacks.delete(messageId);
              this.outputChannel.appendLine('[MCP] Timeout waiting for response to prompt');
              resolve(null);
            }
          }, 60000); // 60 second timeout
        });
      }
      
      // Use standard protocol
      if (this.process?.stdin) {
        this.process.stdin.write(`${prompt}\n`);
        return prompt; // We don't get a direct response in standard mode
      }
      return null;
    } catch (error) {
      this.outputChannel.appendLine(`Error sending prompt: ${error}`);
      return null;
    }
  }

  /**
   * Execute an MCP tool
   */
  public async executeTool(toolName: string, toolInput: Record<string, unknown>): Promise<string | null> {
    if (!this.options.useMCP) {
      throw new Error('Tool execution is only supported in MCP mode');
    }
    
    if (!this.process || !this.isReady) {
      const started = await this.start();
      if (!started) {
        return null;
      }
    }
    
    const messageId = this.generateId();
    const message: MCPMessage = {
      type: MCPMessageType.ExecuteTool,
      id: messageId,
      tool_name: toolName,
      tool_input: toolInput
    };
    
    return new Promise<string | null>((resolve) => {
      this.messageCallbacks.set(messageId, (response) => {
        if (response.type === MCPMessageType.ExecuteToolResponse) {
          resolve(response.tool_output || null);
        } else if (response.type === MCPMessageType.Error) {
          this.outputChannel.appendLine(`[MCP] Error: ${response.error}`);
          resolve(null);
        } else {
          resolve(null);
        }
      });
      
      this.sendMessage(message);
      
      // Set timeout
      setTimeout(() => {
        if (this.messageCallbacks.has(messageId)) {
          this.messageCallbacks.delete(messageId);
          this.outputChannel.appendLine(`[MCP] Timeout waiting for tool execution`);
          resolve(null);
        }
      }, 60000); // 60 second timeout
    });
  }

  /**
   * Get available tools from OpenManus
   */
  public async getAvailableTools(): Promise<MCPTool[] | null> {
    if (!this.options.useMCP) {
      throw new Error('Tool listing is only supported in MCP mode');
    }
    
    if (!this.process || !this.isReady) {
      const started = await this.start();
      if (!started) {
        return null;
      }
    }
    
    const messageId = this.generateId();
    const message: MCPMessage = {
      type: MCPMessageType.Initialize,
      id: messageId
    };
    
    return new Promise<MCPTool[] | null>((resolve) => {
      this.messageCallbacks.set(messageId, (response) => {
        if (response.type === MCPMessageType.Initialize && response.tools) {
          resolve(response.tools);
        } else {
          resolve(null);
        }
      });
      
      this.sendMessage(message);
      
      // Set timeout
      setTimeout(() => {
        if (this.messageCallbacks.has(messageId)) {
          this.messageCallbacks.delete(messageId);
          this.outputChannel.appendLine(`[MCP] Timeout waiting for tools list`);
          resolve(null);
        }
      }, 10000); // 10 second timeout
    });
  }

  /**
   * Stop the OpenManus process
   */
  public stop(): boolean {
    if (!this.process) {
      return true; // Already stopped
    }

    try {
      this.process.kill();
      this.process = null;
      this.isReady = false;
      this.outputChannel.appendLine('OpenManus process stopped');
      return true;
    } catch (error) {
      this.outputChannel.appendLine(`Error stopping OpenManus: ${error}`);
      return false;
    }
  }

  /**
   * Check if the OpenManus process is running
   */
  public isRunning(): boolean {
    return this.process !== null;
  }

  /**
   * Execute a task using OpenManus
   */
  public async runTask(task: { title: string; description: string }): Promise<boolean> {
    const prompt = `Task: ${task.title}\nDescription: ${task.description}\nPlease complete this task.`;
    const response = await this.sendPrompt(prompt);
    return response !== null;
  }

  /**
   * Dispose the OpenManus process
   */
  public dispose() {
    this.stop();
    this.outputChannel.dispose();
  }
} 