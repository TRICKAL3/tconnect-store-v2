import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../lib/firebaseClient';
import { 
  User, 
  onAuthStateChanged, 
  signOut as firebaseSignOut
} from 'firebase/auth';
import { getApiBase } from '../lib/getApiBase';

interface AuthUser {
  id: string;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let lastProcessedUid: string | null = null;
    let processing = false; // Prevent concurrent processing
    
    // Don't call getRedirectResult here - it's handled in App.tsx
    // getRedirectResult can only be called once per redirect
    
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
        const upsertUser = async (): Promise<boolean> => {
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
              return false;
            } else {
              const userData = await upsertRes.json();
              console.log('✅ User upserted successfully in backend:', email, userData);
              return true;
            }
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
            return false;
          }
        };
        
        // Try to upsert immediately
        const upsertSuccess = await upsertUser();
        
        if (upsertSuccess) {
          console.log('✅ User upsert completed successfully, fetching profile...');
        } else {
          console.warn('⚠️ User upsert may have failed, but continuing with Firebase data...');
        }
        
        // Fetch profile from backend
        try {
          const res = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:4000'}/users/profile?email=${encodeURIComponent(email)}`);
          if (res.ok) {
            const profile = await res.json();
            console.log('✅ User profile fetched from backend:', profile);
            setUser({
              id: firebaseUser.uid,
              email,
              name: profile.name || displayName,
              avatarUrl: profile.avatarUrl || photoURL
            });
          } else {
            console.log('⚠️ Profile not found in backend, using Firebase data');
            setUser({
              id: firebaseUser.uid,
              email,
              name: displayName,
              avatarUrl: photoURL
            });
          }
        } catch (error) {
          console.error('❌ Error fetching profile:', error);
          setUser({
            id: firebaseUser.uid,
            email,
            name: displayName,
            avatarUrl: photoURL
          });
        }
        setLoading(false);
        processing = false;
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


