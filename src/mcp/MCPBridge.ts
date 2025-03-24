import * as vscode from 'vscode';
import WebSocket from 'ws';

/**
 * Types of MCP messages
 */
export enum MCPMessageType {
  CONNECT = 'connect',
  LIST_TOOLS = 'list_tools',
  EXECUTE_TOOL = 'execute_tool',
  TOOL_RESULT = 'tool_result',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong'
}

/**
 * Tool definition in MCP
 */
export interface MCPTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    description: string;
    required: boolean;
  }[];
}

/**
 * Base MCP message
 */
export interface MCPMessage {
  type: MCPMessageType;
  id?: string;
  timestamp?: number;
}

/**
 * Tool execution request
 */
export interface MCPToolExecutionRequest extends MCPMessage {
  type: MCPMessageType.EXECUTE_TOOL;
  tool: string;
  parameters: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface MCPToolResult extends MCPMessage {
  type: MCPMessageType.TOOL_RESULT;
  tool: string;
  result: unknown;
  error?: string;
}

/**
 * Tool list result
 */
export interface MCPToolListResult extends MCPMessage {
  type: MCPMessageType.LIST_TOOLS;
  tools: MCPTool[];
}

/**
 * Error message
 */
export interface MCPErrorMessage extends MCPMessage {
  type: MCPMessageType.ERROR;
  error: string;
}

/**
 * Provides bridge to MCP protocol
 */
export class MCPBridge {
  private ws: WebSocket | null = null;
  private url: string;
  private connected = false;
  private messageQueue: MCPMessage[] = [];
  private messageHandlers = new Map<string, (message: MCPMessage) => void>();
  private tools: MCPTool[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private eventEmitter = new vscode.EventEmitter<MCPMessage>();
  
  /**
   * Create a new MCP bridge
   */
  constructor(url = 'ws://localhost:9000') {
    this.url = url;
  }
  
  /**
   * Get event when messages are received
   */
  public get onMessage(): vscode.Event<MCPMessage> {
    return this.eventEmitter.event;
  }
  
  /**
   * Connect to the MCP server
   */
  public async connect(): Promise<boolean> {
    if (this.connected) {
      return true;
    }
    
    return new Promise<boolean>((resolve) => {
      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.on('open', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.startPingInterval();
          
          // Process any queued messages
          this.processMessageQueue();
          
          // Send connect message
          this.sendMessage({
            type: MCPMessageType.CONNECT,
            id: this.generateMessageId(),
            timestamp: Date.now()
          });
          
          resolve(true);
        });
        
        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString()) as MCPMessage;
            this.handleMessage(message);
          } catch (error) {
            console.error('MCP: Failed to parse message:', data.toString(), error);
          }
        });
        
        this.ws.on('error', (error: Error) => {
          console.error('MCP: WebSocket error:', error);
          if (!this.connected) {
            resolve(false);
          }
        });
        
        this.ws.on('close', () => {
          this.connected = false;
          this.stopPingInterval();
          this.scheduleReconnect();
        });
      } catch (error) {
        console.error('MCP: Failed to connect:', error);
        resolve(false);
      }
    });
  }
  
  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    const delay = Math.min(2 ** this.reconnectAttempts * 1000, 30000);
    this.reconnectAttempts++;
    
    this.reconnectTimer = setTimeout(async () => {
      console.log(`MCP: Attempting to reconnect (attempt ${this.reconnectAttempts})...`);
      if (await this.connect()) {
        console.log('MCP: Reconnected successfully');
      }
    }, delay);
  }
  
  /**
   * Start the ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    
    this.pingInterval = setInterval(() => {
      if (this.connected) {
        this.sendMessage({
          type: MCPMessageType.PING,
          timestamp: Date.now()
        });
      }
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Stop the ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  /**
   * Disconnect from the MCP server
   */
  public disconnect(): void {
    this.stopPingInterval();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    
    this.connected = false;
  }
  
  /**
   * Send a message to the MCP server
   */
  public sendMessage(message: MCPMessage): void {
    if (!this.connected || !this.ws) {
      // Queue the message for when we connect
      this.messageQueue.push(message);
      
      // Try to connect
      if (!this.connected) {
        this.connect();
      }
      
      return;
    }
    
    try {
      const json = JSON.stringify(message);
      this.ws.send(json);
    } catch (error) {
      console.error('MCP: Failed to send message:', error);
    }
  }
  
  /**
   * Process the message queue
   */
  private processMessageQueue(): void {
    if (!this.connected || this.messageQueue.length === 0) {
      return;
    }
    
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const message of queue) {
      this.sendMessage(message);
    }
  }
  
  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
  
  /**
   * Handle an incoming message
   */
  private handleMessage(message: MCPMessage): void {
    // Handle built-in message types
    if (message.type === MCPMessageType.LIST_TOOLS && 'tools' in message) {
      const toolListMessage = message as MCPToolListResult;
      this.tools = toolListMessage.tools;
    }
    
    // Fire the event directly
    this.eventEmitter.fire(message);
    
    // Handle message by ID if there's a registered handler
    if (message.id && this.messageHandlers.has(message.id)) {
      const handler = this.messageHandlers.get(message.id);
      if (handler) {
        handler(message);
        this.messageHandlers.delete(message.id);
      }
    }
  }
  
  /**
   * Get the list of available tools
   */
  public async listTools(): Promise<MCPTool[]> {
    if (!this.connected) {
      await this.connect();
    }
    
    return new Promise<MCPTool[]>((resolve) => {
      const message: MCPMessage = {
        type: MCPMessageType.LIST_TOOLS,
        id: this.generateMessageId(),
        timestamp: Date.now()
      };
      
      // Register handler for the response
      this.messageHandlers.set(message.id as string, (response) => {
        const toolListMessage = response as MCPToolListResult;
        this.tools = toolListMessage.tools || [];
        resolve(this.tools);
      });
      
      this.sendMessage(message);
      
      // Set timeout for response
      setTimeout(() => {
        if (message.id && this.messageHandlers.has(message.id)) {
          this.messageHandlers.delete(message.id);
          resolve([]);
        }
      }, 5000);
    });
  }
  
  /**
   * Execute a tool
   */
  public async executeTool(toolName: string, parameters: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      await this.connect();
    }
    
    return new Promise<unknown>((resolve, reject) => {
      const message: MCPToolExecutionRequest = {
        type: MCPMessageType.EXECUTE_TOOL,
        id: this.generateMessageId(),
        timestamp: Date.now(),
        tool: toolName,
        parameters
      };
      
      // Register handler for the response
      this.messageHandlers.set(message.id as string, (response) => {
        if (response.type === MCPMessageType.ERROR) {
          const errorMessage = response as MCPErrorMessage;
          reject(new Error(errorMessage.error || 'Unknown error'));
          return;
        }
        
        if (response.type === MCPMessageType.TOOL_RESULT) {
          const resultMessage = response as MCPToolResult;
          resolve(resultMessage.result);
        } else {
          reject(new Error(`Unexpected response type: ${response.type}`));
        }
      });
      
      this.sendMessage(message);
      
      // Set timeout for response
      setTimeout(() => {
        if (message.id && this.messageHandlers.has(message.id)) {
          this.messageHandlers.delete(message.id);
          reject(new Error('Tool execution timed out'));
        }
      }, 60000);
    });
  }
  
  /**
   * Check if we are connected to the MCP server
   */
  public isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Get the list of available tools
   */
  public getTools(): MCPTool[] {
    return [...this.tools];
  }
  
  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.disconnect();
    this.eventEmitter.dispose();
  }
} 