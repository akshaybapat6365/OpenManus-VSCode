import React, { useState, useEffect, useRef } from 'react';
import { ChatMessageData } from '../types/message';

/**
 * Props for the ChatPanel component
 */
interface ChatPanelProps {
  messages: ChatMessageData[];
  onSendMessage: (content: string) => void;
}

/**
 * Chat panel component for communicating with OpenManus
 */
const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage }) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send message
  const sendMessage = () => {
    if (!input.trim() || isProcessing) {
      return;
    }

    // Update UI state
    setIsProcessing(true);
    
    // Send message to parent
    onSendMessage(input);
    
    // Clear input
    setInput('');
    
    // Reset processing state (could be done when response is received)
    setTimeout(() => setIsProcessing(false), 500);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  // Handle keyboard press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
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
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
              />
            </svg>
            <p>No messages yet. Start a conversation with OpenManus.</p>
          </div>
        ) : (
          messages.map(message => (
            <div 
              key={message.id} 
              className={`
                flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}
              `}
            >
              <div 
                className={`
                  max-w-3/4 p-3 rounded-lg
                  ${message.role === 'user' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-neutral-700 text-gray-100'}
                `}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs opacity-70 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message to OpenManus..."
            className="flex-1 bg-vscode-input-bg text-vscode-input-fg p-2 rounded border border-gray-600"
            disabled={isProcessing}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={isProcessing || !input.trim()}
            className={`
              px-4 py-2 rounded
              ${isProcessing || !input.trim() 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-vscode-button-bg text-vscode-button-fg hover:bg-vscode-button-hover-bg'}
            `}
          >
            {isProcessing ? (
              <span className="flex items-center">
                <svg 
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing
              </span>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel; 