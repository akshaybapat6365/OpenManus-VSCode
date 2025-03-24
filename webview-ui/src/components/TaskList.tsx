import React from 'react';
import { Task, TaskStatus, TaskPriority } from '../types/task';

interface TaskListProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onTaskSelect: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}

/**
 * Task list component
 */
const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  selectedTaskId, 
  onTaskSelect, 
  onStatusChange 
}) => {
  if (tasks.length === 0) {
    return (
      <div className="text-gray-400 italic text-center py-10">
        No tasks available. Create a new task to get started.
      </div>
    );
  }

  // Group tasks by status
  const grouped = tasks.reduce((acc, task) => {
    if (!acc[task.status]) {
      acc[task.status] = [];
    }
    acc[task.status].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // Sort by priority within each group
  Object.keys(grouped).forEach(status => {
    grouped[status].sort((a, b) => {
      const priorityValues = {
        [TaskPriority.High]: 3,
        [TaskPriority.Medium]: 2,
        [TaskPriority.Low]: 1
      };
      return priorityValues[b.priority] - priorityValues[a.priority];
    });
  });

  // Order of statuses
  const statusOrder = [
    TaskStatus.InProgress,
    TaskStatus.Pending,
    TaskStatus.Completed,
    TaskStatus.Failed
  ];

  const getPriorityColor = (priority: TaskPriority): string => {
    switch (priority) {
      case TaskPriority.High:
        return 'bg-red-500';
      case TaskPriority.Medium:
        return 'bg-yellow-500';
      case TaskPriority.Low:
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case TaskStatus.InProgress:
        return 'bg-blue-500';
      case TaskStatus.Completed:
        return 'bg-green-500';
      case TaskStatus.Failed:
        return 'bg-red-500';
      case TaskStatus.Pending:
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatStatus = (status: TaskStatus): string => {
    switch (status) {
      case TaskStatus.InProgress:
        return 'In Progress';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const getNextStatus = (status: TaskStatus): TaskStatus => {
    switch (status) {
      case TaskStatus.Pending:
        return TaskStatus.InProgress;
      case TaskStatus.InProgress:
        return TaskStatus.Completed;
      default:
        return status;
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {statusOrder.map(status => 
        grouped[status] && grouped[status].length > 0 && (
          <div key={status} className="task-group">
            <h3 className="text-md font-medium text-gray-300 mb-2">
              {formatStatus(status)} ({grouped[status].length})
            </h3>
            <div className="flex flex-col space-y-2">
              {grouped[status].map(task => (
                <div 
                  key={task.id}
                  className={`
                    p-3 rounded cursor-pointer transition-colors
                    ${selectedTaskId === task.id 
                      ? 'bg-vscode-sidebar-bg border-l-4 border-primary-500' 
                      : 'bg-neutral-800 hover:bg-neutral-700'
                    }
                  `}
                  onClick={() => onTaskSelect(task.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-medium text-sm">{task.title}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full text-white ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-400 mb-2 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full text-white ${getStatusColor(task.status)}`}>
                      {formatStatus(task.status)}
                    </span>
                    {status !== TaskStatus.Completed && status !== TaskStatus.Failed && (
                      <button
                        type="button"
                        className="text-xs px-2 py-1 bg-vscode-button-bg text-vscode-button-fg rounded hover:bg-vscode-button-hover-bg"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(task.id, getNextStatus(task.status));
                        }}
                      >
                        {status === TaskStatus.Pending ? 'Start' : 'Complete'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default TaskList; 