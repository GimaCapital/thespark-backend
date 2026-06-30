// // src/services/emailService.js
// const nodemailer = require('nodemailer');
// require('dotenv').config();

// let transporter = null;

// const setupTransporter = () => {
//     if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
//         console.warn('⚠️ Email not configured');
//         return;
//     }
    
//     transporter = nodemailer.createTransport({
//         service: 'gmail',
//         auth: {
//             user: process.env.GMAIL_USER,
//             pass: process.env.GMAIL_APP_PASSWORD
//         }
//     });
    
//     transporter.verify((error) => {
//         if (error) {
//             console.error('❌ Email error:', error.message);
//         } else {
//             console.log('✅ Email ready!');
//         }
//     });
// };

// setupTransporter();

// // ============ SEND WELCOME EMAIL ============
// const sendWelcomeEmail = async (email, fullName) => {
//     if (!transporter) {
//         console.error('❌ Transporter not available');
//         return false;
//     }
    
//     const appUrl = process.env.APP_URL || 'http://localhost:3000';
    
//     const htmlContent = `
//         <!DOCTYPE html>
//         <html>
//         <head>
//             <style>
//                 body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
//                 .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
//                 .header { text-align: center; border-bottom: 2px solid #f0b429; padding-bottom: 20px; }
//                 .header .logo { font-size: 28px; font-weight: bold; color: #1a1a2e; }
//                 .header .logo span { color: #f0b429; }
//                 .header .subtitle { color: #666; font-size: 14px; margin-top: 5px; }
//                 .content { padding: 20px 0; }
//                 .button { display: inline-block; background: #f0b429; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 10px 0; }
//                 .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 20px; }
//                 .highlight { color: #f0b429; font-weight: bold; }
//             </style>
//         </head>
//         <body>
//             <div class="container">
//                 <div class="header">
//                     <div class="logo">🔥 The<span>Spark</span></div>
//                     <div class="subtitle">Welcome to TheSpark!</div>
//                 </div>
                
//                 <div class="content">
//                     <p>Hello <strong>${fullName}</strong>,</p>
                    
//                     <p>Welcome to TheSpark! 🎉</p>
                    
//                     <p>You've successfully created your account. You're now on your journey to building wealth and financial freedom.</p>
                    
//                     <h3 style="color: #1a1a2e;">📊 What's Next?</h3>
                    
//                     <ol style="line-height: 2; padding-left: 20px;">
//                         <li>✅ Complete your profile</li>
//                         <li>💰 Make your first deposit</li>
//                         <li>📈 Start earning daily interest</li>
//                         <li>🚀 Track your progress</li>
//                         <li>👥 Refer friends and earn ₦500 per referral</li>
//                         <li>📖 Read daily financial lessons</li>
//                     </ol>
                    
//                     <p style="text-align: center;">
//                         <a href="${appUrl}/dashboard" class="button">🚀 Go to Dashboard</a>
//                     </p>
                    
//                     <p style="color: #666; font-size: 14px;">
//                         If you have any questions, feel free to reply to this email.
//                     </p>
                    
//                     <p style="margin-top: 20px;">
//                         Best regards,<br>
//                         <strong>TheSpark Team</strong>
//                     </p>
//                 </div>
                
//                 <div class="footer">
//                     <p>© ${new Date().getFullYear()} TheSpark. All rights reserved.</p>
//                     <p><a href="${appUrl}" style="color: #666; text-decoration: none;">${appUrl}</a></p>
//                 </div>
//             </div>
//         </body>
//         </html>
//     `;

//     try {
//         const mailOptions = {
//             from: `"TheSpark Team" <${process.env.EMAIL_FROM_PRIVATE_INVESTOR || process.env.GMAIL_USER}>`,
//             to: email,
//             subject: '🎉 Welcome to TheSpark!',
//             html: htmlContent
//         };

//         await transporter.sendMail(mailOptions);
//         console.log(`✅ Welcome email sent to: ${email}`);
//         return true;
//     } catch (error) {
//         console.error('❌ Error sending welcome email:', error.message);
//         return false;
//     }
// };

// module.exports = { sendWelcomeEmail };

// src/services/emailService.js
// src/services/emailService.js
// src/services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;
let isEmailConfigured = false;
let verificationPromise = null;

const setupTransporter = () => {
    console.log('📧 Setting up email transporter...');
    console.log('GMAIL_USER:', process.env.GMAIL_USER ? '✅ Set' : '❌ NOT SET');
    console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '✅ Set' : '❌ NOT SET');
    
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.warn('⚠️ Email not configured.');
        isEmailConfigured = false;
        verificationPromise = Promise.resolve(false);
        return;
    }
    
    try {
        transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD
            },
            pool: true,
            maxConnections: 1,
            rateLimit: true,
            maxMessages: 5,
            connectionTimeout: 30000,
            greetingTimeout: 30000,
            socketTimeout: 30000
        });
        
        verificationPromise = new Promise((resolve) => {
            transporter.verify((error) => {
                if (error) {
                    console.error('❌ Email transporter verification failed:', error.message);
                    isEmailConfigured = false;
                    resolve(false);
                } else {
                    console.log('✅ Email transporter ready!');
                    isEmailConfigured = true;
                    resolve(true);
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Failed to create email transporter:', error.message);
        isEmailConfigured = false;
        verificationPromise = Promise.resolve(false);
    }
};

setupTransporter();

// ============ SEND WELCOME EMAIL WITH TRACKING ============
const sendWelcomeEmail = async (email, fullName, userId = null, maxRetries = 3) => {
    console.log(`📧 Attempting to send welcome email to: ${email}`);
    
    if (verificationPromise) {
        console.log('⏳ Waiting for email transporter verification...');
        await verificationPromise;
        console.log('✅ Verification complete. Email configured:', isEmailConfigured);
    }
    
    console.log('Transporter status:', transporter ? '✅ Available' : '❌ Not available');
    console.log('Email configured:', isEmailConfigured ? '✅ Yes' : '❌ No');
    
    if (!isEmailConfigured || !transporter) {
        console.warn('🔄 Email not configured. Attempting to reinitialize...');
        setupTransporter();
        if (verificationPromise) {
            await verificationPromise;
        }
        
        if (!isEmailConfigured || !transporter) {
            console.warn('⚠️ Email still not configured. Skipping welcome email.');
            return { success: false, error: 'Email not configured', skipped: true };
        }
    }
    
    if (!email) {
        console.error('❌ No email provided');
        return { success: false, error: 'No email provided' };
    }
    
    let attempts = 0;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        attempts = attempt;
        try {
            console.log(`📧 Attempt ${attempt} of ${maxRetries} to send welcome email to ${email}`);
            
            const appUrl = process.env.APP_URL || 'https://thespark-frontend.onrender.com';
            const fromEmail = process.env.EMAIL_FROM_PRIVATE_INVESTOR || process.env.GMAIL_USER;
            
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Welcome to TheSpark</title>
                    <style>
                        body, html {
                            margin: 0;
                            padding: 0;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                            background-color: #f7f3e9;
                            -webkit-font-smoothing: antialiased;
                            -moz-osx-font-smoothing: grayscale;
                        }
                        .preheader {
                            display: none;
                            font-size: 1px;
                            color: #f7f3e9;
                            max-height: 0;
                            max-width: 0;
                            opacity: 0;
                            overflow: hidden;
                            mso-hide: all;
                        }
                        .container {
                            max-width: 580px;
                            margin: 40px auto;
                            background: #ffffff;
                            border-radius: 20px;
                            box-shadow: 0 8px 40px rgba(0, 0, 0, 0.06);
                            overflow: hidden;
                        }
                        .header {
                            background: linear-gradient(135deg, #f8f4ea 0%, #fef9e7 100%);
                            padding: 40px 40px 30px;
                            text-align: center;
                            border-bottom: 3px solid #f0b429;
                        }
                        .header .logo {
                            font-size: 36px;
                            font-weight: 800;
                            color: #1a1a2e;
                            letter-spacing: -0.5px;
                        }
                        .header .logo span {
                            color: #f0b429;
                        }
                        .header .subtitle {
                            color: #666;
                            font-size: 18px;
                            margin-top: 8px;
                            font-weight: 400;
                        }
                        .header .badge {
                            display: inline-block;
                            background: #f0b429;
                            color: #1a1a2e;
                            font-size: 12px;
                            font-weight: 600;
                            padding: 4px 16px;
                            border-radius: 20px;
                            margin-top: 12px;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }
                        .content {
                            padding: 35px 40px 30px;
                            color: #333;
                            line-height: 1.7;
                            font-size: 16px;
                        }
                        .content h3 {
                            color: #1a1a2e;
                            font-size: 22px;
                            margin-top: 30px;
                            margin-bottom: 20px;
                            font-weight: 700;
                            text-align: center;
                        }
                        .content p {
                            font-size: 16px;
                            margin-bottom: 16px;
                            color: #444;
                        }
                        .steps-grid {
                            display: block;
                            margin: 20px 0 25px;
                        }
                        .step-card {
                            display: flex;
                            align-items: flex-start;
                            gap: 16px;
                            padding: 14px 18px;
                            margin-bottom: 12px;
                            background: #faf8f4;
                            border-radius: 12px;
                            border: 1px solid #f0ebe0;
                            transition: all 0.2s ease;
                        }
                        .step-card:hover {
                            background: #f8f4ea;
                            border-color: #f0b429;
                            transform: translateX(2px);
                        }
                       
                        .step-content {
                            flex: 1;
                        }
                        .step-content .step-title {
                            font-size: 16px;
                            font-weight: 600;
                            color: #1a1a2e;
                            display: block;
                            margin-bottom: 2px;
                        }
                        .step-content .step-desc {
                            font-size: 14px;
                            color: #666;
                            line-height: 1.5;
                        }
                        .step-icon {
                            flex-shrink: 0;
                            font-size: 24px;
                            margin-right: 4px;
                        }
                        .highlight-box {
                            background: #fef9e7;
                            border-left: 4px solid #f0b429;
                            padding: 16px 20px;
                            border-radius: 8px;
                            margin: 20px 0;
                            font-size: 16px;
                            color: #1a1a2e;
                        }
                        .button-container {
                            text-align: center;
                            margin: 30px 0 20px;
                        }
                        .button {
                            display: inline-block;
                            background: #f0b429;
                            color: #1a1a2e !important;
                            padding: 16px 45px;
                            text-decoration: none;
                            border-radius: 50px;
                            font-weight: 700;
                            font-size: 18px;
                            transition: background 0.3s ease;
                            box-shadow: 0 4px 12px rgba(240, 180, 41, 0.3);
                        }
                        .button:hover {
                            background: #d9a320;
                            box-shadow: 0 6px 16px rgba(240, 180, 41, 0.4);
                        }
                        .contact-info {
                            background: #f8f4ea;
                            padding: 14px 20px;
                            border-radius: 10px;
                            margin: 20px 0;
                            text-align: center;
                            font-size: 14px;
                            color: #555;
                        }
                        .whitelist-box {
                            background: #e8f5e9;
                            padding: 14px 20px;
                            border-radius: 10px;
                            margin: 20px 0;
                            text-align: center;
                            font-size: 14px;
                            color: #2e7d32;
                            border-left: 4px solid #4caf50;
                        }
                        .divider {
                            border: none;
                            border-top: 2px solid #f5f0e8;
                            margin: 20px 0;
                        }
                        .footer {
                            background: #f8f4ea;
                            padding: 20px 40px;
                            text-align: center;
                            color: #888;
                            font-size: 12px;
                            border-top: 1px solid #f0ebe0;
                        }
                        .footer a {
                            color: #f0b429;
                            text-decoration: none;
                        }
                        .footer .social {
                            margin: 8px 0;
                        }
                        .footer .social a {
                            display: inline-block;
                            margin: 0 6px;
                            font-size: 18px;
                            text-decoration: none;
                        }
                        .footer .fine-print {
                            font-size: 11px;
                            color: #aaa;
                            line-height: 1.6;
                            margin-top: 6px;
                        }
                        .footer .unsubscribe {
                            font-size: 11px;
                            color: #ccc;
                        }
                        .footer .unsubscribe a {
                            color: #ccc;
                            text-decoration: underline;
                        }
                        .view-online {
                            text-align: center;
                            font-size: 12px;
                            color: #aaa;
                            padding: 10px 0 5px;
                            background: #ffffff;
                        }
                        .view-online a {
                            color: #f0b429;
                            text-decoration: none;
                        }
                        @media (max-width: 480px) {
                            .container { margin: 20px auto; border-radius: 12px; }
                            .header { padding: 30px 20px 20px; }
                            .header .logo { font-size: 28px; }
                            .header .subtitle { font-size: 16px; }
                            .content { padding: 25px 20px 20px; font-size: 15px; }
                            .step-card { padding: 12px 14px; gap: 12px; }
                            .step-number { width: 28px; height: 28px; font-size: 12px; }
                            .step-content .step-title { font-size: 15px; }
                            .step-content .step-desc { font-size: 13px; }
                            .button { padding: 14px 30px; font-size: 16px; }
                            .footer { padding: 16px 20px; font-size: 11px; }
                            .content h3 { font-size: 20px; }
                        }
                        @media (max-width: 380px) {
                            .step-card { flex-wrap: wrap; }
                            .step-icon { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="preheader">Welcome to TheSpark - Your wealth-building journey starts here. Complete your profile and make your first deposit today.</div>
                    
                    <div class="container">
                        <div class="header">
                            <div class="logo">🔥 The<span>Spark</span></div>
                            <div class="subtitle">Welcome to TheSpark!</div>
                            <div class="badge">⭐ YOU Are Our Spark</div>
                        </div>
                        
                        <div class="content">
                            <p style="font-size: 20px; font-weight: 600; color: #1a1a2e; margin-bottom: 12px;">Hello <strong>${fullName || 'Saver'}</strong>, 👋</p>
                            
                            <p>Welcome to TheSpark! 🎉</p>
                            
                            <p>You've successfully created your account. You're now on your journey to building wealth and financial freedom.</p>
                            
                            <div class="highlight-box">
                                💡 <strong>Your journey starts here:</strong> You've taken the first step toward financial independence.
                            </div>
                            
                            <h3>📊 What's Next?</h3>
                            
                            <div class="steps-grid">
                                <div class="step-card">
                                    <div class="step-content">
                                        <span class="step-title">✅ Complete Your Profile</span>
                                        <span class="step-desc">Add your details to get the most out of TheSpark</span>
                                    </div>
                                    <div class="step-icon">📝</div>
                                </div>
                                
                                <div class="step-card">
                                    <div class="step-content">
                                        <span class="step-title">💰 Make Your First Deposit</span>
                                        <span class="step-desc">Start earning daily interest on your savings</span>
                                    </div>
                                    <div class="step-icon">💳</div>
                                </div>
                                
                                <div class="step-card">
                                    <div class="step-content">
                                        <span class="step-title">📈 Track Your Progress</span>
                                        <span class="step-desc">Watch your savings grow in real-time</span>
                                    </div>
                                    <div class="step-icon">📊</div>
                                </div>
                                
                                <div class="step-card">
                                    <div class="step-content">
                                        <span class="step-title">👥 Refer Friends</span>
                                        <span class="step-desc">Earn <strong style="color: #f0b429;">₦500</strong> per successful referral</span>
                                    </div>
                                    <div class="step-icon">🤝</div>
                                </div>
                                
                                <div class="step-card">
                                    <div class="step-content">
                                        <span class="step-title">📖 Read Daily Lessons</span>
                                        <span class="step-desc">Improve your financial literacy every day</span>
                                    </div>
                                    <div class="step-icon">📚</div>
                                </div>
                            </div>
                            
                            <div class="button-container">
                                <a href="${appUrl}/dashboard" class="button">🚀 Go to Dashboard</a>
                            </div>
                            
                            <div class="whitelist-box">
                                📌 <strong>Add us to your contacts</strong><br>
                                To ensure you receive all future emails, add <strong>${fromEmail}</strong> to your address book.
                            </div>
                            
                            <div class="contact-info">
                                📧 Need help? Reply to this email and we'll get back to you within 24 hours.
                            </div>
                            
                            <hr class="divider">
                            
                            <p style="font-size: 15px; color: #666;">
                                If you have any questions, feel free to reply to this email.
                            </p>
                            
                            <p style="font-size: 16px; margin-top: 24px;">
                                Best regards,<br>
                                <strong style="color: #1a1a2e; font-size: 18px;">TheSpark Team</strong>
                            </p>
                        </div>
                        
                        <div class="footer">
                            <div class="social">
                                <a href="#" style="color: #1a1a2e;">📱</a>
                                <a href="#" style="color: #1a1a2e;">🐦</a>
                                <a href="#" style="color: #1a1a2e;">📷</a>
                                <a href="#" style="color: #1a1a2e;">💼</a>
                            </div>
                            <p>© ${new Date().getFullYear()} TheSpark</p>
                            <p><a href="${appUrl}">${appUrl.replace(/^https?:\/\//, '')}</a></p>
                            <div class="fine-print">
                                You received this email because you created an account on TheSpark.
                            </div>
                            <div class="unsubscribe">
                                <a href="mailto:${process.env.GMAIL_USER}?subject=unsubscribe">Unsubscribe</a>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;

            const mailOptions = {
                from: `"TheSpark Team" <${fromEmail}>`,
                to: email,
                replyTo: process.env.GMAIL_USER,
                subject: '🎉 Welcome to TheSpark!',
                html: htmlContent,
                text: `Welcome to TheSpark, ${fullName || 'Saver'}! \n\nYou've successfully created your account. You're now on your journey to building wealth and financial freedom. \n\nWhat's Next? \n1. Complete Your Profile - Add your details to get the most out of TheSpark \n2. Make Your First Deposit - Start earning daily interest on your savings \n3. Track Your Progress - Watch your savings grow in real-time \n4. Refer Friends - Earn ₦500 per successful referral \n5. Read Daily Lessons - Improve your financial literacy every day \n\nGo to Dashboard: ${appUrl}/dashboard \n\nIf you have any questions, feel free to reply to this email. \n\nBest regards, \nTheSpark Team`,
                headers: {
                    'X-Priority': '3',
                    'X-Mailer': 'TheSpark',
                    'List-Unsubscribe': `<mailto:${process.env.GMAIL_USER}?subject=unsubscribe>`
                }
            };

            const info = await transporter.sendMail(mailOptions);
            console.log(`✅ Welcome email sent successfully to: ${email}`);
            console.log('📧 Message ID:', info.messageId);
            console.log('📧 Response:', info.response);
            
            return { 
                success: true, 
                messageId: info.messageId,
                attempts: attempts,
                email: email,
                sentAt: new Date().toISOString()
            };
            
        } catch (error) {
            lastError = error;
            console.error(`❌ Attempt ${attempt} failed:`, error.message);
            
            if (error.message.includes('Invalid login')) {
                console.error('❌ Gmail authentication failed! Check your GMAIL_USER and GMAIL_APP_PASSWORD');
                return { success: false, error: 'Authentication failed', attempts: attempt };
            } else if (error.message.includes('daily limit')) {
                console.error('❌ Daily sending limit reached!');
                return { success: false, error: 'Daily limit reached', attempts: attempt };
            } else if (error.message.includes('550')) {
                console.error('❌ Email rejected by recipient server');
                return { success: false, error: 'Email rejected', attempts: attempt };
            }
            
            if (attempt === maxRetries) {
                console.error(`❌ Failed to send welcome email after ${maxRetries} attempts`);
                return { 
                    success: false, 
                    error: lastError?.message || 'Failed after retries',
                    attempts: attempt 
                };
            }
            
            const waitTime = 2000 * Math.pow(2, attempt - 1);
            console.log(`⏳ Waiting ${waitTime}ms before retry ${attempt + 1}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    
    return { 
        success: false, 
        error: lastError?.message || 'Unknown error',
        attempts: attempts 
    };
};

module.exports = { sendWelcomeEmail };