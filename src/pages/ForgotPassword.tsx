import React, { useState } from 'react';
import { auth } from '../lib/firebaseClient';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Mail, CheckCircle } from 'lucide-react';
import logoImage from '../assets/tconnect_logo.png';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/reset-password`
      });
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
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
          <div className="text-gray-400 text-sm">Reset your password</div>
        </div>
        {sent ? (
          <div className="text-center py-4">
            <div className="mb-4 flex justify-center">
              <div className="w-16 h-16 bg-green-400/20 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Check Your Email</h2>
            <p className="text-gray-300 mb-4">
              We've sent a password reset link to <span className="text-neon-blue font-semibold">{email}</span>
            </p>
            <div className="bg-neon-blue/10 border border-neon-blue/30 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-neon-blue mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-white text-sm font-semibold mb-1">Password Reset Email Sent</p>
                  <p className="text-gray-300 text-xs">
                    Please click the reset link in your email to reset your password. 
                    The email is from <strong>TConnect</strong> - please check your spam folder if you don't see it.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-gray-400 text-sm">
              Didn't receive the email? Check your spam folder or{' '}
              <button
                onClick={() => setSent(false)}
                className="text-neon-blue hover:underline"
              >
                try again
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-white" />
            </div>
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <button className="w-full py-3 rounded-lg font-bold btn-cyber text-white">Send Reset Link</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;


