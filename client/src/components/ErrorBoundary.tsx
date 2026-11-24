import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[PM Vision ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100vw',
          height: '100vh',
          backgroundColor: '#000000',
          color: '#e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Quicksand, sans-serif',
          padding: '2rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: '#0a0a0a',
            border: '1px solid #262626',
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.9)'
          }}>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#5F7A9A',
              letterSpacing: '0.08em',
              marginBottom: '0.75rem'
            }}>
              PM VISION
            </div>
            <div style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: '#ffffff',
              marginBottom: '0.5rem'
            }}>
              Dashboard Refresh Required
            </div>
            <p style={{
              fontSize: '0.8rem',
              color: '#9ca3af',
              lineHeight: 1.5,
              marginBottom: '1.5rem'
            }}>
              A component encountered a rendering interruption. Click below to reload the market workspace.
            </p>

            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#5F7A9A',
                color: '#ffffff',
                border: 'none',
                padding: '0.6rem 1.6rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4d6582')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#5F7A9A')}
            >
              Reload Dashboard
            </button>

            {this.state.error && (
              <details style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                <summary style={{ fontSize: '0.70rem', color: '#737373', cursor: 'pointer' }}>
                  Technical diagnostics
                </summary>
                <pre style={{
                  marginTop: '0.5rem',
                  fontSize: '0.68rem',
                  color: '#ef4444',
                  backgroundColor: '#050505',
                  padding: '0.6rem',
                  borderRadius: '4px',
                  overflowX: 'auto',
                  border: '1px solid #1a1a1a'
                }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
