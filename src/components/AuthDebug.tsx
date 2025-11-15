import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebaseClient';
import { useAuth } from '../context/AuthContext';

const AuthDebug: React.FC = () => {
  const [show, setShow] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const { user: contextUser, loading } = useAuth();
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setFirebaseUser(user ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      } : null);
    });
    return () => unsubscribe();
  }, []);

  const testUpsert = async () => {
    setTestResult('Testing...');
    try {
      const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:4000';
      const testEmail = `test-${Date.now()}@example.com`;
      const res = await fetch(`${API_BASE}/users/upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          name: 'Test User',
          avatarUrl: null
        })
      });
      const data = await res.json();
      setTestResult(res.ok ? `✅ SUCCESS: ${JSON.stringify(data)}` : `❌ FAILED: ${JSON.stringify(data)}`);
    } catch (error: any) {
      setTestResult(`❌ ERROR: ${error.message}`);
    }
  };

  const testFirebaseAuth = async () => {
    try {
      const { getRedirectResult, GoogleAuthProvider, signInWithRedirect } = await import('firebase/auth');
      const result = await getRedirectResult(auth);
      if (result) {
        setTestResult(`✅ Firebase Redirect Result: ${result.user.email}`);
      } else {
        setTestResult('⚠️ No redirect result - trying manual sign in...');
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ redirect_uri: window.location.origin });
        await signInWithRedirect(auth, provider);
      }
    } catch (error: any) {
      setTestResult(`❌ Firebase Error: ${error.message}`);
    }
  };

  const checkFirebaseInit = () => {
    try {
      const currentUser = auth.currentUser;
      const currentUrl = window.location.href;
      const expectedRedirectUri = `${window.location.origin}/__/auth/handler`;
      const hash = window.location.hash;
      const search = window.location.search;
      
      // Get the OAuth client ID from Firebase config
      // Firebase uses the messagingSenderId as part of the client ID pattern
      const messagingSenderId = auth.app.options.messagingSenderId;
      const projectId = auth.app.options.projectId;
      
      let result = `🔍 FIREBASE CONFIGURATION CHECK\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      result += `Firebase Config:\n`;
      result += `  Auth Domain: ${auth.app.options.authDomain}\n`;
      result += `  Project ID: ${projectId}\n`;
      result += `  Messaging Sender ID: ${messagingSenderId}\n`;
      result += `  Current User: ${currentUser ? currentUser.email : 'null'}\n\n`;
      result += `URL Info:\n`;
      result += `  Current URL: ${currentUrl}\n`;
      result += `  Expected Redirect URI: ${expectedRedirectUri}\n`;
      result += `  Hash: ${hash ? hash.substring(0, 50) + '...' : '(empty)'}\n`;
      result += `  Search: ${search || '(empty)'}\n\n`;
      result += `OAuth Status:\n`;
      result += `  Has OAuth params: ${hash.includes('access_token') || hash.includes('id_token') || search.includes('code=') ? 'YES' : 'NO'}\n\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      result += `🔴 CRITICAL: OAuth Client ID to Find\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      result += `In Google Cloud Console, look for OAuth client:\n`;
      result += `  Pattern: ${messagingSenderId}-xxxxx.apps.googleusercontent.com\n`;
      result += `  OR check Firebase Console:\n`;
      result += `  Authentication → Sign-in method → Google\n`;
      result += `  → Copy the "Web client ID" shown there\n\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      result += `✅ REQUIRED REDIRECT URIs\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      result += `Add these EXACT URIs (no trailing slashes):\n`;
      result += `  1. ${expectedRedirectUri}\n`;
      result += `  2. ${window.location.origin}\n\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      result += `📋 STEP-BY-STEP:\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      result += `1. Go to: https://console.cloud.google.com/apis/credentials\n`;
      result += `2. Select project: ${projectId}\n`;
      result += `3. Find OAuth 2.0 Client ID starting with: ${messagingSenderId}-\n`;
      result += `4. Click to edit\n`;
      result += `5. Add redirect URIs (see above)\n`;
      result += `6. Click SAVE\n`;
      result += `7. Wait 1-2 minutes\n`;
      result += `8. Clear browser cache\n`;
      result += `9. Try again\n`;
      
      setTestResult(result);
    } catch (error: any) {
      setTestResult(`❌ Firebase Check Error: ${error.message}`);
    }
  };

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg z-50"
      >
        🔍 Debug Auth
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black border-2 border-red-500 p-4 rounded-lg z-50 max-w-md text-white text-xs">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-red-400">🔍 Auth Debug Panel</h3>
        <button onClick={() => setShow(false)} className="text-white">✕</button>
      </div>
      
      <div className="space-y-2">
        <div>
          <strong>Firebase User:</strong>
          <pre className="bg-gray-900 p-2 rounded text-xs overflow-auto max-h-32">
            {firebaseUser ? JSON.stringify(firebaseUser, null, 2) : 'null'}
          </pre>
        </div>
        
        <div>
          <strong>Context User:</strong>
          <pre className="bg-gray-900 p-2 rounded text-xs overflow-auto max-h-32">
            {contextUser ? JSON.stringify(contextUser, null, 2) : 'null'}
          </pre>
        </div>
        
        <div>
          <strong>Loading:</strong> {loading ? 'true' : 'false'}
        </div>
        
        <div>
          <strong>API Base:</strong> {process.env.REACT_APP_API_BASE || 'http://localhost:4000'}
        </div>
        
        <div className="space-y-1">
          <button
            onClick={testUpsert}
            className="w-full bg-blue-500 text-white px-2 py-1 rounded text-xs"
          >
            Test Backend Connection
          </button>
          <button
            onClick={checkFirebaseInit}
            className="w-full bg-green-500 text-white px-2 py-1 rounded text-xs"
          >
            Check Firebase Config
          </button>
          <button
            onClick={() => {
              const redirectUri = `${window.location.origin}/__/auth/handler`;
              navigator.clipboard.writeText(redirectUri);
              setTestResult(`✅ Copied to clipboard:\n${redirectUri}\n\nPaste this in Google Cloud Console → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs`);
            }}
            className="w-full bg-yellow-500 text-white px-2 py-1 rounded text-xs"
          >
            📋 Copy Redirect URI
          </button>
          <button
            onClick={testFirebaseAuth}
            className="w-full bg-purple-500 text-white px-2 py-1 rounded text-xs"
          >
            Test Firebase Auth
          </button>
        </div>
        
        {testResult && (
          <div className="bg-gray-900 p-2 rounded text-xs whitespace-pre-wrap">
            {testResult}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthDebug;

