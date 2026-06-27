import React from 'react';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Sparkles,
  X
} from 'lucide-react';
import { type APIConfig } from '../utils/ragEngine';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
}

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onClearAllSessions: () => void;
  config: APIConfig;
  onClose?: () => void;
  isOpen?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onClearAllSessions,
  config,
  onClose,
  isOpen
}) => {

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Brand Header */}
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid var(--border-glass)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0, 113, 227, 0.2)'
          }}>
            <Sparkles size={18} color="white" />
          </div>
          <div>
            <h1 style={{
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '1px',
              background: 'linear-gradient(90deg, #fff, var(--text-secondary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>AURA RAG</h1>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Classy PDF Intelligence</span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="mobile-only-close btn-icon"
            style={{
              width: '32px',
              height: '32px',
              padding: 0,
              border: '1px solid var(--border-glass)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button className="btn-primary" onClick={onCreateSession} style={{ width: '100%' }}>
          <Plus size={18} />
          New Session
        </button>
      </div>

      {/* Session List */}
      <div className="sidebar-session-list" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 20px 20px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <span style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          color: 'var(--text-muted)',
          fontWeight: 700,
          marginBottom: '4px',
          paddingLeft: '4px'
        }}>Recent Chats</span>
        
        {sessions.length === 0 ? (
          <div style={{
            padding: '20px 10px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px',
            border: '1px dashed rgba(255,255,255,0.05)',
            borderRadius: 'var(--radius-sm)'
          }}>
            No recent sessions
          </div>
        ) : (
          sessions.map(session => (
            <div 
              key={session.id}
              className={`fade-in`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                background: activeSessionId === session.id ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                border: '1px solid',
                borderColor: activeSessionId === session.id ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                transition: 'var(--transition-fast)'
              }}
              onClick={() => onSelectSession(session.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
                <MessageSquare size={16} color={activeSessionId === session.id ? 'var(--color-primary)' : 'var(--text-muted)'} />
                <span style={{
                  fontSize: '14px',
                  color: activeSessionId === session.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: activeSessionId === session.id ? 600 : 400,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1
                }}>
                  {session.title}
                </span>
              </div>
              <button 
                className="btn-icon" 
                style={{ width: '28px', height: '28px', padding: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer Controls */}
      <div style={{
        borderTop: '1px solid var(--border-glass)',
        background: 'rgba(5, 8, 15, 0.6)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Clear Chats Button */}
        {sessions.length > 0 && (
          <button 
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              padding: '12px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 500,
              width: '100%',
              borderBottom: '1px solid var(--border-glass)',
              transition: 'var(--transition-fast)'
            }}
            onClick={onClearAllSessions}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <Trash2 size={14} />
            Clear All History
          </button>
        )}




        {/* Info panel */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-muted)'
        }}>
          <span>Engine Status</span>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: config.apiKey ? 'var(--color-success)' : 'var(--color-warning)',
            fontWeight: 600
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: config.apiKey ? 'var(--color-success)' : 'var(--color-warning)',
              display: 'inline-block'
            }}></span>
            {config.apiKey ? `${config.provider.toUpperCase()} Ready` : 'No API Key'}
          </span>
        </div>
      </div>
    </aside>
  );
};
