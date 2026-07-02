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


app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`TheSpark backend running on port ${PORT}`);
});