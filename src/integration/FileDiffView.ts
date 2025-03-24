import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as crypto from 'node:crypto';

/**
 * Change type enum
 */
export enum ChangeType {
  Added = 'added',
  Modified = 'modified',
  Deleted = 'deleted'
}

/**
 * File change interface
 */
export interface FileChange {
  path: string;
  type: ChangeType;
  oldContent?: string;
  newContent?: string;
}

/**
 * Manages file diff functionality
 */
export class FileDiffView {
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Show differences between files
   */
  public async showDiff(oldContent: string, newContent: string, fileName: string, title: string): Promise<void> {
    // Create temp files for diff
    const oldFile = await this.createTempFile(`${fileName}.old`, oldContent);
    const newFile = await this.createTempFile(`${fileName}.new`, newContent);

    // Create URIs for both files
    const oldUri = vscode.Uri.file(oldFile);
    const newUri = vscode.Uri.file(newFile);

    // Show diff
    await vscode.commands.executeCommand(
      'vscode.diff',
      oldUri,
      newUri,
      title || `${fileName} (Compare)`,
      { preview: true }
    );
  }

  /**
   * Create a temporary file for diffing
   */
  private async createTempFile(fileName: string, content: string): Promise<string> {
    // Create a unique file in the extension's storage path
    const storagePath = this.context.globalStoragePath;
    const tempDir = path.join(storagePath, 'diffs');
    
    // Make sure the directory exists
    await fs.mkdir(tempDir, { recursive: true });
    
    // Create a unique file name to avoid conflicts
    const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
    const tempFile = path.join(tempDir, `${hash}-${fileName}`);
    
    // Write content to file
    await fs.writeFile(tempFile, content);
    
    return tempFile;
  }

  /**
   * Compare two files from the workspace
   */
  public async compareFiles(file1: string, file2: string, title?: string): Promise<void> {
    const uri1 = vscode.Uri.file(file1);
    const uri2 = vscode.Uri.file(file2);
    
    await vscode.commands.executeCommand(
      'vscode.diff',
      uri1,
      uri2,
      title || `Compare: ${path.basename(file1)} ↔ ${path.basename(file2)}`,
      { preview: true }
    );
  }

  /**
   * Show changes for multiple files
   */
  public async showChanges(changes: FileChange[]): Promise<void> {
    if (changes.length === 0) {
      vscode.window.showInformationMessage('No changes to display');
      return;
    }

    // Create QuickPick items for file changes
    const items = changes.map(change => {
      const fileName = path.basename(change.path);
      return {
        label: fileName,
        description: change.path,
        detail: this.getChangeDescription(change),
        change
      };
    });

    // Show Quick Pick with files
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a file to see changes',
      canPickMany: false
    });

    if (selected) {
      const change = selected.change;
      
      if (change.type === ChangeType.Deleted) {
        // For deleted files, just show the old content
        if (change.oldContent) {
          const document = await vscode.workspace.openTextDocument({
            content: change.oldContent,
            language: this.getLanguageFromPath(change.path)
          });
          await vscode.window.showTextDocument(document);
        }
      } else if (change.type === ChangeType.Added) {
        // For added files, just show the new content
        if (change.newContent) {
          const document = await vscode.workspace.openTextDocument({
            content: change.newContent,
            language: this.getLanguageFromPath(change.path)
          });
          await vscode.window.showTextDocument(document);
        }
      } else {
        // For modified files, show diff view
        if (change.oldContent !== undefined && change.newContent !== undefined) {
          await this.showDiff(
            change.oldContent,
            change.newContent,
            path.basename(change.path),
            `${change.path} (Changes)`
          );
        }
      }
    }
  }

  /**
   * Get language ID from file path
   */
  private getLanguageFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const extensionMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.py': 'python',
      '.html': 'html',
      '.css': 'css',
      '.json': 'json',
      '.md': 'markdown'
    };
    
    return extensionMap[ext] || 'plaintext';
  }

  /**
   * Get description text for a change
   */
  private getChangeDescription(change: FileChange): string {
    switch (change.type) {
      case ChangeType.Added:
        return 'Added';
      case ChangeType.Modified:
        return 'Modified';
      case ChangeType.Deleted:
        return 'Deleted';
      default:
        return '';
    }
  }
} 