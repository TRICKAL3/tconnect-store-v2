import { Resend } from 'resend';

// Log environment variable status (only once on module load)
if (typeof process !== 'undefined' && process.env) {
  console.log('📧 [Email] Environment check:');
  console.log('📧 [Email] RESEND_API_KEY:', process.env.RESEND_API_KEY ? `Set (${process.env.RESEND_API_KEY.substring(0, 10)}...)` : 'NOT SET');
  console.log('📧 [Email] FROM_EMAIL:', process.env.FROM_EMAIL || 'Using default: noreply@tconnect.store');
  console.log('📧 [Email] FROM_NAME:', process.env.FROM_NAME || 'Using default: TConnect Store');
  console.log('📧 [Email] BASE_URL:', process.env.BASE_URL || 'Using default: https://tconnect-store-v2.vercel.app');
}

// Initialize Resend only if API key is provided
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@tconnect.store';
const FROM_NAME = process.env.FROM_NAME || 'TConnect Store';
const BASE_URL = process.env.BASE_URL || 'https://tconnect-store-v2.vercel.app';

interface OrderEmailData {
  orderId: string;
  orderNumber: string;
  userEmail: string;
  userName: string;
  totalUsd: number;
  totalMwk: number;
  items: Array<{
    name: string;
    quantity: number;
    priceUsd: number;
    type: string;
    giftCardCodes?: string;
  }>;
}

function formatOrderItems(items: OrderEmailData['items']): string {
  return items.map((item, index) => {
    let itemHtml = `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <strong>${item.name}</strong><br>
          <span style="color: #6b7280; font-size: 14px;">Quantity: ${item.quantity} × $${item.priceUsd.toFixed(2)}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
          $${(item.priceUsd * item.quantity).toFixed(2)}
        </td>
      </tr>
    `;
    
    // Add gift card codes if available
    if (item.giftCardCodes) {
      try {
        const codes = JSON.parse(item.giftCardCodes);
        if (Array.isArray(codes) && codes.length > 0) {
          itemHtml += `
            <tr>
              <td colspan="2" style="padding: 12px; padding-top: 0; border-bottom: 1px solid #e5e7eb;">
                <div style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin-top: 8px;">
                  <strong style="color: #059669;">Gift Card Codes:</strong><br>
                  ${codes.map((code: any) => {
                    if (code.redeemCode) {
                      return `<div style="margin-top: 8px;"><strong>Code:</strong> <code style="background: white; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${code.redeemCode}</code></div>`;
                    } else if (code.activationLink) {
                      return `<div style="margin-top: 8px;"><strong>Activation Link:</strong> <a href="${code.activationLink}" style="color: #3b82f6; text-decoration: underline;">Click here to activate</a></div>`;
                    }
                    return '';
                  }).join('')}
                </div>
              </td>
            </tr>
          `;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    return itemHtml;
  }).join('');
}

export async function sendOrderApprovedEmail(data: OrderEmailData): Promise<void> {
  console.log('📧 [Email] sendOrderApprovedEmail called for:', data.userEmail);
  
  if (!resend) {
    console.error('❌ [Email] Resend API key not configured. Check RESEND_API_KEY environment variable.');
    console.error('❌ [Email] Current RESEND_API_KEY value:', process.env.RESEND_API_KEY ? 'Set (but not working)' : 'NOT SET');
    return;
  }
  
  if (!data.userEmail || !data.userEmail.includes('@')) {
    console.error('❌ [Email] Invalid email address:', data.userEmail);
    return;
  }
  
  try {
    console.log('📧 [Email] Sending approved email via Resend...');
    const orderHistoryUrl = `${BASE_URL}/orders`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Approved - TConnect Store</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 0;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Order Approved!</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 32px;">
              <p style="font-size: 16px; margin: 0 0 24px 0;">Hello ${data.userName},</p>
              
              <p style="font-size: 16px; margin: 0 0 24px 0;">
                Great news! Your order <strong>#${data.orderNumber}</strong> has been approved and is now being processed.
              </p>
              
              <!-- Order Summary -->
              <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1f2937;">Order Summary</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  ${formatOrderItems(data.items)}
                  <tr>
                    <td style="padding: 12px; border-top: 2px solid #1f2937; font-weight: bold;">Total</td>
                    <td style="padding: 12px; border-top: 2px solid #1f2937; text-align: right; font-weight: bold; font-size: 18px;">
                      $${data.totalUsd.toFixed(2)}<br>
                      <span style="font-size: 14px; color: #6b7280; font-weight: normal;">(${data.totalMwk.toLocaleString()} MWK)</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="font-size: 16px; margin: 24px 0;">
                Your order is being prepared and will be delivered soon. You'll receive another email once your order is fulfilled with all the details.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${orderHistoryUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  View Order History
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin: 24px 0 0 0;">
                If you have any questions, please don't hesitate to contact our support team.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                © ${new Date().getFullYear()} TConnect Store. All rights reserved.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.userEmail,
      subject: `Order #${data.orderNumber} Approved - TConnect Store`,
      html,
    });
    
    console.log(`✅ [Email] Order approved email sent successfully!`);
    console.log(`✅ [Email] Resend response:`, result);
    console.log(`✅ [Email] To: ${data.userEmail}, Order: ${data.orderId}`);
  } catch (error: any) {
    console.error('❌ [Email] Failed to send order approved email');
    console.error('❌ [Email] Error message:', error?.message || 'Unknown error');
    console.error('❌ [Email] Error details:', JSON.stringify(error, null, 2));
    console.error('❌ [Email] Full error:', error);
    // Don't throw - email failures shouldn't break the order update
  }
}

export async function sendOrderRejectedEmail(data: OrderEmailData): Promise<void> {
  if (!resend) {
    console.warn('⚠️ Resend API key not configured. Skipping email send.');
    return;
  }
  
  try {
    const orderHistoryUrl = `${BASE_URL}/orders`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Rejected - TConnect Store</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 0;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Order Rejected</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 32px;">
              <p style="font-size: 16px; margin: 0 0 24px 0;">Hello ${data.userName},</p>
              
              <p style="font-size: 16px; margin: 0 0 24px 0;">
                We regret to inform you that your order <strong>#${data.orderNumber}</strong> has been rejected.
              </p>
              
              <!-- Order Summary -->
              <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1f2937;">Order Summary</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  ${formatOrderItems(data.items)}
                  <tr>
                    <td style="padding: 12px; border-top: 2px solid #1f2937; font-weight: bold;">Total</td>
                    <td style="padding: 12px; border-top: 2px solid #1f2937; text-align: right; font-weight: bold; font-size: 18px;">
                      $${data.totalUsd.toFixed(2)}<br>
                      <span style="font-size: 14px; color: #6b7280; font-weight: normal;">(${data.totalMwk.toLocaleString()} MWK)</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 16px; color: #991b1b;">
                  <strong>What's next?</strong><br>
                  If you have any questions about why your order was rejected, please contact our support team. We're here to help!
                </p>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${orderHistoryUrl}" style="display: inline-block; background: #1f2937; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  View Order History
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin: 24px 0 0 0;">
                If you need assistance, please contact our support team at <a href="mailto:support@tconnect.store" style="color: #3b82f6;">support@tconnect.store</a>
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                © ${new Date().getFullYear()} TConnect Store. All rights reserved.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.userEmail,
      subject: `Order #${data.orderNumber} Rejected - TConnect Store`,
      html,
    });
    
    console.log(`✅ Order rejected email sent to ${data.userEmail} for order ${data.orderId}`);
  } catch (error: any) {
    console.error('❌ Failed to send order rejected email:', error?.message || error);
    // Don't throw - email failures shouldn't break the order update
  }
}

export async function sendOrderFulfilledEmail(data: OrderEmailData): Promise<void> {
  if (!resend) {
    console.warn('⚠️ Resend API key not configured. Skipping email send.');
    return;
  }
  
  try {
    const orderHistoryUrl = `${BASE_URL}/orders`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Fulfilled - TConnect Store</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 0;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Order Delivered! 🎉</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 32px;">
              <p style="font-size: 16px; margin: 0 0 24px 0;">Hello ${data.userName},</p>
              
              <p style="font-size: 16px; margin: 0 0 24px 0;">
                Excellent news! Your order <strong>#${data.orderNumber}</strong> has been fulfilled and is ready for you to use.
              </p>
              
              <!-- Order Summary -->
              <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0;">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #1f2937;">Order Summary</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  ${formatOrderItems(data.items)}
                  <tr>
                    <td style="padding: 12px; border-top: 2px solid #1f2937; font-weight: bold;">Total</td>
                    <td style="padding: 12px; border-top: 2px solid #1f2937; text-align: right; font-weight: bold; font-size: 18px;">
                      $${data.totalUsd.toFixed(2)}<br>
                      <span style="font-size: 14px; color: #6b7280; font-weight: normal;">(${data.totalMwk.toLocaleString()} MWK)</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 16px; color: #065f46;">
                  <strong>Your order is complete!</strong><br>
                  All items have been processed and delivered. Check your order details below for gift card codes and activation links.
                </p>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${orderHistoryUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  View Order History
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin: 24px 0 0 0;">
                Thank you for shopping with TConnect Store! If you have any questions, please contact our support team.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                © ${new Date().getFullYear()} TConnect Store. All rights reserved.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.userEmail,
      subject: `Order #${data.orderNumber} Delivered - TConnect Store`,
      html,
    });
    
    console.log(`✅ Order fulfilled email sent to ${data.userEmail} for order ${data.orderId}`);
  } catch (error: any) {
    console.error('❌ Failed to send order fulfilled email:', error?.message || error);
    // Don't throw - email failures shouldn't break the order update
  }
}

