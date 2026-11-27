import React from 'react';

interface StatusCardProps {
  title: string;
  status: 'online' | 'offline' | 'loading';
  details?: { [key: string]: string | number };
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const StatusCard: React.FC<StatusCardProps> = ({
  title,
  status,
  details,
  action
}) => {
  const getBadgeColor = () => {
    switch (status) {
      case 'online':
        return '#10b981';
      case 'offline':
        return '#ef4444';
      case 'loading':
        return '#f59e0b';
    }
  };

  return (
    <div style={{
      backgroundColor: '#131c2e',
      border: '1px solid #1e293b',
      borderRadius: '8px',
      padding: '1.25rem',
      flex: 1,
      minWidth: '280px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9' }}>{title}</h3>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 8px',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          backgroundColor: `${getBadgeColor()}20`,
          color: getBadgeColor()
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: getBadgeColor()
          }} />
          {status}
        </span>
      </div>

      {details && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {Object.entries(details).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: '#94a3b8' }}>{key}</span>
              <span style={{ color: '#cbd5e1', fontFamily: 'Quicksand, sans-serif' }}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {action && (
        <button onClick={action.onClick} style={{ width: '100%', marginTop: '0.5rem' }}>
          {action.label}
        </button>
      )}
    </div>
  );
};
