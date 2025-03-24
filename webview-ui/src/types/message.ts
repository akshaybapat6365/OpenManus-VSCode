/**
 * Message types for communication between webview and extension
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
  DeleteTask = 'delete-task',
  ChatMessage = 'chat-message',
  TaskAdded = 'taskAdded',
  TaskUpdated = 'taskUpdated',
  TaskDeleted = 'taskDeleted',
  TaskSelected = 'taskSelected'
}

/**
 * Chat message data
 */
export interface ChatMessageData {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

/**
 * Base message interface
 */
export interface Message {
  type: MessageType;
}

/**
 * New task message
 */
export interface NewTaskMessage extends Message {
  type: MessageType.NewTask;
  prompt: string;
  priority: string;
}

/**
 * Update task message
 */
export interface UpdateTaskMessage extends Message {
  type: MessageType.UpdateTask;
  taskId: string;
  status: string;
}

/**
 * Delete task message
 */
export interface DeleteTaskMessage extends Message {
  type: MessageType.DeleteTask;
  taskId: string;
}

/**
 * Chat message
 */
export interface ChatMessageRequest extends Message {
  type: MessageType.ChatMessage;
  message: ChatMessageData;
}

/**
 * Send prompt message
 */
export interface SendPromptMessage extends Message {
  type: MessageType.SendPrompt;
  text: string;
}

/**
 * Execute tool message
 */
export interface ExecuteToolMessage extends Message {
  type: MessageType.ExecuteTool;
  toolName: string;
  toolInput: Record<string, unknown>;
}

/**
 * Task list response
 */
export interface TaskListResponse extends Message {
  type: MessageType.TaskList;
  tasks: unknown[];
}

/**
 * Tool list response
 */
export interface ToolListResponse extends Message {
  type: MessageType.ToolList;
  tools: unknown[];
}

/**
 * Error message
 */
export interface ErrorMessage extends Message {
  type: MessageType.Error;
  message: string;
}

/**
 * Task added response
 */
export interface TaskAddedResponse extends Message {
  type: MessageType.TaskAdded;
  task: unknown;
}

/**
 * Task updated response
 */
export interface TaskUpdatedResponse extends Message {
  type: MessageType.TaskUpdated;
  task: unknown;
}

/**
 * Task deleted response
 */
export interface TaskDeletedResponse extends Message {
  type: MessageType.TaskDeleted;
  taskId: string;
}

/**
 * Prompt response
 */
export interface PromptResponse extends Message {
  type: MessageType.PromptResponse;
  response: string;
}

/**
 * Tool response
 */
export interface ToolResponse extends Message {
  type: MessageType.ToolResponse;
  toolName: string;
  toolOutput: string;
}

/**
 * Union type of all messages
 */
export type MessageUnion = 
  | Message
  | NewTaskMessage
  | UpdateTaskMessage
  | DeleteTaskMessage
  | SendPromptMessage
  | ExecuteToolMessage
  | ChatMessageRequest
  | TaskListResponse
  | ToolListResponse
  | ErrorMessage
  | TaskAddedResponse
  | TaskUpdatedResponse
  | TaskDeletedResponse
  | PromptResponse
  | ToolResponse; 