// services/aiRateLimiter.js
class AIRateLimiter {
    constructor() {
        // ✅ ALL VALUES DEFINED HERE - No .env needed
        
        // Per-user limits
        this.maxRequestsPerMinute = 28;      // User can make 28 requests per minute
        this.maxRequestsPerDay = 1000;       // User can make 1000 requests per day
        
        // Global limits (across ALL users)
        this.maxGlobalPerMinute = 29;        // TOTAL across ALL users: 29 requests per minute
        
        // Per-user state
        this.requests = [];
        this.dailyCount = 0;
        this.lastDailyReset = new Date().toDateString();
        this.isPaused = false;
        this.pauseUntil = 0;
        
        // Global state
        this.globalRequests = 0;
        this.globalResetTime = Date.now() + 60000;
        this.isGloballyPaused = false;
        this.globalPauseUntil = 0;
        
        // Queue (if needed)
        this.queue = [];
        this.processing = false;
    }

    canMakeRequest() {
        const now = Date.now();
        
        // ✅ Reset global counter every minute
        if (now > this.globalResetTime) {
            this.globalRequests = 0;
            this.globalResetTime = now + 60000;
            this.isGloballyPaused = false;
        }
        
        // ✅ Check if globally paused
        if (this.isGloballyPaused && now < this.globalPauseUntil) {
            const remaining = Math.ceil((this.globalPauseUntil - now) / 1000);
            console.log(`⛔ GLOBAL PAUSE: Blocking all requests for ${remaining}s`);
            return false;
        }
        
        // ✅ Check global request count - MAX 29 TOTAL
        if (this.globalRequests >= this.maxGlobalPerMinute) {
            console.log(`⛔ GLOBAL LIMIT: ${this.globalRequests}/${this.maxGlobalPerMinute} - PAUSING ALL`);
            this.globalPause(5000);
            return false;
        }
        
        // Reset daily counter
        const today = new Date().toDateString();
        if (today !== this.lastDailyReset) {
            this.dailyCount = 0;
            this.lastDailyReset = today;
        }
        
        // Check daily limit
        if (this.dailyCount >= this.maxRequestsPerDay) {
            console.log(`⚠️ Daily limit reached (${this.maxRequestsPerDay})`);
            return false;
        }
        
        // ✅ Check if we're paused - BLOCK the request
        if (this.isPaused && now < this.pauseUntil) {
            const remaining = Math.ceil((this.pauseUntil - now) / 1000);
            console.log(`⏳ Service paused for ${remaining}s - blocking request`);
            return false;
        }
        
        // ✅ SLIDING WINDOW: Remove requests older than 1 minute
        const oneMinuteAgo = now - 60000;
        this.requests = this.requests.filter(time => time > oneMinuteAgo);
        
        // ✅ SLIDING WINDOW: Check if we're at the limit
        if (this.requests.length >= this.maxRequestsPerMinute) {
            const oldestRequest = this.requests[0];
            const waitTime = (oldestRequest + 60000) - now + 1000;
            console.log(`⚠️ Rate limit reached (${this.requests.length}/28). Pausing for ${Math.ceil(waitTime/1000)}s`);
            this.pause(waitTime);
            return false;
        }
        
        // ✅ ALL CHECKS PASSED - Allow request
        this.globalRequests++;
        return true;
    }

    globalPause(durationMs) {
        this.isGloballyPaused = true;
        this.globalPauseUntil = Date.now() + durationMs;
        
        setTimeout(() => {
            this.isGloballyPaused = false;
            this.globalRequests = 0;
            console.log('✅ GLOBAL PAUSE: Service resumed');
        }, durationMs);
    }

    recordRequest() {
        const now = Date.now();
        this.requests.push(now);
        this.dailyCount++;
        this.globalRequests++;
        
        // Clean up old requests
        const oneMinuteAgo = now - 60000;
        this.requests = this.requests.filter(time => time > oneMinuteAgo);
        
        const remaining = this.maxRequestsPerMinute - this.requests.length;
        console.log(`📊 API Usage: ${this.requests.length}/${this.maxRequestsPerMinute} per min, ${this.dailyCount}/${this.maxRequestsPerDay} today (${remaining} slots left this minute)`);
    }

    handleRateLimit() {
        console.log('🚫 Rate limit hit - pausing for 60 seconds');
        this.pause(60000);
    }

    pause(durationMs) {
        this.isPaused = true;
        this.pauseUntil = Date.now() + durationMs;
        
        setTimeout(() => {
            this.isPaused = false;
            console.log('✅ Service resumed');
        }, durationMs);
    }

    getStatus() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        this.requests = this.requests.filter(time => time > oneMinuteAgo);
        
        const oldestRequest = this.requests.length > 0 ? this.requests[0] : null;
        const nextSlotAvailable = oldestRequest ? (oldestRequest + 60000) - now : 0;
        
        return {
            // Per-user
            requestsThisMinute: this.requests.length,
            maxPerMinute: this.maxRequestsPerMinute,
            requestsToday: this.dailyCount,
            maxPerDay: this.maxRequestsPerDay,
            isPaused: this.isPaused,
            pauseRemaining: this.isPaused ? Math.max(0, this.pauseUntil - now) : 0,
            nextSlotAvailable: Math.max(0, Math.ceil(nextSlotAvailable / 1000)),
            // Global
            globalRequests: this.globalRequests,
            maxGlobalPerMinute: this.maxGlobalPerMinute,
            isGloballyPaused: this.isGloballyPaused,
            globalPauseRemaining: this.isGloballyPaused ? Math.max(0, this.globalPauseUntil - now) : 0,
            available: this.canMakeRequest()
        };
    }
}

module.exports = new AIRateLimiter();