import nodemailer from 'nodemailer';

// Log environment variable status (only once on module load)
if (typeof process !== 'undefined' && process.env) {
  console.log('📧 [Email] Environment check:');
  console.log('📧 [Email] SMTP_HOST:', process.env.SMTP_HOST || 'NOT SET');
  console.log('📧 [Email] SMTP_USER:', process.env.SMTP_USER || 'NOT SET');
  console.log('📧 [Email] SMTP_PASS:', process.env.SMTP_PASS ? 'Set (hidden)' : 'NOT SET');
  console.log('📧 [Email] FROM_EMAIL:', process.env.FROM_EMAIL || 'Using default: noreply@tconnect.store');
  console.log('📧 [Email] FROM_NAME:', process.env.FROM_NAME || 'Using default: TConnect Store');
  console.log('📧 [Email] BASE_URL:', process.env.BASE_URL || 'Using default: https://tconnect-store-v2.vercel.app');
}

// Initialize Nodemailer transporter
let transporter: nodemailer.Transporter | null = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  console.log('✅ [Email] Nodemailer transporter initialized');
} else {
  console.warn('⚠️ [Email] SMTP not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
}

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

interface AdminOrderAlertData {
  orderId: string;
  totalUsd: number;
  totalMwk?: number;
  itemsCount?: number;
  paymentMethod?: string;
}

interface AdminChatAlertData {
  chatId: string;
  senderName?: string;
  preview?: string;
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
  
  if (!transporter) {
    console.error('❌ [Email] SMTP not configured. Check SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
    return;
  }
  
  if (!data.userEmail || !data.userEmail.includes('@')) {
    console.error('❌ [Email] Invalid email address:', data.userEmail);
    return;
  }
  
  try {
    console.log('📧 [Email] Sending approved email via SMTP...');
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
    
    const result = await transporter!.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.userEmail,
      subject: `Order #${data.orderNumber} Approved - TConnect Store`,
      html,
    });
    
    console.log(`✅ [Email] Order approved email sent successfully!`);
    console.log(`✅ [Email] Message ID:`, result.messageId);
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
  if (!transporter) {
    console.warn('⚠️ SMTP not configured. Skipping email send.');
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
    
    const result = await transporter.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.userEmail,
      subject: `Order #${data.orderNumber} Rejected - TConnect Store`,
      html,
    });
    
    console.log(`✅ [Email] Order rejected email sent to ${data.userEmail} for order ${data.orderId}`);
    console.log(`✅ [Email] Message ID:`, result.messageId);
  } catch (error: any) {
    console.error('❌ Failed to send order rejected email:', error?.message || error);
    // Don't throw - email failures shouldn't break the order update
  }
}

export async function sendOrderFulfilledEmail(data: OrderEmailData): Promise<void> {
  if (!transporter) {
    console.warn('⚠️ SMTP not configured. Skipping email send.');
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
    
    const result = await transporter.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.userEmail,
      subject: `Order #${data.orderNumber} Delivered - TConnect Store`,
      html,
    });
    
    console.log(`✅ [Email] Order fulfilled email sent to ${data.userEmail} for order ${data.orderId}`);
    console.log(`✅ [Email] Message ID:`, result.messageId);
  } catch (error: any) {
    console.error('❌ Failed to send order fulfilled email:', error?.message || error);
    // Don't throw - email failures shouldn't break the order update
  }
}

export async function sendAdminOrderAlertEmail(data: AdminOrderAlertData): Promise<void> {
  if (!transporter) return;

  const recipients = String(
    process.env.ADMIN_ALERT_EMAILS || process.env.ADMIN_ALERT_EMAIL || ''
  )
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (recipients.length === 0) return;

  const orderNumber = data.orderId.slice(0, 8).toUpperCase();
  const adminUrl = `${BASE_URL}/admin?tab=orders&orderId=${encodeURIComponent(data.orderId)}`;
  const method = data.paymentMethod || 'unknown';
  const itemsText =
    typeof data.itemsCount === 'number'
      ? `${data.itemsCount} item${data.itemsCount === 1 ? '' : 's'}`
      : 'items unknown';

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin-bottom: 8px;">New Order Alert</h2>
      <p style="margin-top: 0;">Order <strong>#${orderNumber}</strong> was placed.</p>
      <ul>
        <li><strong>Total USD:</strong> $${Number(data.totalUsd || 0).toFixed(2)}</li>
        <li><strong>Total MWK:</strong> ${Number(data.totalMwk || 0).toLocaleString()}</li>
        <li><strong>Items:</strong> ${itemsText}</li>
        <li><strong>Payment method:</strong> ${method}</li>
      </ul>
      <p><a href="${adminUrl}">Open this order in Admin Dashboard</a></p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: recipients.join(','),
      subject: `New order #${orderNumber} — $${Number(data.totalUsd || 0).toFixed(2)}`,
      html,
    });
  } catch (error: any) {
    console.error('❌ [Email] Failed to send admin order alert:', error?.message || error);
  }
}

export async function sendAdminChatAlertEmail(data: AdminChatAlertData): Promise<void> {
  if (!transporter) return;

  const recipients = String(
    process.env.ADMIN_ALERT_EMAILS || process.env.ADMIN_ALERT_EMAIL || ''
  )
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (recipients.length === 0) return;

  const chatShort = data.chatId.slice(0, 8).toUpperCase();
  const adminUrl = `${BASE_URL}/admin?tab=chats&chatId=${encodeURIComponent(data.chatId)}`;
  const who = data.senderName?.trim() || 'Customer';
  const snippet = (data.preview || '').trim().slice(0, 120);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin-bottom: 8px;">New Live Chat Message</h2>
      <p style="margin-top: 0;"><strong>${who}</strong> sent a new message in chat <strong>#${chatShort}</strong>.</p>
      ${snippet ? `<p style="background:#f3f4f6;padding:10px;border-radius:6px;"><strong>Preview:</strong> ${snippet}</p>` : ''}
      <p><a href="${adminUrl}">Open live chat in Admin Dashboard</a></p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: recipients.join(','),
      subject: `Live chat: new message from ${who}`,
      html,
    });
  } catch (error: any) {
    console.error('❌ [Email] Failed to send admin chat alert:', error?.message || error);
  }
}

export interface UserNotificationEmailData {
  userEmail: string;
  userName?: string | null;
  title: string;
  message: string;
  link?: string | null;
  type?: string;
}

export async function sendUserNotificationEmail(data: UserNotificationEmailData): Promise<void> {
  if (!transporter) return;
  if (process.env.USER_EMAIL_NOTIFICATIONS === 'false') return;

  const href = data.link
    ? data.link.startsWith('http')
      ? data.link
      : `${BASE_URL}${data.link.startsWith('/') ? '' : '/'}${data.link}`
    : BASE_URL;

  const greeting = data.userName?.trim() ? `Hi ${data.userName.trim()},` : 'Hi,';
  const typeLabel = data.type ? data.type.replace(/_/g, ' ') : 'update';

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; max-width: 560px;">
      <p style="margin: 0 0 12px;">${greeting}</p>
      <h2 style="margin: 0 0 8px; font-size: 20px;">${data.title}</h2>
      <p style="margin: 0 0 16px; line-height: 1.5;">${data.message}</p>
      <p style="margin: 0 0 20px;">
        <a href="${href}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">Open TConnect</a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #6b7280;">Notification type: ${typeLabel}</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.userEmail,
      subject: `${data.title} — TConnect`,
      html,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ [Email] Failed to send user notification email:', msg);
  }
}

