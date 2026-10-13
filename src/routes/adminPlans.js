// src/routes/adminPlans.js
const express = require('express');
const { db } = require('../services/firebase');
const { authenticate, isAdmin } = require('../middleware/auth');
const {
    DEFAULT_PLANS,
    PLAN_LEVELS,
    refreshPlanCache
} = require('../utils/planLimits');

const router = express.Router();

router.get('/', authenticate, isAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('planConfigs').get();
        if (snapshot.empty) {
            return res.json(Object.values(DEFAULT_PLANS));
        }
        const plans = [];
        snapshot.forEach(doc => plans.push({ name: doc.id, ...doc.data() }));
        plans.sort((a, b) => (PLAN_LEVELS[a.name] || 0) - (PLAN_LEVELS[b.name] || 0));
        res.json(plans);
    } catch (error) {
        console.error('Error fetching plan configs:', error);
        res.status(500).json({ error: 'Failed to load plan configs' });
    }
});

router.put('/:planName', authenticate, isAdmin, async (req, res) => {
    const { planName } = req.params;
    if (!PLAN_LEVELS[planName]) {
        return res.status(400).json({ error: 'Invalid plan name' });
    }
    const allowed = ['min','max','monthlyFee','yearlyFee','discountPercent','interestRate','dailySaveMax','icon','bestFor','features'];
    const update = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    if (update.min !== undefined && (typeof update.min !== 'number' || update.min < 0)) {
        return res.status(400).json({ error: 'min must be >= 0' });
    }
    if (update.max !== undefined && (typeof update.max !== 'number' || update.max < 0)) {
        return res.status(400).json({ error: 'max must be >= 0' });
    }
    if (update.min !== undefined && update.max !== undefined && update.min > update.max) {
        return res.status(400).json({ error: 'min cannot be greater than max' });
    }
    if (update.monthlyFee !== undefined && (typeof update.monthlyFee !== 'number' || update.monthlyFee < 0)) {
        return res.status(400).json({ error: 'monthlyFee must be >= 0' });
    }
    if (update.yearlyFee !== undefined && (typeof update.yearlyFee !== 'number' || update.yearlyFee < 0)) {
        return res.status(400).json({ error: 'yearlyFee must be >= 0' });
    }
    if (update.interestRate !== undefined && (typeof update.interestRate !== 'number' || update.interestRate < 0)) {
        return res.status(400).json({ error: 'interestRate must be >= 0' });
    }
    if (update.dailySaveMax !== undefined && (typeof update.dailySaveMax !== 'number' || update.dailySaveMax < 0)) {
        return res.status(400).json({ error: 'dailySaveMax must be >= 0' });
    }
    if (update.discountPercent !== undefined && (typeof update.discountPercent !== 'number' || update.discountPercent < 0 || update.discountPercent > 100)) {
        return res.status(400).json({ error: 'discountPercent must be 0-100' });
    }
    if (update.features !== undefined && !Array.isArray(update.features)) {
        return res.status(400).json({ error: 'features must be an array' });
    }

    try {
        update.updatedAt = new Date();
        update.updatedBy = req.user.uid;
        await db.collection('planConfigs').doc(planName).set(update, { merge: true });
        await refreshPlanCache();
        res.json({
            success: true,
            message: `${planName} plan updated.`,
            plan: { name: planName, ...update }
        });
    } catch (error) {
        console.error('Error updating plan config:', error);
        res.status(500).json({ error: 'Failed to update plan' });
    }
});

router.post('/seed', authenticate, isAdmin, async (req, res) => {
    try {
        const results = {};
        for (const [name, data] of Object.entries(DEFAULT_PLANS)) {
            const ref = db.collection('planConfigs').doc(name);
            const existing = await ref.get();
            if (existing.exists) {
                results[name] = 'already exists (skipped)';
            } else {
                await ref.set({
                    ...data,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    seededFrom: 'DEFAULT_PLANS'
                });
                results[name] = 'created';
            }
        }
        await refreshPlanCache();
        res.json({ success: true, results });
    } catch (error) {
        console.error('Error seeding plan configs:', error);
        res.status(500).json({ error: 'Failed to seed plans' });
    }
});

module.exports = router;