// const express = require('express');
// const cors = require('cors');
// const dotenv = require('dotenv');

// dotenv.config();

// const depositRoutes = require('./routes/deposits');
// const withdrawalRoutes = require('./routes/withdrawals');
// const userRoutes = require('./routes/users');
// const adminRoutes = require('./routes/admin');
// const graduationRoutes = require('./routes/graduation');
// const successStoriesRoutes = require('./routes/successStories'); 
// const flutterwaveRoutes = require('./routes/flutterwave');



// const app = express();

// app.use(cors({
//     origin: process.env.CORS_ORIGIN || '*'
// }));
// app.use(express.json());

// app.use((req, res, next) => {
//     console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
//     next();
// });

// app.get('/health', (req, res) => {
//     res.json({ status: 'ok', timestamp: new Date() });
// });

// app.use('/api/deposits', depositRoutes);
// app.use('/api/withdrawals', withdrawalRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api/graduation', graduationRoutes);
// app.use('/api/success-stories', successStoriesRoutes);
// app.use('/api/flutterwave', flutterwaveRoutes); 

// app.use((err, req, res, next) => {
//     console.error(err.stack);
//     res.status(500).json({ error: 'Something went wrong!' });
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//     console.log(`TheSpark backend running on port ${PORT}`);
// });

// C:\Users\HP\Desktop\TheSpark\thespark-backend\src\server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const depositRoutes = require('./routes/deposits');
const withdrawalRoutes = require('./routes/withdrawals');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const graduationRoutes = require('./routes/graduation');
const successStoriesRoutes = require('./routes/successStories'); 
const flutterwaveRoutes = require('./routes/flutterwave');
const investmentRoutes = require('./routes/thesparkprivateinvestment');
const privateAccessRoutes = require('./routes/first_private_code');
const marketplaceRoutes = require('./routes/marketplace');
const addressRoutes = require('./routes/address');
const aiRoutes = require('./routes/ai');

// ✅ ADDED: cron handlers (used by the HTTP-triggered cron endpoints below)
const { runDailyBalanceUpdate } = require('./cron/dailyBalanceUpdate');
const { sendDailyMessages } = require('./cron/dailyMessages');

const app = express();

// CORS - Allow only your frontend in production
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
}));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// ✅ ADDED: Cron triggers (header-secret protected, no user auth needed)
// These replace the paid Render cron services with a free HTTP scheduler
// (e.g. cron-job.org). Must be placed BEFORE the authenticate middleware
// routes so they don't get blocked by user auth.
app.post('/api/internal/cron/daily-balance-update', async (req, res) => {
    const secret = req.headers['x-cron-secret'];

    if (!process.env.CRON_SECRET) {
        console.error('❌ CRON_SECRET not set');
        return res.status(500).json({ error: 'Cron not configured' });
    }
    if (secret !== process.env.CRON_SECRET) {
        console.warn('❌ Invalid cron secret');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log('🕐 Cron triggered via HTTP: daily-balance-update');
        await runDailyBalanceUpdate();
        console.log('✅ daily-balance-update completed');
        res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('❌ daily-balance-update failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/internal/cron/daily-messages', async (req, res) => {
    const secret = req.headers['x-cron-secret'];

    if (!process.env.CRON_SECRET) {
        console.error('❌ CRON_SECRET not set');
        return res.status(500).json({ error: 'Cron not configured' });
    }
    if (secret !== process.env.CRON_SECRET) {
        console.warn('❌ Invalid cron secret');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log('🕐 Cron triggered via HTTP: daily-messages');
        await sendDailyMessages();
        console.log('✅ daily-messages completed');
        res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('❌ daily-messages failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.use('/api/deposits', depositRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/graduation', graduationRoutes);
app.use('/api/success-stories', successStoriesRoutes);
app.use('/api/flutterwave', flutterwaveRoutes); 
app.use('/api/investment', investmentRoutes);
app.use('/api/private', privateAccessRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/ai', aiRoutes);


app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`TheSpark backend running on port ${PORT}`);
});