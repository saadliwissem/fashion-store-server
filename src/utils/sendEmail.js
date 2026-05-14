const nodemailer = require("nodemailer");

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email configuration error:", error);
  } else {
    console.log("✅ Email server is ready to send messages");
  }
});
// Helper functions for the orderStatusUpdate template

const getStatusIcon = (status) => {
  switch (status) {
    case "pending":
      return "⏳";
    case "processing":
      return "⚙️";
    case "shipped":
      return "🚚";
    case "delivered":
      return "✅";
    case "cancelled":
      return "❌";
    default:
      return "📦";
  }
};

const getStatusText = (status) => {
  switch (status) {
    case "pending":
      return "Order Pending";
    case "processing":
      return "Processing Order";
    case "shipped":
      return "Order Shipped";
    case "delivered":
      return "Order Delivered";
    case "cancelled":
      return "Order Cancelled";
    default:
      return "Status Updated";
  }
};

const getStatusMessage = (status) => {
  switch (status) {
    case "pending":
      return "Your order has been received and is awaiting confirmation.";
    case "processing":
      return "Your order is being prepared for shipment.";
    case "shipped":
      return "Your order is on its way! Track your package below.";
    case "delivered":
      return "Your order has been delivered. Enjoy your PUZZLE items!";
    case "cancelled":
      return "Your order has been cancelled. Contact support for details.";
    default:
      return "Your order status has been updated.";
  }
};

const getPaymentMethodText = (method) => {
  switch (method) {
    case "cod":
      return "Cash on Delivery";
    case "card":
      return "Credit/Debit Card";
    case "edinar":
      return "E-Dinar";
    default:
      return method || "Not specified";
  }
};

const getPaymentStatusText = (status) => {
  switch (status) {
    case "paid":
      return "✅ Paid";
    case "pending":
      return "⏳ Pending";
    case "failed":
      return "❌ Failed";
    case "refunded":
      return "↩️ Refunded";
    default:
      return status || "Pending";
  }
};

const renderTimeline = (order) => {
  const steps = [
    { key: "pending", label: "Order Placed", date: order.createdAt },
    { key: "processing", label: "Processing", date: order.processingAt },
    { key: "shipped", label: "Shipped", date: order.shippedAt },
    { key: "delivered", label: "Delivered", date: order.deliveredAt },
  ];

  const currentStatusIndex = steps.findIndex(
    (step) => step.key === order.status
  );

  return steps
    .map((step, index) => {
      const isCompleted = index <= currentStatusIndex && step.date;
      const isCurrent = step.key === order.status;
      const isFuture = index > currentStatusIndex;

      return `
      <div class="timeline-step ${isCompleted ? "completed" : ""} ${
        isCurrent ? "current" : ""
      }">
        <div class="timeline-icon">
          ${
            isCompleted
              ? "✓"
              : step.key === "pending"
              ? "📝"
              : step.key === "processing"
              ? "⚙️"
              : step.key === "shipped"
              ? "🚚"
              : "📍"
          }
        </div>
        <div class="timeline-content">
          <div class="timeline-title">${step.label}</div>
          <div class="timeline-date">
            ${
              step.date
                ? new Date(step.date).toLocaleDateString()
                : isFuture
                ? "Pending"
                : "Not yet"
            }
          </div>
        </div>
        ${index < steps.length - 1 ? '<div class="timeline-line"></div>' : ""}
      </div>
    `;
    })
    .join("");
};

const getNextSteps = (status) => {
  switch (status) {
    case "pending":
      return `
        <li>You will receive a confirmation email once your order is confirmed.</li>
        <li>Track your order status in your account dashboard.</li>
        <li>Contact support if you have any questions.</li>
      `;
    case "processing":
      return `
        <li>Your order is being prepared for shipment.</li>
        <li>You will receive tracking information once shipped.</li>
        <li>Estimated shipping time: 3-7 business days.</li>
      `;
    case "shipped":
      return `
        <li>Track your package using the tracking number provided.</li>
        <li>Estimated delivery: ${
          order.estimatedDelivery
            ? new Date(order.estimatedDelivery).toLocaleDateString()
            : "Soon"
        }</li>
        <li>Make sure someone is available to receive the package.</li>
      `;
    case "delivered":
      return `
        <li>Enjoy your PUZZLE items!</li>
        <li>Leave a review for your purchase.</li>
        <li>Share your unboxing experience on social media.</li>
      `;
    default:
      return `
        <li>Check your order status in your account dashboard.</li>
        <li>Contact support if you have any questions.</li>
      `;
  }
};

// Send email function
const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: `"PUZZLE Tunisia" <${process.env.EMAIL_FROM}>`,
      to: options.email,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};

// Email templates
const emailTemplates = {
  welcome: (name, verificationCode) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to PUZZLE</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 40px 20px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .header::before {
          content: "🧩";
          position: absolute;
          font-size: 120px;
          opacity: 0.1;
          right: -20px;
          top: -20px;
          transform: rotate(15deg);
        }
        .logo {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .title {
          color: white;
          font-size: 32px;
          font-weight: 700;
          margin: 0;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }
        .subtitle {
          color: rgba(255,255,255,0.9);
          font-size: 16px;
          margin-top: 8px;
        }
        .content {
          padding: 40px;
        }
        .verification-code {
          background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          margin: 24px 0;
          border: 2px dashed #8b5cf6;
        }
        .code {
          font-size: 48px;
          font-weight: 800;
          letter-spacing: 8px;
          color: #7c3aed;
          font-family: 'Courier New', monospace;
          background: white;
          display: inline-block;
          padding: 12px 24px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 12px;
          font-weight: 600;
          margin: 16px 0;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(102,126,234,0.3);
        }
        .feature {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0;
          padding: 12px;
          background: #f9fafb;
          border-radius: 12px;
        }
        .feature-icon {
          font-size: 24px;
        }
        .footer {
          background: #f9fafb;
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: #6b7280;
          border-top: 1px solid #e5e7eb;
        }
        .social-links {
          margin-top: 16px;
        }
        .social-links a {
          color: #8b5cf6;
          text-decoration: none;
          margin: 0 8px;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .animate-pulse {
          animation: pulse 2s infinite;
        }
      </style>
    </head>
    <body style="margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
      <div style="max-width: 600px; margin: 0 auto;">
        <div class="container">
          <div class="header">
            <div class="logo">🧩</div>
            <h1 class="title">Welcome to PUZZLE</h1>
            <p class="subtitle">Your journey into mystery begins here</p>
          </div>
          
          <div class="content">
            <h2 style="color: #1f2937; margin-top: 0;">Hello ${name}! 👋</h2>
            <p style="color: #4b5563;">Thank you for joining <strong>PUZZLE</strong> - where fashion meets mystery. Your account has been created, but before you can start your adventure, you need to verify your email address.</p>
            
            <div class="verification-code">
              <p style="color: #4c1d95; margin-bottom: 12px; font-weight: 600;">🔐 Your Verification Code</p>
              <div class="code animate-pulse">${verificationCode}</div>
              <p style="color: #6b7280; font-size: 14px; margin-top: 12px;">This code expires in 24 hours</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/verify-email?code=${verificationCode}" class="button">
                ✨ Verify My Email ✨
              </a>
            </div>
            
            <p style="color: #4b5563; margin-top: 20px;">Or copy and paste this code in the verification page:</p>
            <p style="background: #f3f4f6; padding: 8px; border-radius: 8px; font-family: monospace; text-align: center; font-size: 18px; letter-spacing: 2px;">${verificationCode}</p>
            
            <h3 style="color: #1f2937; margin-top: 32px;">🎮 What awaits you as a PUZZLE member?</h3>
            
            <div class="feature">
              <span class="feature-icon">🧩</span>
              <div>
                <strong>Exclusive Mysteries</strong>
                <p style="margin: 4px 0 0; font-size: 14px;">Access unique puzzles and enigmas</p>
              </div>
            </div>
            
            <div class="feature">
              <span class="feature-icon">💎</span>
              <div>
                <strong>Rare Fragments</strong>
                <p style="margin: 4px 0 0; font-size: 14px;">Collect limited edition pieces</p>
              </div>
            </div>
            
            <div class="feature">
              <span class="feature-icon">🏆</span>
              <div>
                <strong>Solve & Win</strong>
                <p style="margin: 4px 0 0; font-size: 14px;">Collaborate with other keepers and win amazing prizes</p>
              </div>
            </div>
            
            <div class="feature">
              <span class="feature-icon">🤝</span>
              <div>
                <strong>Keeper Community</strong>
                <p style="margin: 4px 0 0; font-size: 14px;">Join fellow puzzle solvers worldwide</p>
              </div>
            </div>
            
            <p style="color: #4b5563; margin-top: 24px;">If you didn't create this account, please ignore this email.</p>
            
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 8px; margin-top: 20px;">
              <p style="color: #991b1b; font-size: 13px; margin: 0;">⚠️ The verification code will expire in 24 hours. Make sure to verify your email before then to start your PUZZLE journey!</p>
            </div>
          </div>
          
          <div class="footer">
            <p>© 2024 PUZZLE | Where Fashion Meets Mystery</p>
            <div class="social-links">
              <a href="#">🐦 Twitter</a> •
              <a href="#">📘 Facebook</a> •
              <a href="#">📸 Instagram</a> •
              <a href="#">💬 Discord</a>
            </div>
            <p style="margin-top: 16px;">
              <small>Questions? Contact us at <a href="mailto:support@puzzle.com" style="color: #8b5cf6;">support@puzzle.com</a></small>
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
  // Email verification code template (for resend)
  verificationCode: (name, verificationCode) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PUZZLE - Your Verification Code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .code { font-size: 40px; font-weight: bold; text-align: center; letter-spacing: 8px; color: #7c3aed; background: #f5f3ff; padding: 20px; border-radius: 12px; margin: 20px 0; }
    .button { display: inline-block; background: #7c3aed; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center; font-size: 48px;">🧩</div>
    <h2 style="text-align: center; color: #1f2937;">Your PUZZLE Verification Code</h2>
    <p>Hello ${name},</p>
    <p>Here's your verification code to complete your puzzle journey:</p>
    <div class="code">${verificationCode}</div>
    <p style="text-align: center;">This code expires in 24 hours.</p>
    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL}/verify-email?code=${verificationCode}" class="button">Verify My Email</a>
    </div>
    <hr style="margin: 24px 0;">
    <p style="color: #6b7280; font-size: 12px; text-align: center;">If you didn't request this, please ignore this email.</p>
  </div>
</body>
</html>
`,

  // Email verified confirmation
  emailVerified: (name) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Email Verified - PUZZLE</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
    .success { font-size: 64px; margin-bottom: 16px; }
    .button { display: inline-block; background: #7c3aed; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">🎉</div>
    <h2 style="color: #1f2937;">Email Verified!</h2>
    <p>Congratulations ${name}! Your email has been successfully verified.</p>
    <p>You can now:</p>
    <ul style="text-align: left;">
      <li>✨ Access all PUZZLE mysteries</li>
      <li>✨ Purchase fragments and start your collection</li>
      <li>✨ Join the keeper community</li>
      <li>✨ Participate in exclusive puzzles</li>
    </ul>
    <a href="${process.env.FRONTEND_URL}/mysteries" class="button">Start Your Journey 🧩</a>
  </div>
</body>
</html>
`,
  orderConfirmation: (order) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #8B5CF6;">Thank you for your order!</h1>
      <p>Hello ${order.shippingAddress.firstName},</p>
      <p>Your order <strong>${
        order.orderNumber
      }</strong> has been received and is being processed.</p>
      <h3>Order Summary:</h3>
      <p>Total: <strong>${order.total.toFixed(3)} DT</strong></p>
      <p>Payment Method: ${order.paymentMethod}</p>
      <p>Shipping Address: ${order.shippingAddress.address}, ${
    order.shippingAddress.city
  }, ${order.shippingAddress.governorate}</p>
      <p>You can track your order by logging into your account.</p>
      <p>Best regards,<br>The FashionStore Team</p>
    </div>
  `,

  passwordReset: (name, resetUrl) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #8B5CF6;">Password Reset Request</h1>
      <p>Hello ${name},</p>
      <p>You requested a password reset for your FashionStore account.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}" style="background-color: #8B5CF6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Reset Password</a></p>
      <p>This link will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Best regards,<br>The FashionStore Team</p>
    </div>
  `,
  // utils/emailTemplates.js - Add this template

  orderStatusUpdate: (order) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PUZZLE - Order Status Update</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 32px 24px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: "🧩";
      position: absolute;
      font-size: 120px;
      opacity: 0.1;
      right: -20px;
      top: -20px;
      transform: rotate(15deg);
    }
    .logo {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .title {
      color: white;
      font-size: 28px;
      font-weight: 700;
      margin: 0;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
    }
    .order-number {
      color: rgba(255,255,255,0.9);
      font-size: 14px;
      margin-top: 8px;
    }
    .content {
      padding: 32px;
    }
    .status-card {
      background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
      border-radius: 16px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
      border: 1px solid #e9d5ff;
    }
    .status-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }
    .status-text {
      font-size: 24px;
      font-weight: 700;
      color: #7c3aed;
      margin-bottom: 8px;
    }
    .status-message {
      color: #4b5563;
      font-size: 14px;
    }
    .timeline {
      margin: 32px 0;
      position: relative;
    }
    .timeline-step {
      display: flex;
      align-items: flex-start;
      margin-bottom: 24px;
      position: relative;
    }
    .timeline-step:last-child {
      margin-bottom: 0;
    }
    .timeline-step.completed .timeline-icon {
      background: #10b981;
      border-color: #10b981;
    }
    .timeline-step.current .timeline-icon {
      background: #7c3aed;
      border-color: #7c3aed;
      box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.2);
    }
    .timeline-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: white;
      border: 2px solid #d1d5db;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      margin-right: 16px;
      flex-shrink: 0;
      position: relative;
      z-index: 2;
    }
    .timeline-content {
      flex: 1;
    }
    .timeline-title {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }
    .timeline-date {
      font-size: 12px;
      color: #6b7280;
    }
    .timeline-line {
      position: absolute;
      left: 19px;
      top: 40px;
      width: 2px;
      height: calc(100% - 24px);
      background: #e5e7eb;
      z-index: 1;
    }
    .order-summary {
      background: #f9fafb;
      border-radius: 16px;
      padding: 20px;
      margin: 24px 0;
      border: 1px solid #e5e7eb;
    }
    .order-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .order-row:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .order-label {
      color: #6b7280;
      font-size: 14px;
    }
    .order-value {
      font-weight: 600;
      color: #1f2937;
    }
    .items-table {
      width: 100%;
      margin: 20px 0;
      border-collapse: collapse;
    }
    .items-table th {
      text-align: left;
      padding: 12px 8px;
      color: #6b7280;
      font-size: 12px;
      font-weight: 500;
      border-bottom: 1px solid #e5e7eb;
    }
    .items-table td {
      padding: 12px 8px;
      border-bottom: 1px solid #f3f4f6;
    }
    .item-name {
      font-weight: 500;
      color: #1f2937;
    }
    .shipping-info {
      background: #f0fdf4;
      border-radius: 12px;
      padding: 16px;
      margin: 20px 0;
      border: 1px solid #bbf7d0;
    }
    .tracking-number {
      background: #fef3c7;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      margin: 16px 0;
      border: 1px solid #fde68a;
    }
    .tracking-code {
      font-family: monospace;
      font-size: 18px;
      font-weight: 700;
      color: #d97706;
      letter-spacing: 2px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 12px;
      font-weight: 600;
      margin: 16px 0;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(102,126,234,0.3);
    }
    .footer {
      background: #f9fafb;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    .social-links {
      margin-top: 16px;
    }
    .social-links a {
      color: #8b5cf6;
      text-decoration: none;
      margin: 0 8px;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    .animate-pulse {
      animation: pulse 2s infinite;
    }
  </style>
</head>
<body>
  <div style="max-width: 600px; margin: 0 auto;">
    <div class="container">
      <div class="header">
        <div class="logo">🧩</div>
        <h1 class="title">Order Status Update</h1>
        <div class="order-number">Order #${order.orderNumber}</div>
      </div>
      
      <div class="content">
        <p style="color: #1f2937; font-size: 16px;">Hello ${
          order.user?.firstName ||
          order.shippingAddress?.firstName ||
          "Valued Customer"
        },</p>
        <p style="color: #4b5563;">Your order status has been updated. Here are the latest details:</p>
        
        <!-- Status Card -->
        <div class="status-card">
          <div class="status-icon">
            ${getStatusIcon(order.status)}
          </div>
          <div class="status-text">${getStatusText(order.status)}</div>
          <div class="status-message">${getStatusMessage(order.status)}</div>
        </div>
        
        <!-- Order Timeline -->
        <div class="timeline">
          ${renderTimeline(order)}
        </div>
        
        <!-- Order Summary -->
        <div class="order-summary">
          <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 16px;">📦 Order Summary</h3>
          <div class="order-row">
            <span class="order-label">Order Date</span>
            <span class="order-value">${new Date(
              order.createdAt
            ).toLocaleDateString()}</span>
          </div>
          <div class="order-row">
            <span class="order-label">Payment Method</span>
            <span class="order-value">${getPaymentMethodText(
              order.paymentMethod
            )}</span>
          </div>
          <div class="order-row">
            <span class="order-label">Payment Status</span>
            <span class="order-value">${getPaymentStatusText(
              order.paymentStatus
            )}</span>
          </div>
          <div class="order-row">
            <span class="order-label">Shipping Method</span>
            <span class="order-value">${
              order.shippingMethod === "express" ? "🚀 Express" : "📬 Standard"
            }</span>
          </div>
        </div>
        
        <!-- Order Items -->
        <h3 style="margin: 24px 0 12px 0; color: #1f2937; font-size: 16px;">🛍️ Items in Your Order</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items
              .map(
                (item) => `
              <tr>
                <td class="item-name">${item.product?.name || "Product"}</td>
                <td>${item.quantity}</td>
                <td>${(item.price || 0).toFixed(2)} DT</td>
                <td>${((item.price || 0) * item.quantity).toFixed(2)} DT</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        
        <!-- Order Totals -->
        <div class="order-summary" style="margin-top: 8px;">
          <div class="order-row">
            <span class="order-label">Subtotal</span>
            <span class="order-value">${
              order.subtotal?.toFixed(2) || "0.00"
            } DT</span>
          </div>
          <div class="order-row">
            <span class="order-label">Tax (19% TVA)</span>
            <span class="order-value">${
              order.tax?.toFixed(2) || "0.00"
            } DT</span>
          </div>
          <div class="order-row">
            <span class="order-label">Shipping</span>
            <span class="order-value">${
              order.shippingCost?.toFixed(2) || "0.00"
            } DT</span>
          </div>
          <div class="order-row" style="border-top: 2px solid #e5e7eb; margin-top: 8px; padding-top: 12px;">
            <span class="order-label" style="font-weight: 700;">Total</span>
            <span class="order-value" style="font-size: 18px; color: #7c3aed;">${
              order.totalAmount?.toFixed(2) || "0.00"
            } DT</span>
          </div>
        </div>
        
        <!-- Shipping Information -->
        <div class="shipping-info">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 20px;">📍</span>
            <span style="font-weight: 600; color: #1f2937;">Shipping Address</span>
          </div>
          <p style="margin: 0; color: #4b5563;">
            ${order.shippingAddress?.firstName} ${
    order.shippingAddress?.lastName
  }<br>
            ${order.shippingAddress?.address}<br>
            ${order.shippingAddress?.city}, ${order.shippingAddress?.state} ${
    order.shippingAddress?.postalCode
  }<br>
            ${order.shippingAddress?.country}<br>
            Phone: ${order.shippingAddress?.phone || "Not provided"}
          </p>
        </div>
        
        <!-- Tracking Information -->
        ${
          order.trackingNumber
            ? `
          <div class="tracking-number">
            <div style="font-size: 14px; color: #92400e; margin-bottom: 8px;">📬 Tracking Information</div>
            <div class="tracking-code">${order.trackingNumber}</div>
            <div style="font-size: 12px; color: #92400e; margin-top: 8px;">
              Carrier: ${order.carrier || "Standard Shipping"}
            </div>
            ${
              order.estimatedDelivery
                ? `
              <div style="font-size: 12px; color: #92400e; margin-top: 4px;">
                Estimated Delivery: ${new Date(
                  order.estimatedDelivery
                ).toLocaleDateString()}
              </div>
            `
                : ""
            }
          </div>
        `
            : ""
        }
        
        <!-- Action Buttons -->
        <div style="text-align: center;">
          <a href="${process.env.FRONTEND_URL}/orders/${
    order._id
  }" class="button">
            🔍 View Order Details
          </a>
        </div>
        
        <!-- Next Steps -->
        <div style="background: #eff6ff; border-radius: 12px; padding: 16px; margin: 24px 0 0 0;">
          <h4 style="margin: 0 0 8px 0; color: #1e40af;">✨ What's Next?</h4>
          <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 13px;">
            ${getNextSteps(order.status)}
          </ul>
        </div>
        
        <p style="color: #4b5563; margin-top: 24px;">
          Thank you for choosing PUZZLE! If you have any questions about your order, please don't hesitate to 
          <a href="${
            process.env.FRONTEND_URL
          }/contact" style="color: #7c3aed;">contact our support team</a>.
        </p>
        
        <hr style="margin: 24px 0;">
        
        <div style="text-align: center;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            Need help? Reply to this email or visit our 
            <a href="${
              process.env.FRONTEND_URL
            }/help" style="color: #7c3aed;">Help Center</a>
          </p>
        </div>
      </div>
      
      <div class="footer">
        <p>© 2024 PUZZLE | Where Fashion Meets Mystery</p>
        <div class="social-links">
          <a href="#">🐦 Twitter</a> •
          <a href="#">📘 Facebook</a> •
          <a href="#">📸 Instagram</a> •
          <a href="#">💬 Discord</a>
        </div>
        <p style="margin-top: 16px;">
          <small>This email was sent to ${
            order.user?.email || order.shippingAddress?.email
          }</small>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`,
};

module.exports = {
  sendEmail,
  emailTemplates,
};
