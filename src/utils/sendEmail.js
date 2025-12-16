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

// Send email function
const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: `"FashionStore Tunisia" <${process.env.EMAIL_FROM}>`,
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
  welcome: (name) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #8B5CF6;">Welcome to FashionStore Tunisia!</h1>
      <p>Hello ${name},</p>
      <p>Thank you for joining FashionStore. Your account has been successfully created.</p>
      <p>Start shopping now and enjoy:</p>
      <ul>
        <li>✅ Free shipping on orders over 99 DT</li>
        <li>✅ Premium quality products</li>
        <li>✅ Secure payment options</li>
        <li>✅ 30-day return policy</li>
      </ul>
      <p>Visit our store: <a href="${process.env.FRONTEND_URL}">${process.env.FRONTEND_URL}</a></p>
      <p>Best regards,<br>The FashionStore Team</p>
    </div>
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
};

module.exports = {
  sendEmail,
  emailTemplates,
};
