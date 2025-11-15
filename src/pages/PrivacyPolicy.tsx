import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
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
            <h1 className="text-3xl font-bold text-white">TConnect Privacy Policy</h1>
          </div>
          <p className="text-gray-400 mb-8">Effective Date: November 1, 2025</p>

          <div className="space-y-6 text-gray-300">
            <p>
              At TConnect, your privacy is our top priority. This Privacy Policy explains how we collect, use, and protect your information when you use our platform and related services.
            </p>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
              <p className="mb-2">We may collect the following types of information:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-white">Personal Information:</strong> Name, email address, phone number, and payment details when you register or make a purchase.</li>
                <li><strong className="text-white">Transaction Data:</strong> Details of your purchases, wallet activity, and payment history.</li>
                <li><strong className="text-white">Technical Data:</strong> IP address, browser type, device information, and usage analytics.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">2. How We Use Your Information</h2>
              <p className="mb-2">Your information is used to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Process transactions and deliver products or services.</li>
                <li>Improve and personalize your experience.</li>
                <li>Communicate updates, offers, and customer support messages.</li>
                <li>Ensure security and prevent fraud.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">3. Data Protection</h2>
              <p>
                We use secure encryption and follow strict protocols to protect your personal and financial information. TConnect will never share or sell your data to third parties without your consent, except when required by law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">4. Cookies</h2>
              <p>
                Our website uses cookies to improve user experience and analyze traffic. You can manage or disable cookies in your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">5. Third-Party Services</h2>
              <p>
                TConnect may integrate with third-party services (e.g., payment gateways or crypto APIs). Each third party operates under its own privacy policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">6. Your Rights</h2>
              <p>
                You have the right to access, update, or delete your personal data. For assistance, contact us at <a href="mailto:support@tconnect.store" className="text-neon-blue hover:underline">support@tconnect.store</a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

