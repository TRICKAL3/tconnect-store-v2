import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';

const RefundPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/" className="inline-flex items-center text-gray-400 hover:text-neon-blue mb-6 transition-colors">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Home
        </Link>
        
        <div className="card-dark p-8 rounded-2xl">
          <div className="flex items-center space-x-3 mb-6">
            <RefreshCw className="w-8 h-8 text-neon-blue" />
            <h1 className="text-3xl font-bold text-white">Refund Policy</h1>
          </div>
          <p className="text-gray-400 mb-8">Effective Date: November 1, 2025</p>

          <div className="space-y-6 text-gray-300">
            <section>
              <h2 className="text-xl font-bold text-white mb-3">1. Refund Eligibility</h2>
              <p>
                Refunds may be issued for transactions that have not been processed or delivered. Once a product or service has been delivered, refunds are subject to review on a case-by-case basis.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">2. Refund Process</h2>
              <p>
                To request a refund, please contact our support team at <a href="mailto:contact@tconnect.store" className="text-neon-blue hover:underline">contact@tconnect.store</a> with your order details. Refund requests will be reviewed within 5-7 business days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">3. Refund Timeline</h2>
              <p>
                Approved refunds will be processed within 10-14 business days and returned to the original payment method used for the transaction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">4. Non-Refundable Items</h2>
              <p>
                Digital gift cards, cryptocurrency purchases, and wallet top-ups are generally non-refundable once processed, except in cases of technical errors or fraud.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">5. Contact</h2>
              <p>
                For refund inquiries, contact us at <a href="mailto:contact@tconnect.store" className="text-neon-blue hover:underline">contact@tconnect.store</a> or call <a href="tel:+265997407598" className="text-neon-blue hover:underline">+265 997 40 75 98</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;

