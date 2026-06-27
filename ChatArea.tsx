import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Download, 
  Trash2, 
  MessageSquare,
  FileText,
  BookOpen,
  Menu
} from 'lucide-react';
import type { DocumentChunk } from '../utils/ragEngine';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: DocumentChunk[];
}

interface ChatAreaProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  onSelectSource: (chunk: DocumentChunk) => void;
  isGenerating: boolean;
  activeSessionId: string;
  hasDocuments: boolean;
  onToggleSidebar?: () => void;
  onToggleDocPanel?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  onSendMessage,
  onClearChat,
  onSelectSource,
  isGenerating,
  activeSessionId,
  hasDocuments,
  onToggleSidebar,
  onToggleDocPanel
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Download session transcript as markdown
  const handleDownloadTranscript = () => {
    if (messages.length === 0) return;

    let mdText = `# Chat Transcript - Aura RAG System\n`;
    mdText += `Session ID: ${activeSessionId}\n`;
    mdText += `Date: ${new Date().toLocaleDateString()}\n\n---\n\n`;

    messages.forEach((msg) => {
      const sender = msg.role === 'user' ? 'USER' : 'AURA RAG';
      mdText += `### **${sender}** (${msg.timestamp})\n\n${msg.content}\n\n`;

      if (msg.role === 'assistant' && msg.sources && msg.sources.length > 0) {
        mdText += `*Sources cited:*\n`;
        msg.sources.forEach((src, idx) => {
          mdText += `${idx + 1}. [Page ${src.pageNumber}] ${src.fileName} — "${src.text.trim().substring(0, 100)}..."\n`;
        });
        mdText += `\n`;
      }
      mdText += `---\n\n`;
    });

    const blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aura-rag-transcript-${activeSessionId}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom Inline Markdown + Citation Parser
  const parseInlineElements = (text: string, sources: DocumentChunk[] = []) => {
    // Regex for bold **text**
    // Regex for inline code `code`
    // Regex for citations [Source X]
    const regex = /(\*\*.*?\*\*|`.*?`|\[Source\s+\d+\])/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index} style={{
          fontFamily: 'var(--font-mono)',
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.85em',
          color: '#fb7185'
        }}>{part.slice(1, -1)}</code>;
      }
      
      const citMatch = part.match(/^\[Source\s+(\d+)\]$/);
      if (citMatch) {
        const sourceNum = parseInt(citMatch[1], 10);
        const sourceIndex = sourceNum - 1;
        const chunk = sources[sourceIndex];
        
        if (chunk) {
          return (
            <button
              key={index}
              className="citation-link"
              onClick={() => onSelectSource(chunk)}
              title={`${chunk.fileName} (Page ${chunk.pageNumber})`}
            >
              Source {sourceNum}
            </button>
          );
        }
      }
      
      return part;
    });
  };

  // Full Line-by-Line Markdown Parser
  const renderClassyMarkdown = (text: string, sources: DocumentChunk[] = []) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let insideCodeBlock = false;
    let codeBlockLines: string[] = [];

    lines.forEach((line, index) => {
      // Code Blocks
      if (line.trim().startsWith('```')) {
        if (insideCodeBlock) {
          insideCodeBlock = false;
          elements.push(
            <pre key={`code-${index}`} style={{
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '14px',
              borderRadius: 'var(--radius-sm)',
              overflowX: 'auto',
              border: '1px solid var(--border-glass)',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              margin: '10px 0',
              color: '#e2e8f0'
            }}>
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          );
          codeBlockLines = [];
        } else {
          insideCodeBlock = true;
        }
        return;
      }

      if (insideCodeBlock) {
        codeBlockLines.push(line);
        return;
      }

      const trimmedLine = line.trim();

      // Headings
      if (trimmedLine.startsWith('# ')) {
        elements.push(<h1 key={index} style={{ fontSize: '20px', fontWeight: 700, margin: '18px 0 8px 0', color: '#fff' }}>{parseInlineElements(trimmedLine.slice(2), sources)}</h1>);
      } else if (trimmedLine.startsWith('## ')) {
        elements.push(<h2 key={index} style={{ fontSize: '17px', fontWeight: 600, margin: '16px 0 8px 0', color: '#fff' }}>{parseInlineElements(trimmedLine.slice(3), sources)}</h2>);
      } else if (trimmedLine.startsWith('### ')) {
        elements.push(<h3 key={index} style={{ fontSize: '15px', fontWeight: 600, margin: '14px 0 8px 0', color: '#fff' }}>{parseInlineElements(trimmedLine.slice(4), sources)}</h3>);
      }
      // Bullet points
      else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        elements.push(
          <li key={index} style={{ marginLeft: '20px', marginBottom: '4px', listStyleType: 'disc' }}>
            {parseInlineElements(trimmedLine.slice(2), sources)}
          </li>
        );
      }
      // Numbered List
      else if (/^\d+\.\s/.test(trimmedLine)) {
        const dotIndex = trimmedLine.indexOf('.');
        elements.push(
          <li key={index} style={{ marginLeft: '20px', marginBottom: '4px', listStyleType: 'decimal' }}>
            {parseInlineElements(trimmedLine.slice(dotIndex + 2), sources)}
          </li>
        );
      }
      // Blockquotes
      else if (trimmedLine.startsWith('> ')) {
        elements.push(
          <blockquote key={index} style={{
            borderLeft: '3px solid var(--color-primary)',
            paddingLeft: '12px',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            margin: '10px 0'
          }}>
            {parseInlineElements(trimmedLine.slice(2), sources)}
          </blockquote>
        );
      }
      // Empty lines
      else if (trimmedLine === '') {
        elements.push(<div key={index} style={{ height: '8px' }} />);
      }
      // Standard Paragraph
      else {
        elements.push(
          <p key={index} style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>
            {parseInlineElements(line, sources)}
          </p>
        );
      }
    });

    return <div className="markdown-body">{elements}</div>;
  };

  return (
    <div className="chat-container">
      {/* Header bar */}
      <div className="chat-header" style={{
        padding: '0 24px',
        borderBottom: '1px solid var(--border-glass)',
        background: 'rgba(5, 8, 15, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '71px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onToggleSidebar && (
            <button 
              className="mobile-only-toggle btn-icon"
              onClick={onToggleSidebar}
              style={{ marginRight: '4px', border: '1px solid var(--border-glass)', borderRadius: '6px', width: '32px', height: '32px' }}
            >
              <Menu size={16} />
            </button>
          )}
          <MessageSquare size={18} color="var(--color-primary)" className="desktop-only-icon" />
          <span style={{ fontSize: '15px', fontWeight: 600 }}>Active Chat Conversation</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {messages.length > 0 && (
            <>
              <button 
                className="btn-secondary desktop-only-btn"
                style={{ padding: '8px 14px', fontSize: '12px', height: '36px' }}
                onClick={handleDownloadTranscript}
              >
                <Download size={14} />
                Export Transcript
              </button>
              <button 
                className="btn-secondary desktop-only-btn"
                style={{ 
                  padding: '8px 14px', 
                  fontSize: '12px', 
                  height: '36px',
                  borderColor: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--color-danger)'
                }}
                onClick={onClearChat}
              >
                <Trash2 size={14} />
                Clear Chat
              </button>

              {/* Mobile quick action buttons */}
              <button 
                className="mobile-only-btn btn-icon"
                onClick={handleDownloadTranscript}
                title="Export Transcript"
                style={{ border: '1px solid var(--border-glass)', borderRadius: '6px', width: '32px', height: '32px' }}
              >
                <Download size={13} />
              </button>
              <button 
                className="mobile-only-btn btn-icon"
                onClick={onClearChat}
                title="Clear Chat"
                style={{ border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--color-danger)', width: '32px', height: '32px' }}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}

          {onToggleDocPanel && (
            <button 
              className="mobile-only-toggle btn-icon"
              onClick={onToggleDocPanel}
              style={{ marginLeft: '4px', border: '1px solid var(--border-glass)', borderRadius: '6px', width: '32px', height: '32px' }}
            >
              <FileText size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Message Feed */}
      <div className="message-feed" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '15px',
            opacity: 0.8
          }}>
            <div style={{
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0) 70%)',
              width: '120px',
              height: '120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <BookOpen size={42} color="var(--text-secondary)" />
            </div>
            <div style={{ textAlign: 'center', maxWidth: '400px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Start Researching</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {!hasDocuments 
                  ? "Upload your PDFs in the right panel to extract text, generate semantic embeddings, and start asking context-grounded questions."
                  : "Type a query in the box below. Aura will scan the parsed PDF chunks, retrieve the top matches, and formulate a citation-backed response."}
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id}
              className={`fade-in`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: '6px'
              }}
            >
              <span style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontWeight: 600,
                padding: '0 4px'
              }}>
                {msg.role === 'user' ? 'USER' : 'AURA RAG'} • {msg.timestamp}
              </span>
              
              <div className={`message-bubble ${msg.role}`}>
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  renderClassyMarkdown(msg.content, msg.sources)
                )}

                {/* Sources list inside the assistant bubble */}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div style={{
                    marginTop: '16px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    paddingTop: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <FileText size={11} />
                      CITED REFERENCE RECORDS
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {msg.sources.map((src, index) => (
                        <div 
                          key={index}
                          onClick={() => onSelectSource(src)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-glass)',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'var(--transition-fast)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--color-primary)';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-glass)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }}
                        >
                          <span style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '9px'
                          }}>
                            {index + 1}
                          </span>
                          <span style={{
                            maxWidth: '120px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {src.fileName}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                            (Pg. {src.pageNumber})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {isGenerating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, padding: '0 4px' }}>
              AURA RAG • thinking...
            </span>
            <div className="message-bubble assistant" style={{ padding: '12px 16px' }}>
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="chat-input-area" style={{
        padding: '20px 24px',
        borderTop: '1px solid var(--border-glass)',
        background: 'rgba(5, 8, 15, 0.4)'
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
          <textarea
            className="glass-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={
              !hasDocuments
                ? "Please upload at least one PDF to start querying..."
                : "Ask a question about your indexed documents..."
            }
            rows={1}
            disabled={isGenerating}
            style={{
              resize: 'none',
              height: '50px',
              padding: '14px 50px 14px 16px',
              lineHeight: '1.4',
              borderRadius: 'var(--radius-md)'
            }}
          />
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={isGenerating || !input.trim() || !hasDocuments}
            style={{
              position: 'absolute',
              right: '8px',
              top: '6px',
              width: '38px',
              height: '38px',
              padding: 0,
              borderRadius: '10px',
              boxShadow: 'none'
            }}
          >
            <Send size={16} />
          </button>
        </form>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
          fontSize: '11px',
          color: 'var(--text-muted)',
          padding: '0 4px'
        }}>
          <span>Press Enter to send, Shift+Enter for new line.</span>
          <span>Citations are automatically linked to reference passages.</span>
        </div>
      </div>
    </div>
  );
};
