import * as vscode from 'vscode';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Task status types
 */
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'medium' | 'high';

/**
 * Task assignment options
 */
export type TaskAssignment = 'human' | 'ai';

/**
 * Task interface definition
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[];
  assignedTo: TaskAssignment;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  details?: string;
  testStrategy?: string;
  subtasks?: Task[];
}

/**
 * Manages integration with task-master-ai
 */
export class TaskManager {
  private extensionPath: string;
  private taskMasterPath: string;
  private hasInitialized = false;

  constructor(context: vscode.ExtensionContext) {
    this.extensionPath = context.extensionPath;
    this.taskMasterPath = path.join(
      this.extensionPath, 
      'node_modules', 
      '.bin', 
      'task-master'
    );
  }

  /**
   * Initialize the task master environment
   */
  public async initialize(): Promise<boolean> {
    try {
      // Check if task-master-ai is installed
      if (!fs.existsSync(this.taskMasterPath)) {
        throw new Error('task-master-ai is not properly installed');
      }

      // Create .env file if it doesn't exist
      const envFilePath = path.join(this.extensionPath, '.env');
      if (!fs.existsSync(envFilePath)) {
        await this.createEnvFile(envFilePath);
      }

      // Initialize task-master project if needed
      if (!fs.existsSync(path.join(this.extensionPath, 'tasks.json'))) {
        await this.runCommand('init');
      }

      this.hasInitialized = true;
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to initialize TaskManager: ${error}`);
      return false;
    }
  }

  /**
   * Create a .env file with default values
   */
  private async createEnvFile(filePath: string): Promise<void> {
    // Get API key from settings or prompt user
    const apiKey = vscode.workspace.getConfiguration('openManus').get('apiKey') as string;
    
    let finalApiKey = apiKey;
    if (!finalApiKey) {
      finalApiKey = await vscode.window.showInputBox({
        prompt: 'Enter your Anthropic API key for Claude',
        ignoreFocusOut: true
      }) || '';
      
      if (!finalApiKey) {
        throw new Error('API key is required for task-master-ai to function');
      }
      
      // Save to settings
      await vscode.workspace.getConfiguration('openManus').update('apiKey', finalApiKey, true);
    }
    
    const envContent = `ANTHROPIC_API_KEY=${finalApiKey}
MODEL=claude-3-7-sonnet-20250219
MAX_TOKENS=4000
TEMPERATURE=0.7
DEBUG=false
LOG_LEVEL=info
DEFAULT_SUBTASKS=3
DEFAULT_PRIORITY=medium
PROJECT_NAME=OpenManus-VSCode
PROJECT_VERSION=1.0.0
`;
    
    fs.writeFileSync(filePath, envContent);
  }

  /**
   * Run a task-master command
   */
  private async runCommand(command: string, args: string[] = []): Promise<string> {
    try {
      const fullCommand = `${this.taskMasterPath} ${command} ${args.join(' ')}`;
      const result = execSync(fullCommand, { 
        cwd: this.extensionPath,
        encoding: 'utf-8'
      });
      return result;
    } catch (error) {
      vscode.window.showErrorMessage(`Error running command: ${error}`);
      throw error;
    }
  }

  /**
   * Generate tasks from a PRD file
   */
  public async generateTasksFromPRD(prdPath: string, options: { numTasks?: number } = {}): Promise<Task[]> {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    
    const args = [prdPath];
    if (options.numTasks) {
      args.push(`--num-tasks=${options.numTasks}`);
    }
    
    await this.runCommand('parse-prd', args);
    return this.getAllTasks();
  }

  /**
   * Get all tasks
   */
  public async getAllTasks(): Promise<Task[]> {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    
    const tasksJson = path.join(this.extensionPath, 'tasks.json');
    if (!fs.existsSync(tasksJson)) {
      return [];
    }
    
    const tasks = JSON.parse(fs.readFileSync(tasksJson, 'utf-8'));
    return tasks;
  }

  /**
   * Get the next task to work on
   */
  public async getNextTask(): Promise<Task | null> {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    
    try {
      const result = await this.runCommand('next');
      const nextTask = JSON.parse(result);
      return nextTask;
    } catch (error) {
      console.error('Error getting next task:', error);
      return null;
    }
  }

  /**
   * Update task status
   */
  public async updateTaskStatus(taskId: string, status: TaskStatus): Promise<boolean> {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    
    try {
      await this.runCommand('set-status', [`--id=${taskId}`, `--status=${status}`]);
      return true;
    } catch (error) {
      console.error('Error updating task status:', error);
      return false;
    }
  }

  /**
   * Expand a task into subtasks
   */
  public async expandTask(taskId: string, options: { 
    num?: number, 
    prompt?: string,
    research?: boolean 
  } = {}): Promise<boolean> {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    
    const args = [`--id=${taskId}`];
    
    if (options.num) {
      args.push(`--num=${options.num}`);
    }
    
    if (options.prompt) {
      args.push(`--prompt="${options.prompt}"`);
    }
    
    if (options.research) {
      args.push('--research');
    }
    
    try {
      await this.runCommand('expand', args);
      return true;
    } catch (error) {
      console.error('Error expanding task:', error);
      return false;
    }
  }

  /**
   * Add a new task
   */
  public async addTask(options: {
    prompt: string,
    dependencies?: string[],
    priority?: TaskPriority
  }): Promise<Task | null> {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    
    const args = [`--prompt="${options.prompt}"`];
    
    if (options.dependencies && options.dependencies.length > 0) {
      args.push(`--dependencies=${options.dependencies.join(',')}`);
    }
    
    if (options.priority) {
      args.push(`--priority=${options.priority}`);
    }
    
    try {
      const result = await this.runCommand('add-task', args);
      const newTask = JSON.parse(result);
      return newTask;
    } catch (error) {
      console.error('Error adding task:', error);
      return null;
    }
  }

  /**
   * Analyze task complexity
   */
  public async analyzeComplexity(options: {
    threshold?: number,
    research?: boolean
  } = {}): Promise<Record<string, unknown>> {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    
    const args: string[] = [];
    
    if (options.threshold) {
      args.push(`--threshold=${options.threshold}`);
    }
    
    if (options.research) {
      args.push('--research');
    }
    
    try {
      await this.runCommand('analyze-complexity', args);
      
      // Read the generated report
      const reportPath = path.join(this.extensionPath, 'scripts', 'task-complexity-report.json');
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        return report;
      }
      
      return {};
    } catch (error) {
      console.error('Error analyzing complexity:', error);
      return {};
    }
  }

  /**
   * Get task by ID
   */
  public async getTaskById(taskId: string): Promise<Task | null> {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    
    try {
      const result = await this.runCommand('show', [`--id=${taskId}`]);
      const task = JSON.parse(result);
      return task;
    } catch (error) {
      console.error(`Error getting task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Get task by ID (alias for getTaskById for compatibility)
   */
  public async getTask(taskId: string): Promise<Task | null> {
    return this.getTaskById(taskId);
  }

  /**
   * Delete a task
   */
  public async deleteTask(taskId: string): Promise<boolean> {
    if (!this.hasInitialized) {
      await this.initialize();
    }
    
    try {
      await this.runCommand('delete-task', [`--id=${taskId}`]);
      return true;
    } catch (error) {
      console.error(`Error deleting task ${taskId}:`, error);
      return false;
    }
  }
} 