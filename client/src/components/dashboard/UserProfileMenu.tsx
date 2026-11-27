import React, { useState, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import { isFirebaseConfigured, signInWithGoogle, signOutUser } from '../../services/firebase';

interface UserProfileMenuProps {
  user: User | null;
  isSyncing?: boolean;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({ user, isSyncing = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImgFailed(false);
  }, [user?.photoURL]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsBusy(true);
    try {
      await signInWithGoogle();
      setIsOpen(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google sign-in failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSignOut = async () => {
    setIsBusy(true);
    try {
      await signOutUser();
      setIsOpen(false);
    } finally {
      setIsBusy(false);
    }
  };

  const initial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => {
          setErrorMsg(null);
          setIsOpen((prev) => !prev);
        }}
        title={user ? `${user.displayName || user.email}` : 'Account & Cloud Sync'}
        style={{
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: user ? '#5F7A9A' : '#0a0a0a',
          border: `1px solid ${isOpen ? '#5F7A9A' : user ? '#7a97b8' : '#262626'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'border-color 0.15s ease'
        }}
      >
        {user && user.photoURL && !imgFailed ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            onError={() => setImgFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : user ? (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffffff' }}>{initial}</span>
        ) : (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '260px',
            backgroundColor: '#0a0a0a',
            border: '1px solid #262626',
            borderRadius: '6px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.92)',
            padding: '0.9rem',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            fontFamily: 'Quicksand, sans-serif'
          }}
        >
          {user ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #1a1a1a', paddingBottom: '0.7rem' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor: '#5F7A9A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {user.photoURL && !imgFailed ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>{initial}</span>
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.displayName || 'User'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.email}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.70rem', color: '#9ca3af' }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isSyncing ? '#eab308' : '#10b981'
                  }}
                />
                <span>{isSyncing ? 'Syncing settings...' : 'Cloud sync active'}</span>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={isBusy}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  backgroundColor: '#141414',
                  border: '1px solid #262626',
                  borderRadius: '4px',
                  color: '#e5e7eb',
                  cursor: isBusy ? 'wait' : 'pointer'
                }}
              >
                {isBusy ? 'Signing out...' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>Sign in</div>
                <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: '3px', lineHeight: 1.4 }}>
                  Sign in with Google to save and sync your indicators, chart themes, and watchlists.
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isBusy || !isFirebaseConfigured}
                style={{
                  width: '100%',
                  padding: '7px 12px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  backgroundColor: isFirebaseConfigured ? '#ffffff' : '#171717',
                  color: isFirebaseConfigured ? '#111827' : '#737373',
                  border: '1px solid #262626',
                  borderRadius: '4px',
                  cursor: isBusy || !isFirebaseConfigured ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                  <path fill="#34A853" d="M12 24c3.3 0 6.08-1.09 8.105-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.225 1.18-3.24 0-5.99-2.19-6.97-5.13H1.02v3.14C3.055 21.23 7.205 24 12 24Z" />
                  <path fill="#FBBC05" d="M5.03 14.04c-.25-.74-.39-1.54-.39-2.36 0-.82.14-1.62.39-2.36V6.18H1.02C.37 7.47 0 8.93 0 10.48c0 1.55.37 3.01 1.02 4.3l4.01-3.14Z" />
                  <path fill="#EA4335" d="M12 4.75c1.8 0 3.41.62 4.68 1.83l3.51-3.51C18.07 1.19 15.3 0 12 0 7.205 0 3.055 2.77 1.02 6.82l4.01 3.14C6.01 7.02 8.76 4.75 12 4.75Z" />
                </svg>
                <span>{isBusy ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>

              {!isFirebaseConfigured && (
                <div style={{ fontSize: '0.65rem', color: '#9ca3af', backgroundColor: '#121212', border: '1px solid #1f1f1f', borderRadius: '4px', padding: '6px 8px', lineHeight: 1.4 }}>
                  Add <code style={{ color: '#e5e7eb' }}>VITE_FIREBASE_*</code> keys in <code style={{ color: '#e5e7eb' }}>client/.env</code> to enable Google Login.
                </div>
              )}

              {errorMsg && (
                <div style={{ fontSize: '0.67rem', color: '#ef4444' }}>{errorMsg}</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
