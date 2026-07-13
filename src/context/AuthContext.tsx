import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../lib/firebaseClient';
import { 
  User, 
  onAuthStateChanged, 
  signOut as firebaseSignOut
} from 'firebase/auth';
import { getApiBase } from '../lib/getApiBase';
import { cartAccountEmail } from '../lib/cartIdentity';
import { captureLoginLocation } from '../lib/captureLoginLocation';

interface AuthUser {
  id: string;
  /** Prisma User.id — used for server-side cart sync */
  dbUserId?: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_LOADING_TIMEOUT_MS = 4000; // Never block UI more than 4s for auth

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Stop blocking the UI after a short timeout so app never hangs on slow auth/API
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), AUTH_LOADING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  /** Backend Prisma id is required for cart sync; fill if upsert/profile was slow or missed. */
  useEffect(() => {
    const email = user?.email?.trim();
    if (!email || user?.dbUserId) return;

    let cancelled = false;
    const t = window.setTimeout(() => {
      (async () => {
        try {
          const res = await fetch(
            `${getApiBase()}/users/profile?email=${encodeURIComponent(email)}`
          );
          if (!res.ok || cancelled) return;
          const data = await res.json();
          const id = data && typeof data.id === 'string' ? data.id : null;
          if (!id || cancelled) return;
          setUser((prev) => {
            if (!prev || cartAccountEmail(prev.email) !== cartAccountEmail(email)) return prev;
            return { ...prev, dbUserId: id };
          });
        } catch {
          /* ignore */
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [user?.email, user?.dbUserId]);

  useEffect(() => {
    let mounted = true;
    let lastProcessedUid: string | null = null;
    let processing = false; // Prevent concurrent processing
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (processing) {
        console.log('⏳ Already processing user, skipping...');
        return;
      }
      if (!mounted) return;
      
      // Prevent duplicate processing of the same user
      if (firebaseUser && firebaseUser.uid === lastProcessedUid) {
        console.log('⏭️ Skipping duplicate auth state change for:', firebaseUser.uid);
        return;
      }
      
      if (firebaseUser?.email) {
        // Prevent duplicate processing
        if (lastProcessedUid === firebaseUser.uid) {
          console.log('⏭️ Skipping duplicate processing for:', firebaseUser.uid);
          return;
        }
        
        processing = true;
        lastProcessedUid = firebaseUser.uid;
        setLoading(true);
        const email = firebaseUser.email;
        const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
        const photoURL = firebaseUser.photoURL || undefined;
        
        console.log('🔄 [AuthContext] Firebase auth state changed - processing user:', {
          uid: firebaseUser.uid,
          email,
          displayName,
          photoURL: photoURL ? 'present' : 'none'
        });
        
        // Upsert user in backend database - with retry logic
        const API_BASE = getApiBase();
        console.log('📤 [AuthContext] Attempting to upsert user to backend:', { email, name: displayName, apiBase: API_BASE });
        
        let retryCount = 0;
        const maxRetries = 3;
        const upsertUser = async (): Promise<{ ok: boolean; dbUserId?: string }> => {
          try {
            const payload = {
              email,
              name: displayName,
              avatarUrl: photoURL
            };
            console.log('📨 Sending upsert request:', payload);

            const upsertRes = await fetch(`${API_BASE}/users/upsert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            console.log('📥 Upsert response status:', upsertRes.status, upsertRes.statusText);

            if (!upsertRes.ok) {
              const errorData = await upsertRes.text();
              console.error('❌ Failed to upsert user:', {
                status: upsertRes.status,
                statusText: upsertRes.statusText,
                error: errorData,
                retryCount
              });
              if (retryCount < maxRetries) {
                retryCount++;
                console.log(`🔄 Retrying upsert (${retryCount}/${maxRetries}) in ${1000 * retryCount}ms...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                return await upsertUser();
              }
              console.error('❌ Max retries reached. User upsert failed.');
              return { ok: false };
            }
            const userData = await upsertRes.json();
            console.log('✅ User upserted successfully in backend:', email, userData);
            const dbUserId =
              userData && typeof userData.id === 'string' ? userData.id : undefined;
            return { ok: true, dbUserId };
          } catch (error: any) {
            console.error('❌ Error upserting user:', {
              error: error.message,
              stack: error.stack,
              retryCount
            });
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`🔄 Retrying upsert (${retryCount}/${maxRetries}) in ${1000 * retryCount}ms...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              return await upsertUser();
            }
            console.error('❌ Max retries reached. User upsert failed.');
            return { ok: false };
          }
        };
        
        // Don't block: run upsert + profile fetch in background, show UI with Firebase user quickly
        setUser({
          id: firebaseUser.uid,
          email,
          name: displayName,
          avatarUrl: photoURL
        });
        setLoading(false);
        processing = false;

        upsertUser().then(({ ok, dbUserId: upsertDbId }) => {
          if (!mounted) return;
          if (upsertDbId) {
            setUser((prev) =>
              prev && cartAccountEmail(prev.email) === cartAccountEmail(email)
                ? { ...prev, dbUserId: upsertDbId }
                : prev
            );
          }
          if (ok) {
            captureLoginLocation(email).catch(() => {});
            const base = getApiBase();
            const ac = new AbortController();
            const timeoutId = setTimeout(() => ac.abort(), 5000);
            fetch(`${base}/users/profile?email=${encodeURIComponent(email)}`, { signal: ac.signal })
              .then((res) => (res.ok ? res.json() : null))
              .then((profile) => {
                clearTimeout(timeoutId);
                if (!mounted) return;
                if (profile) {
                  const profileId =
                    typeof profile.id === 'string' ? profile.id : undefined;
                  setUser({
                    id: firebaseUser.uid,
                    email,
                    dbUserId: profileId || upsertDbId,
                    name: profile.name || displayName,
                    avatarUrl: profile.avatarUrl || photoURL,
                  });
                }
              })
              .catch(() => clearTimeout(timeoutId));
          }
        });
      } else {
        lastProcessedUid = null;
        processing = false;
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Refresh location for returning sessions (Firebase may skip duplicate upsert).
  useEffect(() => {
    const email = user?.email?.trim();
    if (!email) return;
    const key = 'tconnect-loc-last';
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < 6 * 60 * 60 * 1000) return;
    captureLoginLocation(email)
      .catch(() => {})
      .finally(() => localStorage.setItem(key, String(Date.now())));
  }, [user?.email]);

  const value = useMemo(() => ({
    user,
    loading,
    signOut: async () => {
      await firebaseSignOut(auth);
    }
  }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};


