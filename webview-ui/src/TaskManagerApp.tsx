import React, { useState, useEffect } from 'react';
import { vscode } from './utilities/vscode';
import { Task, TaskStatus, TaskPriority } from './types/task';
import { MessageType, MessageUnion, ChatMessageData } from './types/message';
import TaskList from './components/TaskList';
import TaskDetail from './components/TaskDetail';
import ChatPanel from './components/ChatPanel';

/**
 * Main Task Manager Application
 */
const TaskManagerApp: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'chat'>('tasks');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [chatMessages, setChatMessages] = useState<ChatMessageData[]>([]);

  // Get the selected task
  const selectedTask = selectedTaskId 
    ? tasks.find((task: Task) => task.id === selectedTaskId) 
    : null;

  // Load tasks on mount
  useEffect(() => {
    // Initialize the connection with the extension
    vscode.postMessage({ type: MessageType.Init });
    
    // Set up message listener
    const fetchTasks = async () => {
      setIsLoading(true);
      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    };
    
    fetchTasks();
  }, []);

  // Handle messages from the extension
  const handleMessage = (event: MessageEvent) => {
    const message = event.data as MessageUnion;
    
    switch (message.type) {
      case MessageType.TaskList:
        setTasks(message.tasks as Task[]);
        setIsLoading(false);
        break;
        
      case MessageType.TaskAdded:
        setTasks(prev => [...prev, message.task as Task]);
        break;
        
      case MessageType.TaskUpdated:
        setTasks(prev => 
          prev.map((task: Task) => 
            task.id === (message.task as Task).id ? (message.task as Task) : task
          )
        );
        break;
        
      case MessageType.TaskDeleted:
        setTasks(prev => prev.filter((task: Task) => task.id !== message.taskId));
        if (selectedTaskId === message.taskId) {
          setSelectedTaskId(null);
        }
        break;
      
      case MessageType.ChatMessage:
        // Add incoming chat message
        setChatMessages(prev => [...prev, message.message as ChatMessageData]);
        break;
      
      case MessageType.Error:
        // Display error (could use a notification component in future)
        console.error('Error from extension:', message.message);
        break;
    }
  };

  // Handle task selection
  const handleTaskSelect = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  // Handle task creation
  const handleCreateTask = () => {
    const prompt = window.prompt('Enter a task title:');
    if (prompt) {
      vscode.postMessage({ 
        type: MessageType.NewTask, 
        prompt, 
        priority: TaskPriority.Medium 
      });
    }
  };

  // Handle task update
  const handleUpdateTask = (updatedTask: Task) => {
    vscode.postMessage({
      type: MessageType.UpdateTask,
      taskId: updatedTask.id,
      status: updatedTask.status
    });
  };

  // Handle task deletion
  const handleDeleteTask = (taskId: string) => {
    vscode.postMessage({
      type: MessageType.DeleteTask,
      taskId
    });
  };

  // Handle task status change
  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    const task = tasks.find((t: Task) => t.id === taskId);
    if (task) {
      const updatedTask = { ...task, status };
      handleUpdateTask(updatedTask);
    }
  };

  // Handle tab change
  const handleTabChange = (tab: 'tasks' | 'chat') => {
    setActiveTab(tab);
  };

  // Send chat message
  const handleSendChatMessage = (content: string) => {
    vscode.postMessage({
      type: MessageType.SendPrompt,
      text: content
    });
  };

  return (
    <div className="flex flex-col h-full bg-vscode-bg text-vscode-fg">
      {/* Header Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          type="button"
          className={`px-4 py-2 font-medium ${
            activeTab === 'tasks'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
          onClick={() => handleTabChange('tasks')}
        >
          Tasks
        </button>
        <button
          type="button"
          className={`px-4 py-2 font-medium ${
            activeTab === 'chat'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
          onClick={() => handleTabChange('chat')}
        >
          Chat
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'tasks' ? (
          <div className="flex h-full">
            {/* Task List */}
            <div className="w-1/3 border-r border-gray-700 p-4 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Tasks</h2>
                <button
                  type="button"
                  className="px-3 py-1 bg-vscode-button-bg text-vscode-button-fg rounded hover:bg-vscode-button-hover-bg"
                  onClick={handleCreateTask}
                >
                  New Task
                </button>
              </div>
              
              {isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-400" />
                </div>
              ) : (
                <TaskList
                  tasks={tasks}
                  onTaskSelect={handleTaskSelect}
                  selectedTaskId={selectedTaskId}
                  onStatusChange={handleStatusChange}
                />
              )}
            </div>

            {/* Task Detail */}
            <div className="w-2/3 p-4 overflow-y-auto">
              {selectedTask ? (
                <TaskDetail
                  task={selectedTask}
                  onTaskUpdate={handleUpdateTask}
                  onTaskDelete={handleDeleteTask}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <svg
                    className="w-12 h-12 mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <p>Select a task to view details</p>
                  <button
                    type="button"
                    className="mt-4 px-3 py-1 bg-vscode-button-bg text-vscode-button-fg rounded hover:bg-vscode-button-hover-bg"
                    onClick={handleCreateTask}
                  >
                    Create a New Task
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <ChatPanel 
            messages={chatMessages}
            onSendMessage={handleSendChatMessage}
          />
        )}
      </div>
    </div>
  );
};

export default TaskManagerApp; 