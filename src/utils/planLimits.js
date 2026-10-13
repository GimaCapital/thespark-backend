// src/utils/planLimits.js
const admin = require('firebase-admin');

// ============================================================
// DEFAULT PLAN CONFIGS — the fallback when Firestore is empty.
// These match your original values, so nothing changes on first
// deploy until you edit a plan in the admin.
// ============================================================
const DEFAULT_PLANS = {
    Basic: {
        name: 'Basic',
        min: 100,
        max: 2300,
        monthlyFee: 0,
        yearlyFee: 0,
        discountPercent: 0,
        interestRate: 5,
        dailySaveMax: 2000,
        icon: '🌱',
        bestFor: 'Perfect for beginners',
        features: [
            '✓ Graduate certificate after 8 cycles',
            '✓ Full access to wealth education library',
            '✓ Daily educational messages',
            '✓ 21-day cycle tracking',
            '✓ Progress dashboard',
            '✓ Referral program access',
            '✓ Community forum access',
            '✓ Basic email support',
            '✓ Cycle completion milestones'
        ]
    },
    Premium: {
        name: 'Premium',
        min: 500,
        max: 11000,
        monthlyFee: 1000,
        yearlyFee: 10000,
        discountPercent: 17,
        interestRate: 4,
        dailySaveMax: 10000,
        icon: '⭐',
        bestFor: 'For serious savers',
        features: [
            '✓ Graduate certificate after 8 cycles',
            '✓ Priority support response (within 12 hours)',
            '✓ Private Premium WhatsApp community',
            '✓ Weekly live coaching calls',
            '✓ Exclusive video lessons',
            '✓ Downloadable worksheets',
            '✓ Goal-setting workshops',
            '✓ Monthly progress reports',
            '✓ Early access to new features',
            '✓ All Basic features included'
        ]
    },
    Investor: {
        name: 'Investor',
        min: 1000,
        max: 22000,
        monthlyFee: 2500,
        yearlyFee: 25000,
        discountPercent: 17,
        interestRate: 3,
        dailySaveMax: 20000,
        icon: '💎',
        bestFor: 'For wealth builders',
        features: [
            '✓ Graduate certificate after 8 cycles',
            '✓ Priority support response (within 6 hours)',
            '✓ Private Investor WhatsApp community',
            '✓ Weekly one-on-one coaching sessions',
            '✓ Exclusive advanced learning content',
            '✓ Investment education modules',
            '✓ Asset-building workshops',
            '✓ Real estate education',
            '✓ Business development resources',
            '✓ Quarterly strategy sessions',
            '✓ All Premium features included'
        ]
    }
};

// Plan tiers — Basic < Premium < Investor. Not admin-editable.
const PLAN_LEVELS = { Basic: 1, Premium: 2, Investor: 3 };

// ============================================================
// In-memory cache. Refreshed on startup and after admin edits.
// ============================================================
let cache = JSON.parse(JSON.stringify(DEFAULT_PLANS)); // deep copy
let cacheLoaded = false;

// Access firestore lazily so this file can be required before admin.initializeApp()
function db() {
    return admin.firestore();
}

// ============================================================
// Load plan configs from Firestore into memory.
// Falls back to defaults if Firestore is empty or errors.
// ============================================================
async function loadPlanCache() {
    try {
        const snapshot = await db().collection('planConfigs').get();
        if (snapshot.empty) {
            console.log('📋 planConfigs empty — using defaults (call /admin/plans/seed to write them)');
            cache = JSON.parse(JSON.stringify(DEFAULT_PLANS));
        } else {
            const fresh = {};
            snapshot.forEach(doc => {
                fresh[doc.id] = { name: doc.id, ...doc.data() };
            });
            // Fill in any missing plans from defaults
            for (const [name, def] of Object.entries(DEFAULT_PLANS)) {
                if (!fresh[name]) fresh[name] = def;
            }
            cache = fresh;
            console.log(`📋 Loaded ${snapshot.size} plan configs from Firestore`);
        }
        cacheLoaded = true;
    } catch (err) {
        console.error('⚠️ Failed to load planConfigs, using defaults:', err.message);
        cache = JSON.parse(JSON.stringify(DEFAULT_PLANS));
        cacheLoaded = true;
    }
}

// ============================================================
// Manual refresh — call after admin edits
// ============================================================
async function refreshPlanCache() {
    await loadPlanCache();
}

// ============================================================
// Sync getters — read from cache. Fast, no await needed.
// ============================================================
function getPlanLimits(plan) {
    return cache[plan] || cache.Basic;
}

function validateDepositAmount(amount, plan) {
    const limits = getPlanLimits(plan);
    return amount >= limits.min && amount <= limits.max;
}

function getPlanLevel(plan) {
    return PLAN_LEVELS[plan] || 1;
}

function getPlanByName(planName) {
    if (!cache[planName]) return null;
    return {
        ...cache[planName],
        level: getPlanLevel(planName)
    };
}

function getAllPlans() {
    return Object.entries(cache)
        .map(([name, data]) => ({
            name,
            level: getPlanLevel(name),
            monthlyFee: data.monthlyFee,
            yearlyFee: data.yearlyFee,
            discountPercent: data.discountPercent,
            interestRate: data.interestRate,
            dailyMin: data.min,
            dailyMax: data.max,
            dailySaveMax: data.dailySaveMax,
            icon: data.icon,
            bestFor: data.bestFor,
            features: data.features
        }))
        // ✅ Sort by level so Basic (1) → Premium (2) → Investor (3) always
        .sort((a, b) => a.level - b.level);
}

function getPlanInterestRate(plan) {
    return cache[plan]?.interestRate ?? cache.Basic.interestRate;
}

function getPlanMonthlyFee(plan) {
    return cache[plan]?.monthlyFee ?? 0;
}

function getPlanYearlyFee(plan) {
    return cache[plan]?.yearlyFee ?? 0;
}

function getPlanFee(plan, billingInterval = 'monthly') {
    return billingInterval === 'yearly'
        ? getPlanYearlyFee(plan)
        : getPlanMonthlyFee(plan);
}

function getPlanDurationDays(billingInterval = 'monthly') {
    return billingInterval === 'yearly' ? 365 : 30;
}

// ============================================================
// Exports
// ============================================================
module.exports = {
    DEFAULT_PLANS,
    PLAN_LEVELS,
    loadPlanCache,
    refreshPlanCache,
    getPlanLimits,
    validateDepositAmount,
    getPlanLevel,
    getPlanByName,
    getAllPlans,
    getPlanInterestRate,
    getPlanMonthlyFee,
    getPlanYearlyFee,
    getPlanFee,
    getPlanDurationDays
};