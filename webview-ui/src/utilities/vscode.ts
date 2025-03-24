/**
 * VS Code API utilities
 */

// Define message type for better type checking
export interface VSCodeMessage {
  type: string;
  [key: string]: unknown;
}

// Declare the VS Code API with proper types
declare function acquireVsCodeApi(): {
  postMessage: <T extends VSCodeMessage>(message: T) => void;
  getState: <T>() => T | undefined;
  setState: <T>(state: T) => void;
};

// Initialize the VS Code API
export const vscode = acquireVsCodeApi(); 