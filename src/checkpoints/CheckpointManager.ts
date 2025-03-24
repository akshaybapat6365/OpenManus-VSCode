import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

/**
 * Interface for checkpoint metadata
 */
export interface CheckpointMetadata {
  id: string;
  name: string;
  description: string;
  timestamp: number;
  workspacePath: string;
  fileCount: number;
}

/**
 * Represents a stored checkpoint file
 */
export interface CheckpointFile {
  relativePath: string;
  absolutePath: string;
  size: number;
}

/**
 * Interface for a stored checkpoint
 */
export interface Checkpoint {
  id: string;
  name: string;
  description: string;
  timestamp: number;
  workspacePath: string;
  fileCount: number;
  files: CheckpointFile[];
}

/**
 * Manages workspace checkpoints
 */
export class CheckpointManager {
  private readonly checkpointsLocation: string;

  constructor(context: vscode.ExtensionContext) {
    this.checkpointsLocation = vscode.workspace.getConfiguration('openManus').get('checkpoints.location') as string;
    
    if (!this.checkpointsLocation) {
      this.checkpointsLocation = path.join(context.globalStorageUri.fsPath, 'checkpoints');
    }
  }

  /**
   * Initialize the checkpoint manager
   */
  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.checkpointsLocation, { recursive: true });
    } catch (error) {
      console.error('Error initializing checkpoint directory:', error);
      throw error;
    }
  }

  /**
   * Create a checkpoint for the current workspace
   */
  public async createCheckpoint(name: string, description: string): Promise<CheckpointMetadata> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      throw new Error('No workspace opened');
    }

    // Get workspace path
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    
    // Generate checkpoint ID
    const id = crypto.randomUUID();
    
    // Create checkpoint directory
    const checkpointDir = path.join(this.checkpointsLocation, id);
    await fs.mkdir(checkpointDir, { recursive: true });
    
    // Get files in workspace
    const files = await this.getWorkspaceFiles(workspacePath);
    
    // Create checkpoint data
    const checkpoint: Checkpoint = {
      id,
      name,
      description,
      timestamp: Date.now(),
      workspacePath,
      fileCount: files.length,
      files: []
    };
    
    // Copy files to checkpoint directory
    for (const file of files) {
      try {
        const relativePath = path.relative(workspacePath, file);
        const targetPath = path.join(checkpointDir, 'files', relativePath);
        
        // Create directory if it doesn't exist
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        
        // Read file content and calculate hash
        const content = await fs.readFile(file);
        
        // Copy file
        await fs.writeFile(targetPath, content);
        
        // Add file metadata
        checkpoint.files.push({
          relativePath,
          absolutePath: targetPath,
          size: content.length
        });
      } catch (error) {
        console.error(`Error backing up file ${file}:`, error);
        // Continue with other files
      }
    }
    
    // Save checkpoint metadata
    await fs.writeFile(
      path.join(checkpointDir, 'checkpoint.json'), 
      JSON.stringify(checkpoint, null, 2)
    );
    
    return {
      id: checkpoint.id,
      name: checkpoint.name,
      description: checkpoint.description,
      timestamp: checkpoint.timestamp,
      workspacePath: checkpoint.workspacePath,
      fileCount: checkpoint.fileCount
    };
  }

  /**
   * List all available checkpoints
   */
  public async listCheckpoints(): Promise<CheckpointMetadata[]> {
    const dirs = await fs.readdir(this.checkpointsLocation);
    const checkpoints: CheckpointMetadata[] = [];
    
    for (const dir of dirs) {
      try {
        const metadataPath = path.join(this.checkpointsLocation, dir, 'checkpoint.json');
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const checkpoint = JSON.parse(metadataContent) as Checkpoint;
        
        checkpoints.push({
          id: checkpoint.id,
          name: checkpoint.name,
          description: checkpoint.description,
          timestamp: checkpoint.timestamp,
          workspacePath: checkpoint.workspacePath,
          fileCount: checkpoint.fileCount
        });
      } catch (error) {
        console.error(`Error reading checkpoint ${dir}:`, error);
        // Continue with other checkpoints
      }
    }
    
    // Sort by timestamp (newest first)
    return checkpoints.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Gets a specific checkpoint with file information
   */
  public async getCheckpoint(id: string): Promise<Checkpoint | null> {
    try {
      // Get the metadata first
      const checkpoints = await this.listCheckpoints();
      const metadata = checkpoints.find(cp => cp.id === id);
      
      if (!metadata) {
        return null;
      }
      
      // Checkpoint directory path
      const checkpointDir = path.join(this.checkpointsLocation, id);
      
      // Read the files in the checkpoint
      const filesList: CheckpointFile[] = [];
      const filesDir = path.join(checkpointDir, 'files');
      
      const readDir = async (dir: string, baseDir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath);
          
          if (entry.isDirectory()) {
            await readDir(fullPath, baseDir);
          } else {
            const stats = await fs.stat(fullPath);
            filesList.push({
              relativePath,
              absolutePath: fullPath,
              size: stats.size
            });
          }
        }
      };
      
      if (await this.pathExists(filesDir)) {
        await readDir(filesDir, filesDir);
      }
      
      // Return the full checkpoint info
      return {
        id: metadata.id,
        name: metadata.name,
        description: metadata.description,
        timestamp: metadata.timestamp,
        workspacePath: metadata.workspacePath,
        fileCount: filesList.length,
        files: filesList
      };
    } catch (error) {
      console.error('Error getting checkpoint:', error);
      throw error;
    }
  }

  /**
   * Restore a checkpoint
   */
  public async restoreCheckpoint(checkpointId: string): Promise<void> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      throw new Error('No workspace opened');
    }
    
    // Get workspace path
    const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    
    // Check if checkpoint exists
    const checkpointDir = path.join(this.checkpointsLocation, checkpointId);
    
    try {
      await fs.access(checkpointDir);
    } catch (error) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }
    
    // Read checkpoint metadata
    const metadataPath = path.join(checkpointDir, 'checkpoint.json');
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const checkpoint = JSON.parse(metadataContent) as Checkpoint;
    
    // Check if checkpoint is compatible with current workspace
    const workspacePathName = path.basename(workspacePath);
    const checkpointPathName = path.basename(checkpoint.workspacePath);
    
    if (workspacePathName !== checkpointPathName) {
      const answer = await vscode.window.showWarningMessage(
        `The checkpoint was created for workspace "${checkpointPathName}" but you are restoring to "${workspacePathName}". Continue?`,
        'Yes', 'No'
      );
      
      if (answer !== 'Yes') {
        return;
      }
    }
    
    // Restore files
    for (const file of checkpoint.files) {
      try {
        // Handle both new and legacy file formats
        let filePath: string;
        
        // Check for legacy format which had a 'path' property
        if ('path' in file && typeof file.path === 'string') {
          filePath = file.path;
        } else {
          filePath = file.relativePath;
        }
        
        const sourcePath = path.join(checkpointDir, 'files', filePath);
        const targetPath = path.join(workspacePath, filePath);
        
        // Create directory if it doesn't exist
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        
        // Copy file
        const content = await fs.readFile(sourcePath);
        await fs.writeFile(targetPath, content);
      } catch (error) {
        console.error('Error restoring file:', error);
        // Continue with other files
      }
    }
    
    // Refresh VS Code explorer
    vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
  }

  /**
   * Get all files in the workspace (excluding node_modules, .git, etc.)
   */
  private async getWorkspaceFiles(workspacePath: string): Promise<string[]> {
    const files: string[] = [];
    const ignored = ['.git', 'node_modules', 'dist', 'out'];
    
    async function scan(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (!ignored.includes(entry.name)) {
            await scan(fullPath);
          }
        } else {
          files.push(fullPath);
        }
      }
    }
    
    await scan(workspacePath);
    return files;
  }

  /**
   * Delete a checkpoint
   */
  public async deleteCheckpoint(checkpointId: string): Promise<void> {
    const checkpointDir = path.join(this.checkpointsLocation, checkpointId);
    
    try {
      await fs.rm(checkpointDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Error deleting checkpoint ${checkpointId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a path exists
   */
  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
} 