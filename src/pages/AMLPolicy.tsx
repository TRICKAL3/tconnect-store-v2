import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

const AMLPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/" className="inline-flex items-center text-gray-400 hover:text-neon-blue mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Home
        </Link>
        
        <div className="card-dark p-8 rounded-2xl">
          <div className="flex items-center space-x-3 mb-6">
            <Shield className="w-8 h-8 text-neon-blue" />
            <h1 className="text-3xl font-bold text-white">Anti-Money Laundering Policy</h1>
          </div>
          <p className="text-gray-400 mb-8">Effective Date: November 1, 2025</p>

          <div className="space-y-6 text-gray-300">
            <section>
              <h2 className="text-xl font-bold text-white mb-3">1. Policy Statement</h2>
              <p>
                TConnect is committed to preventing money laundering and terrorist financing activities. We comply with all applicable anti-money laundering (AML) laws and regulations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">2. Customer Due Diligence</h2>
              <p>
                We are required to verify the identity of our customers and may request additional documentation or information to comply with AML regulations. This includes verifying identification documents and understanding the nature of transactions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">3. Transaction Monitoring</h2>
              <p>
                All transactions are monitored for suspicious activity. We reserve the right to suspend or terminate accounts that exhibit suspicious behavior or fail to provide required documentation.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">4. Reporting Requirements</h2>
              <p>
                TConnect is obligated to report suspicious transactions to the relevant authorities as required by law. We maintain strict confidentiality regarding such reports.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">5. Compliance</h2>
              <p>
                Customers are required to comply with all AML regulations and provide accurate information. Failure to comply may result in account suspension or termination.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">6. Contact</h2>
              <p>
                For questions about our AML Policy, contact us at <a href="mailto:contact@tconnect.store" className="text-neon-blue hover:underline">contact@tconnect.store</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AMLPolicy;

