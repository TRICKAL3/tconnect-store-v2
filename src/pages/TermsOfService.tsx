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
              <p className="mt-3">
                Once an order has been submitted and processed, customers cannot change the selected product or order details.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">5. TConnect Points &amp; Spin Wheel</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Earn 2 points for every $10 spent on approved store orders paid with real money.</li>
                <li>1300 points = $10 USD value when redeemed at checkout.</li>
                <li>You must hold at least 1,300 points ($10 value) before points can be used at checkout.</li>
                <li>
                  You must have <strong className="text-white font-medium">more than $20</strong> in approved TConnect store purchases before redeeming points.
                  You cannot only win spin wheel points and save them until $10 without qualifying purchases.
                </li>
                <li>Only approved paid orders count toward the $20 requirement (not points-only checkouts).</li>
                <li>Spin prizes and promotional points are subject to the same redemption rules.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">6. TConnect Cards (Prepaid Virtual Cards)</h2>
              <p>
                TConnect Cards are <strong className="text-white font-medium">prepaid virtual cards</strong> issued for online purchases. Each card is loaded with a fixed value at the time of purchase.
              </p>
              <ul className="list-disc pl-5 mt-3 space-y-2">
                <li>
                  <strong className="text-white font-medium">No top-ups or reloads.</strong> You cannot add funds to an existing TConnect Card after it has been issued. When the balance reaches zero, the card cannot be used again.
                </li>
                <li>
                  <strong className="text-white font-medium">Purchase a new card.</strong> To continue spending, you must order a new TConnect Card from our store.
                </li>
                <li>
                  Card details (number, expiry, and security code) are provided for your use only. Keep them private and do not share your security code with anyone.
                </li>
                <li>
                  Balance, fees, and transaction history are updated periodically. Use the refresh option in My Cards if your activity is not yet reflected.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">7. Fraud Protection</h2>
              <p>
                TConnect reserves the right to cancel orders and issue refunds if suspicious or fraudulent activity is detected, including payment fraud, fake accounts, or suspicious transactions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">8. Location &amp; Data Collection</h2>
              <p>
                TConnect collects certain information such as your email address, account information, and location information to improve our services, security, customer support, and user experience. See our{' '}
                <Link to="/privacy" className="text-neon-blue hover:underline">Privacy Policy</Link> for details.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">9. Limitation of Liability</h2>
              <p>
                TConnect shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">10. Contact</h2>
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

