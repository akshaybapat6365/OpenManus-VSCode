import React, { useState } from 'react';
import { Task, TaskStatus, TaskPriority, AssignmentType } from '../types/task';

interface TaskDetailProps {
  task: Task;
  onTaskUpdate: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
}

/**
 * Task detail component
 */
const TaskDetail: React.FC<TaskDetailProps> = ({ task, onTaskUpdate, onTaskDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Task>(task);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Update local state when task prop changes
  React.useEffect(() => {
    setEditedTask(task);
    setIsEditing(false);
    setConfirmDelete(false);
  }, [task]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedTask(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStatusChange = (status: TaskStatus) => {
    setEditedTask(prev => ({
      ...prev,
      status,
      ...(status === TaskStatus.Completed ? { completedAt: new Date().toISOString() } : {})
    }));
  };

  const handleSave = () => {
    onTaskUpdate(editedTask);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTask(task);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onTaskDelete(task.id);
    } else {
      setConfirmDelete(true);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatStatus = (status: TaskStatus): string => {
    switch (status) {
      case TaskStatus.InProgress:
        return 'In Progress';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <div className="task-detail p-4 bg-neutral-800 rounded-md shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          {isEditing ? (
            <input
              type="text"
              name="title"
              value={editedTask.title}
              onChange={handleInputChange}
              className="w-full bg-vscode-input-bg text-vscode-input-fg p-2 rounded border border-gray-600"
              aria-label="Task title"
            />
          ) : (
            task.title
          )}
        </h2>
        <div className="flex space-x-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleSave}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 bg-vscode-button-bg text-vscode-button-fg rounded hover:bg-vscode-button-hover-bg"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Status and priority */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="status-section">
          <h3 className="text-sm text-gray-400 mb-1">Status</h3>
          {isEditing ? (
            <select
              name="status"
              value={editedTask.status}
              onChange={handleInputChange}
              className="bg-vscode-input-bg text-vscode-input-fg p-2 rounded border border-gray-600"
              aria-label="Task status"
            >
              <option value={TaskStatus.Pending}>Pending</option>
              <option value={TaskStatus.InProgress}>In Progress</option>
              <option value={TaskStatus.Completed}>Completed</option>
              <option value={TaskStatus.Failed}>Failed</option>
            </select>
          ) : (
            <div className="flex space-x-2 mt-1">
              <span className="bg-neutral-700 text-sm px-2 py-1 rounded">
                {formatStatus(task.status)}
              </span>
              {task.status !== TaskStatus.Completed && task.status !== TaskStatus.Failed && (
                <button
                  type="button"
                  onClick={() => {
                    const nextStatus = task.status === TaskStatus.Pending 
                      ? TaskStatus.InProgress 
                      : TaskStatus.Completed;
                    onTaskUpdate({
                      ...task,
                      status: nextStatus,
                      ...(nextStatus === TaskStatus.Completed ? { completedAt: new Date().toISOString() } : {})
                    });
                  }}
                  className="text-xs bg-vscode-button-bg text-vscode-button-fg px-2 py-1 rounded hover:bg-vscode-button-hover-bg"
                >
                  {task.status === TaskStatus.Pending ? 'Start' : 'Complete'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="priority-section">
          <h3 className="text-sm text-gray-400 mb-1">Priority</h3>
          {isEditing ? (
            <select
              name="priority"
              value={editedTask.priority}
              onChange={handleInputChange}
              className="bg-vscode-input-bg text-vscode-input-fg p-2 rounded border border-gray-600"
              aria-label="Task priority"
            >
              <option value={TaskPriority.Low}>Low</option>
              <option value={TaskPriority.Medium}>Medium</option>
              <option value={TaskPriority.High}>High</option>
            </select>
          ) : (
            <span className={`
              text-sm px-2 py-1 rounded
              ${task.priority === TaskPriority.High 
                ? 'bg-red-500 text-white' 
                : task.priority === TaskPriority.Medium 
                  ? 'bg-yellow-500 text-white' 
                  : 'bg-green-500 text-white'}
            `}>
              {task.priority}
            </span>
          )}
        </div>

        <div className="assignment-section">
          <h3 className="text-sm text-gray-400 mb-1">Assigned To</h3>
          {isEditing ? (
            <select
              name="assignedTo"
              value={editedTask.assignedTo}
              onChange={handleInputChange}
              className="bg-vscode-input-bg text-vscode-input-fg p-2 rounded border border-gray-600"
              aria-label="Task assignment"
            >
              <option value={AssignmentType.Human}>Human</option>
              <option value={AssignmentType.AI}>AI</option>
            </select>
          ) : (
            <span className={`
              text-sm px-2 py-1 rounded
              ${task.assignedTo === AssignmentType.AI ? 'bg-purple-500 text-white' : 'bg-blue-500 text-white'}
            `}>
              {task.assignedTo}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="description-section mb-4">
        <h3 className="text-sm text-gray-400 mb-1">Description</h3>
        {isEditing ? (
          <textarea
            name="description"
            value={editedTask.description}
            onChange={handleInputChange}
            className="w-full bg-vscode-input-bg text-vscode-input-fg p-2 rounded border border-gray-600 h-32"
            aria-label="Task description"
          />
        ) : (
          <div className="bg-neutral-700 p-3 rounded whitespace-pre-wrap">
            {task.description || 'No description provided.'}
          </div>
        )}
      </div>

      {/* Dates information */}
      <div className="dates-section mb-6">
        <h3 className="text-sm text-gray-400 mb-1">Timeline</h3>
        <div className="grid grid-cols-2 gap-2 text-xs bg-neutral-700 p-3 rounded">
          <div>
            <span className="block text-gray-400">Created:</span>
            <span>{formatDate(task.createdAt)}</span>
          </div>
          <div>
            <span className="block text-gray-400">Last Updated:</span>
            <span>{formatDate(task.updatedAt)}</span>
          </div>
          {task.completedAt && (
            <div className="col-span-2">
              <span className="block text-gray-400">Completed:</span>
              <span>{formatDate(task.completedAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Delete button */}
      <div className="actions mt-6 border-t border-gray-700 pt-4">
        <button
          type="button"
          onClick={handleDelete}
          className={`px-3 py-1 rounded ${
            confirmDelete 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-neutral-700 text-gray-300 hover:bg-neutral-600'
          }`}
        >
          {confirmDelete ? 'Confirm Delete' : 'Delete Task'}
        </button>
        {confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="ml-2 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default TaskDetail; 