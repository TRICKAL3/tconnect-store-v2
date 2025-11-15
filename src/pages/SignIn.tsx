import React, { useState, useEffect } from 'react';
import { getApiBase } from '../lib/getApiBase';
import { auth } from '../lib/firebaseClient';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImage from '../assets/tconnect_logo.png';

const SignIn: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect if already signed in
  useEffect(() => {
    if (user) {
      console.log('User already signed in, redirecting from SignIn page');
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Also check Firebase auth state directly
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        console.log('Firebase user detected on SignIn page, redirecting');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 500);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      console.log('🟢 Attempting popup-based sign-in...');
      
      // Try popup first (no redirect URI config needed)
      try {
        const result = await signInWithPopup(auth, provider);
        console.log('✅ Popup sign-in successful:', result.user.email);
        
        // Upsert user to backend
        const email = result.user.email;
        const displayName = result.user.displayName || email?.split('@')[0] || 'User';
        const photoURL = result.user.photoURL || undefined;
        
        try {
          const API_BASE = getApiBase();
          await fetch(`${API_BASE}/users/upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name: displayName, avatarUrl: photoURL })
          });
        } catch (upsertError) {
          console.error('Failed to upsert user:', upsertError);
        }
        
        // Redirect to home
        navigate('/', { replace: true });
        setLoading(false);
      } catch (popupError: any) {
        // If popup is blocked, fall back to redirect
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
          console.log('⚠️ Popup blocked, falling back to redirect...');
          setError('Popup was blocked. Please allow popups and try again, or the page will redirect...');
          
          // Fallback to redirect after a short delay
          setTimeout(async () => {
            try {
              await signInWithRedirect(auth, provider);
            } catch (redirectError: any) {
              console.error('❌ Redirect also failed:', redirectError);
              setError('Sign-in failed. Please try again or check your browser settings.');
              setLoading(false);
            }
          }, 2000);
        } else {
          throw popupError;
        }
      }
    } catch (err: any) {
      console.error('❌ Sign-in error:', err);
      setError(err.message || 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
      <div className="card-dark p-6 sm:p-8 w-full max-w-sm sm:max-w-md md:max-w-lg">
        <div className="text-center mb-6">
          <img 
            src={logoImage} 
            alt="TConnect Logo" 
            className="mx-auto mb-4 w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl h-auto object-contain"
            onError={(e) => {
              // Fallback if logo doesn't load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              if (target.nextElementSibling) {
                (target.nextElementSibling as HTMLElement).classList.remove('hidden');
              }
            }}
          />
          <div className="hidden text-3xl font-mono text-neon-blue">tConnect</div>
          <div className="text-gray-400 text-sm">Welcome back</div>
        </div>
        {error && <div className="mb-4 text-red-400 text-sm">{error}</div>}
        
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 rounded-lg font-semibold bg-white text-gray-800 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>
        
        <div className="mt-4 text-center text-sm">
          <p className="text-gray-400">No account? <Link to="/signup" className="text-neon-blue">Sign up</Link></p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;


