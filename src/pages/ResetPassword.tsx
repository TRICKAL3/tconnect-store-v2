import React, { useState, useEffect } from 'react';
import { auth } from '../lib/firebaseClient';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { CheckCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import logoImage from '../assets/tconnect_logo.png';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(true);
  const [searchParams] = useSearchParams();
  const actionCode = searchParams.get('oobCode');

  useEffect(() => {
    // Verify the action code if present
    if (actionCode) {
      verifyPasswordResetCode(auth, actionCode)
        .then(() => {
          setVerifying(false);
        })
        .catch((err: any) => {
          setError(err.message || 'Invalid or expired reset link');
          setVerifying(false);
        });
    } else {
      // No action code - user might be trying to update password while signed in
      if (auth.currentUser) {
        setVerifying(false);
      } else {
        setError('Please use the password reset link from your email.');
        setVerifying(false);
      }
    }
  }, [actionCode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (actionCode) {
      // Password reset via email link
      try {
        await confirmPasswordReset(auth, actionCode, password);
        setDone(true);
      } catch (err: any) {
        setError(err.message || 'Failed to reset password');
      }
    } else if (auth.currentUser) {
      // Update password for signed-in user
      try {
        const { updatePassword } = await import('firebase/auth');
        await updatePassword(auth.currentUser, password);
        setDone(true);
      } catch (err: any) {
        setError(err.message || 'Failed to update password');
      }
    } else {
      setError('Please use the password reset link from your email.');
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
      <div className="card-dark p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <img 
            src={logoImage} 
            alt="TConnect Logo" 
            className="mx-auto mb-4 w-64 h-auto object-contain"
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
          <div className="text-gray-400 text-sm">Set a new password</div>
        </div>
        {verifying ? (
          <div className="text-center py-4">
            <div className="text-gray-400">Verifying reset link...</div>
          </div>
        ) : done ? (
          <div className="text-center py-4">
            <div className="mb-4 flex justify-center">
              <div className="w-16 h-16 bg-green-400/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Password Updated!</h2>
            <p className="text-gray-300 mb-4">Your password has been successfully updated.</p>
            <Link to="/signin" className="inline-block btn-cyber text-white px-6 py-3 rounded-lg">
              Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">New Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-white" />
            </div>
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <button className="w-full py-3 rounded-lg font-bold btn-cyber text-white">Update Password</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;


