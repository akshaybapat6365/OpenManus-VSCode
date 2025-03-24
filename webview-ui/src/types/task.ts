/**
 * Task status enum
 */
export enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in-progress',
  Completed = 'completed',
  Failed = 'failed'
}

/**
 * Task priority enum
 */
export enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high'
}

/**
 * Assignment type enum
 */
export enum AssignmentType {
  Human = 'human',
  AI = 'ai'
}

/**
 * Task interface
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[];
  assignedTo: AssignmentType;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Task creation parameters
 */
export interface TaskCreationParams {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dependencies?: string[];
  assignedTo?: AssignmentType;
}

/**
 * Task update parameters
 */
export interface TaskUpdateParams {
  id: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dependencies?: string[];
  assignedTo?: AssignmentType;
} 