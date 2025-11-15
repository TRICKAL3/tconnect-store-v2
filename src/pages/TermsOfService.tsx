import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/" className="inline-flex items-center text-gray-400 hover:text-neon-blue mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Home
        </Link>
        
        <div className="card-dark p-8 rounded-2xl">
          <div className="flex items-center space-x-3 mb-6">
            <FileText className="w-8 h-8 text-neon-blue" />
            <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
          </div>
          <p className="text-gray-400 mb-8">Effective Date: November 1, 2025</p>

          <div className="space-y-6 text-gray-300">
            <section>
              <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing and using TConnect Store, you agree to be bound by these Terms of Service and all applicable laws and regulations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">2. Use of Services</h2>
              <p>
                You agree to use our services only for lawful purposes and in accordance with these Terms. You must not use our services to violate any laws or infringe upon the rights of others.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">3. Account Registration</h2>
              <p>
                When you create an account, you are responsible for maintaining the confidentiality of your account information and password.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">4. Transactions</h2>
              <p>
                All transactions are subject to verification and approval. Prices and availability are subject to change without notice.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">5. Limitation of Liability</h2>
              <p>
                TConnect shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">6. Contact</h2>
              <p>
                For questions about these Terms, contact us at <a href="mailto:contact@tconnect.store" className="text-neon-blue hover:underline">contact@tconnect.store</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;

