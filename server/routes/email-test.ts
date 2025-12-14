import { Router } from 'express';
import { basicAdminAuth } from '../lib/adminAuth';
import { sendOrderApprovedEmail } from '../lib/email';

const router = Router();

// Test endpoint to verify email setup (admin only)
router.post('/test', basicAdminAuth, async (req: any, res) => {
  try {
    const { testEmail } = req.body;
    
    if (!testEmail || !testEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid test email is required' });
    }

    console.log('📧 [Email Test] Testing email to:', testEmail);
    
    const testData = {
      orderId: 'test-order-123',
      orderNumber: 'TEST1234',
      userEmail: testEmail,
      userName: 'Test User',
      totalUsd: 50.00,
      totalMwk: 50000,
      items: [
        {
          name: 'Test Gift Card',
          quantity: 1,
          priceUsd: 50.00,
          type: 'giftcard'
        }
      ]
    };

    await sendOrderApprovedEmail(testData);
    
    res.json({ 
      success: true, 
      message: 'Test email sent successfully! Check your inbox and spam folder.',
      sentTo: testEmail
    });
  } catch (error: any) {
    console.error('❌ [Email Test] Error:', error);
    res.status(500).json({ 
      error: 'Failed to send test email',
      details: error?.message || 'Unknown error',
      hint: 'Check Vercel logs for detailed error information'
    });
  }
});

// Get email configuration status (admin only)
router.get('/status', basicAdminAuth, async (req: any, res) => {
  const status = {
    smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    smtpHost: process.env.SMTP_HOST || 'NOT SET',
    smtpUser: process.env.SMTP_USER || 'NOT SET',
    smtpPort: process.env.SMTP_PORT || '587',
    smtpSecure: process.env.SMTP_SECURE || 'false',
    fromEmail: process.env.FROM_EMAIL || 'noreply@tconnect.store',
    fromName: process.env.FROM_NAME || 'TConnect Store',
    baseUrl: process.env.BASE_URL || 'https://tconnect-store-v2.vercel.app'
  };
  
  res.json(status);
});

export default router;

