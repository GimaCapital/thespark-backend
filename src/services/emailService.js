// src/services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

const setupTransporter = () => {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.warn('⚠️ Email not configured');
        return;
    }
    
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
    
    transporter.verify((error) => {
        if (error) {
            console.error('❌ Email error:', error.message);
        } else {
            console.log('✅ Email ready!');
        }
    });
};

setupTransporter();

// ============ SEND WELCOME EMAIL ============
const sendWelcomeEmail = async (email, fullName) => {
    if (!transporter) {
        console.error('❌ Transporter not available');
        return false;
    }
    
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
                .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { text-align: center; border-bottom: 2px solid #f0b429; padding-bottom: 20px; }
                .header .logo { font-size: 28px; font-weight: bold; color: #1a1a2e; }
                .header .logo span { color: #f0b429; }
                .header .subtitle { color: #666; font-size: 14px; margin-top: 5px; }
                .content { padding: 20px 0; }
                .button { display: inline-block; background: #f0b429; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 10px 0; }
                .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 20px; }
                .highlight { color: #f0b429; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🔥 The<span>Spark</span></div>
                    <div class="subtitle">Welcome to TheSpark!</div>
                </div>
                
                <div class="content">
                    <p>Hello <strong>${fullName}</strong>,</p>
                    
                    <p>Welcome to TheSpark! 🎉</p>
                    
                    <p>You've successfully created your account. You're now on your journey to building wealth and financial freedom.</p>
                    
                    <h3 style="color: #1a1a2e;">📊 What's Next?</h3>
                    
                    <ol style="line-height: 2; padding-left: 20px;">
                        <li>✅ Complete your profile</li>
                        <li>💰 Make your first deposit</li>
                        <li>📈 Start earning daily interest</li>
                        <li>🚀 Track your progress</li>
                        <li>👥 Refer friends and earn ₦500 per referral</li>
                        <li>📖 Read daily financial lessons</li>
                    </ol>
                    
                    <p style="text-align: center;">
                        <a href="${appUrl}/dashboard" class="button">🚀 Go to Dashboard</a>
                    </p>
                    
                    <p style="color: #666; font-size: 14px;">
                        If you have any questions, feel free to reply to this email.
                    </p>
                    
                    <p style="margin-top: 20px;">
                        Best regards,<br>
                        <strong>TheSpark Team</strong>
                    </p>
                </div>
                
                <div class="footer">
                    <p>© ${new Date().getFullYear()} TheSpark. All rights reserved.</p>
                    <p><a href="${appUrl}" style="color: #666; text-decoration: none;">${appUrl}</a></p>
                </div>
            </div>
        </body>
        </html>
    `;

    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.GMAIL_USER,
            to: email,
            subject: '🎉 Welcome to TheSpark!',
            html: htmlContent
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Welcome email sent to: ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending welcome email:', error.message);
        return false;
    }
};

module.exports = { sendWelcomeEmail };