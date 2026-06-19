// src/utils/planLimits.js
const PLAN_LIMITS = {
    'Basic': { min: 100, max: 2000 },
    'Premium': { min: 500, max: 10000 },
    'Investor': { min: 1000, max: 20000 }
};

function getPlanLimits(plan) {
    return PLAN_LIMITS[plan] || PLAN_LIMITS['Basic'];
}

function validateDepositAmount(amount, plan) {
    const limits = getPlanLimits(plan);
    return amount >= limits.min && amount <= limits.max;
}

module.exports = { getPlanLimits, validateDepositAmount };