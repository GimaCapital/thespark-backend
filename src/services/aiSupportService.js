const { db } = require('../services/firebase');
const admin = require('firebase-admin');
const rateLimiter = require('./aiRateLimiter');

// ============================================================
// CONFIGURATION
// ============================================================

const SUPPORT_CONFIG = {
    provider: process.env.AI_PROVIDER || 'groq',
    model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
    maxTokens: 400,
    temperature: 0.8,
    confidenceThreshold: 0.2, // Lowered, but won't matter now
    handoffTriggers: ['customer support']
};


// ============================================================
// 1. KNOWLEDGE BASE
// ============================================================

class KnowledgeBase {
    constructor() {
        this.documents = [];
        this.initialized = false;
        this.cache = new Map(); // ✅ Simple cache for search results
    }


    async initialize() {
    if (this.initialized) return;
    
    console.log('🔍 Initializing Knowledge Base...');
    
    const sources = await this.collectAllSources();
    this.documents = sources;
    this.initialized = true;
    
    // Clear cache
    this.cache.clear();
    console.log('🗑️ Cache cleared for fresh search results');
    
    // ✅ DEBUG: Check ALL pages - NO hardcoded page names
    const pageDocs = this.documents.filter(d => d.type === 'page');
    console.log(`📄 Total pages found: ${pageDocs.length}`);
    
    // Show content preview for ALL pages (first 5)
    console.log('📝 Page content previews:');
    pageDocs.slice(0, 5).forEach((page, index) => {
        console.log(`  ${index + 1}. ${page.title || 'Untitled'}:`);
        console.log(`     Content length: ${page.content ? page.content.length : 0} chars`);
        if (page.content && page.content.length > 0) {
            console.log(`     Preview: ${page.content.substring(0, 200)}...`);
        } else {
            console.log(`     ⚠️ NO CONTENT!`);
        }
        console.log('---');
    });
    
    // Check if ANY page contains "Gideon" or "founder"
    const hasFounderInfo = this.documents.some(doc => 
        doc.content && (
            doc.content.toLowerCase().includes('gideon') ||
            doc.content.toLowerCase().includes('founder')
        )
    );
    console.log(`🔍 Any page with "Gideon" or "founder": ${hasFounderInfo ? '✅ YES' : '❌ NO'}`);
    
    // Find pages with content (ANY content)
    const pagesWithContent = this.documents.filter(d => 
        d.type === 'page' && d.content && d.content.length > 100
    );
    console.log(`📄 Pages with meaningful content (>100 chars): ${pagesWithContent.length} out of ${pageDocs.length}`);
    
    const types = {};
    this.documents.forEach(doc => {
        const type = doc.type || 'unknown';
        if (!types[type]) types[type] = 0;
        types[type]++;
    });
    
    console.log(`✅ Knowledge Base initialized with ${this.documents.length} documents`);
    console.log('📊 Document types:', types);
    
    const backendFiles = this.documents.filter(d => d.type === 'code' && d.subType === 'backend');
    console.log(`📂 Backend files: ${backendFiles.length}`);
    
    const dbCollections = this.documents.filter(d => d.type === 'database');
    console.log(`📊 Database collections: ${dbCollections.length}`);
    
    console.log(`📄 Frontend pages: ${pageDocs.length}`);
}

    async collectAllSources() {
        const sources = [];
        sources.push(...await this.readBackendCode());
        sources.push(...await this.readFrontendCode());
        sources.push(...await this.readDatabase());
        sources.push(...await this.readDocumentation());
        sources.push(...await this.readKnowledgeArticles());
        return sources;
    }

    // ============================================================
    // READ BACKEND CODE
    // ============================================================

    async readBackendCode() {
        const sources = [];
        try {
            const fs = require('fs');
            const path = require('path');
            
            const routesDir = path.join(__dirname, '../routes');
            console.log('📂 Reading backend routes from:', routesDir);
            
            if (fs.existsSync(routesDir)) {
                const files = fs.readdirSync(routesDir);
                console.log(`📂 Found ${files.length} files in routes directory`);
                
                for (const file of files) {
                    if (file.endsWith('.js')) {
                        const filePath = path.join(routesDir, file);
                        const content = fs.readFileSync(filePath, 'utf8');
                        
                        const routeLines = content
                            .split('\n')
                            .filter(line => line.includes('router.') || line.includes('app.'))
                            .map(line => line.trim())
                            .slice(0, 20);
                        
                        sources.push({
                            id: `backend-${file}`,
                            type: 'code',
                            subType: 'backend',
                            title: `API Route: ${file}`,
                            content: content.substring(0, 3000),
                            metadata: {
                                file: file,
                                path: `routes/${file}`,
                                size: content.length,
                                routes: routeLines
                            }
                        });
                        console.log(`✅ Read backend file: ${file}`);
                    }
                }
            }
            
            const servicesDir = path.join(__dirname, '..');
            const serviceFiles = ['aiSupportService.js', 'firebase.js', 'api.js'];
            for (const file of serviceFiles) {
                const filePath = path.join(servicesDir, file);
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    sources.push({
                        id: `backend-service-${file}`,
                        type: 'code',
                        subType: 'backend',
                        title: `Service: ${file}`,
                        content: content.substring(0, 2000),
                        metadata: { file, path: `services/${file}` }
                    });
                    console.log(`✅ Read service file: ${file}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Error reading backend code:', error);
        }
        return sources;
    }


async readFrontendCode() {
     const sources = [];
    try {
        const fs = require('fs');
        const path = require('path');
        
        // ✅ Check both possible locations
        let srcDir = path.join(__dirname, '../../../thespark-frontend/src');
        let altDir = path.join(__dirname, '../../frontend/src');
        
        if (fs.existsSync(srcDir)) {
            console.log('✅ Found frontend at:', srcDir);
        } else if (fs.existsSync(altDir)) {
            console.log('✅ Found frontend at:', altDir);
            srcDir = altDir;
        } else {
            console.log('❌ Frontend src directory not found');
            return sources;
        }
        
        console.log('✅ Found frontend at:', srcDir);
        
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        console.log('🌐 Using base URL:', baseUrl);
        
        let routeDescriptions = [];
        let pageContents = [];
        
        const walkDir = (dir, prefix = '') => {
            if (!fs.existsSync(dir)) {
                console.log(`⚠️ Directory does not exist: ${dir}`);
                return;
            }
            
            try {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory()) {
                        if (!['node_modules', '.git', 'dist', 'build'].includes(file)) {
                            walkDir(fullPath, prefix + file + '/');
                        }
                    } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.ts')) {
                        try {
                            const content = fs.readFileSync(fullPath, 'utf8');
                            
                            sources.push({
                                id: `frontend-${prefix}${file}`,
                                type: 'code',
                                subType: 'frontend',
                                title: `Component: ${file}`,
                                content: content.substring(0, 2000),
                                metadata: { file, path: `src/${prefix}${file}` }
                            });
                            
                            // ✅ FOR .JS FILES (NOT .JSX) - EXTRACT DIRECTLY
                            if (file.endsWith('.js') && !file.endsWith('.jsx')) {
                                let textContent = content
                                    .replace(/\/\/.*/g, '')           // Remove comments
                                    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
                                    .replace(/\bexport\s+(default|const|let|var)\s+/g, '')
                                    .replace(/\b(const|let|var)\s+/g, '')
                                    .replace(/[{}=,;()]/g, ' ')        // Remove code symbols
                                    .replace(/\s+/g, ' ')
                                    .trim()
                                    .substring(0, 8000);
                                
                                // ✅ Store .js file content directly
                                if (textContent.length > 50) {
                                    const pageName = file.replace(/\.(js|ts)$/, '').toLowerCase();
                                    const title = file.replace(/\.(js|ts)$/, '').replace(/([A-Z])/g, ' $1').trim();
                                    
                                    sources.push({
                                        id: `page-${pageName}`,
                                        type: 'page',
                                        subType: 'content',
                                        title: `${title}`,
                                        content: textContent,
                                        metadata: { file, path: `src/${prefix}${file}` }
                                    });
                                    
                                    console.log(`📝 ${file} extracted ${textContent.length} chars (JS file)`);
                                }
                                
                                // ✅ Skip JSX extraction for .js files
                                continue;
                            }
                            
                            // ✅ FOR .JSX FILES - USE JSX EXTRACTION METHODS
                            let textContent = '';
                            
                            // Method 1: Extract text between JSX tags
                            const jsxText = content.match(/>([^<]{20,})</g) || [];
                            if (jsxText.length > 0) {
                                textContent += jsxText.map(m => m.replace(/[><]/g, '').trim()).join(' ');
                            }
                            
                            // Method 2: Extract text from bookPages array
                            const bookPagesMatch = content.match(/bookPages\s*=\s*\[([\s\S]*?)\]/);
                            if (bookPagesMatch) {
                                const pages = bookPagesMatch[1]
                                    .split(',')
                                    .map(p => p.trim().replace(/['"]/g, ''))
                                    .filter(p => p.length > 20);
                                if (pages.length > 0) {
                                    textContent += ' ' + pages.join(' ');
                                }
                            }
                            
                            // Method 3: Extract text in strings
                            const stringText = content.match(/['"]([^'"]{30,})['"]/g) || [];
                            if (stringText.length > 0) {
                                textContent += ' ' + stringText.map(m => m.replace(/['"]/g, '').trim()).join(' ');
                            }
                            
                            // Method 4: Extract readable text (sentences)
                            const readableText = content.match(/[A-Z][A-Za-z\s,.'"!?]{30,}/g) || [];
                            if (readableText.length > 0) {
                                textContent += ' ' + readableText.join(' ');
                            }
                            
                            // Method 5: Clean Text Extractor
                            if (!file.endsWith('.js')) {
                                const cleanTextMatches = content.match(/>([^{}<>{})]{15,})</g) || [];
                                if (cleanTextMatches.length > 0) {
                                    const cleanText = cleanTextMatches
                                        .map(m => m.replace(/[><]/g, '').trim())
                                        .filter(t => t.length > 15 && !t.includes('{') && !t.includes('}'))
                                        .join(' ');
                                    
                                    if (cleanText.length > 0) {
                                        if (cleanText.length > textContent.length || textContent.includes('{')) {
                                            textContent = cleanText;
                                            console.log(`📝 ${file}: ✅ Clean Text Extraction worked! ${textContent.length} chars`);
                                        }
                                    }
                                }
                            }
                            
                            // Clean up
                            textContent = textContent
                                .replace(/\s+/g, ' ')
                                .trim()
                                .substring(0, 8000);
                            
                            // Log what was extracted
                            if (textContent.length > 100) {
                                console.log(`📝 ${file} extracted ${textContent.length} chars`);
                                if (textContent.length > 200) {
                                    console.log(`   Preview: ${textContent.substring(0, 200)}...`);
                                }
                            } else {
                                console.log(`⚠️ ${file} only extracted ${textContent.length} chars`);
                            }
                            
                            // Check if this is a page component
                            const isPage = content.match(/export\s+default\s+function\s+(\w+)/) || 
                                          content.match(/export\s+default\s+\(/) ||
                                          content.match(/export\s+default\s+(\w+)/) ||
                                          content.match(/export\s+default\s+class\s+\w+/);
                            
                            if (isPage && textContent.length > 50) {
                                let pageName = file.replace(/\.(jsx|js|tsx|ts)$/, '');
                                if (prefix) {
                                    const cleanPrefix = prefix.replace(/\/$/, '').replace(/\//g, '-');
                                    pageName = `${cleanPrefix}-${pageName}`;
                                }
                                
                                const title = file.replace(/\.(jsx|js|tsx|ts)$/, '')
                                    .replace(/([A-Z])/g, ' $1')
                                    .trim();
                                
                                // Store the extracted text
                                sources.push({
                                    id: `page-${pageName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
                                    type: 'page',
                                    subType: 'content',
                                    title: `${title} Page`,
                                    content: textContent,
                                    metadata: {
                                        file: file,
                                        path: `src/${prefix}${file}`,
                                        pageName: pageName,
                                        contentLength: textContent.length
                                    }
                                });
                                
                                pageContents.push({
                                    id: `page-${pageName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
                                    title: title,
                                    content: textContent,
                                    file: file,
                                    path: `src/${prefix}${file}`
                                });
                                
                                console.log(`📄 Found page: ${title} (${textContent.length} chars)`);
                            }
                            
                            // Routes extraction for App.jsx
                            if (file === 'App.jsx' || file === 'App.tsx') {
                                const routeRegex = /path="([^"]+)"/g;
                                let match;
                                const routes = [];
                                while ((match = routeRegex.exec(content)) !== null) {
                                    routes.push(match[1]);
                                }
                                
                                console.log(`📋 Found ${routes.length} routes in App.jsx`);
                                
                                routes.forEach((route) => {
                                    const pageName = route.replace('/', '') || 'Home';
                                    const fullUrl = `${baseUrl}${route}`;
                                    
                                    let description = `The ${pageName} page of TheSpark platform.`;
                                    
                                    const pageContent = pageContents.find(p => 
                                        p.title.toLowerCase().includes(pageName.toLowerCase()) ||
                                        p.file.toLowerCase().includes(pageName.toLowerCase())
                                    );
                                    
                                    if (pageContent && pageContent.content) {
                                        const sentences = pageContent.content.match(/[^.!?]*[.!?]/g);
                                        if (sentences && sentences.length > 0) {
                                            description = sentences.slice(0, 5).join(' ').trim();
                                        }
                                    }
                                    
                                    routeDescriptions.push({
                                        route: route,
                                        fullUrl: fullUrl,
                                        pageName: pageName,
                                        description: description
                                    });
                                });
                                
                                let routeInfo = '📋 AVAILABLE PAGES (FULL URLs):\n\n';
                                routeDescriptions.forEach(r => {
                                    routeInfo += `- ${r.pageName}: ${r.fullUrl}\n`;
                                    routeInfo += `  📝 ${r.description}\n\n`;
                                });
                                
                                sources.push({
                                    id: `frontend-routes`,
                                    type: 'routes',
                                    subType: 'navigation',
                                    title: 'App Routes',
                                    content: routeInfo
                                });
                                
                                routeDescriptions.forEach(r => {
                                    sources.push({
                                        id: `route-${r.pageName.toLowerCase()}`,
                                        type: 'route',
                                        subType: 'page-link',
                                        title: `${r.pageName} Page`,
                                        content: `URL: ${r.fullUrl}\nDescription: ${r.description}`
                                    });
                                });
                            }
                            
                        } catch (error) {
                            console.error(`Error reading file ${file}:`, error);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error reading directory ${dir}:`, error);
            }
        };
        
        walkDir(srcDir);
        
        // Build page map
        const pageSources = sources.filter(s => s.type === 'page');
        let pageMap = '📋 COMPLETE PAGE MAP:\n\n';
        
        routeDescriptions.forEach(r => {
            pageMap += `📄 ${r.pageName}\n`;
            pageMap += `   🔗 ${r.fullUrl}\n`;
            pageMap += `   📝 ${r.description}\n\n`;
        });
        
        pageSources.forEach(p => {
            pageMap += `📄 ${p.title}\n`;
            pageMap += `   📝 ${p.content.substring(0, 300)}...\n\n`;
        });
        
        sources.push({
            id: `page-map`,
            type: 'map',
            subType: 'navigation',
            title: 'Complete Page Map',
            content: pageMap
        });
        
        console.log(`✅ Read ${sources.length} frontend sources`);
        console.log(`✅ Found ${routeDescriptions.length} routes`);
        console.log(`✅ Found ${pageSources.length} pages with content`);
        
    } catch (error) {
        console.error('Error reading frontend:', error);
    }
    return sources;
}


    // ============================================================
// READ DATABASE - OPTIMIZED
// ============================================================

async readDatabase() {
    const sources = [];
    try {
        console.log('📊 Reading database collections...');
        
        const collections = await db.listCollections();
        let collectionCount = 0;
        
        for (const collection of collections) {
            // ✅ Limit to 20 collections for performance (was 10)
            if (collectionCount >= 20) break;  // ← CHANGED
            
            console.log(`📊 Reading collection: ${collection.id}`);
            try {
                const snapshot = await collection.limit(10).get();
                const docs = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const cleanData = {};
                    for (const [key, value] of Object.entries(data)) {
                        if (value && typeof value === 'object' && value.constructor.name === 'Timestamp') {
                            cleanData[key] = value.toDate().toISOString();
                        } else if (typeof value !== 'function') {
                            cleanData[key] = value;
                        }
                    }
                    docs.push({ id: doc.id, ...cleanData });
                });
                
                if (docs.length > 0) {
                    sources.push({
                        id: `db-${collection.id}`,
                        type: 'database',
                        subType: 'collection',
                        title: `Collection: ${collection.id}`,
                        content: JSON.stringify(docs.slice(0, 5), null, 2).substring(0, 1500),
                        metadata: {
                            collection: collection.id,
                            count: docs.length
                        }
                    });
                    console.log(`✅ Read collection: ${collection.id} (${docs.length} docs)`);
                    collectionCount++;
                }
            } catch (error) {
                console.log(`⚠️ Could not read collection ${collection.id}:`, error.message);
            }
        }
        
        console.log(`✅ Total database collections: ${sources.length}`);
        
    } catch (error) {
        console.error('❌ Error reading database:', error.message);
    }
    return sources;
}

    // ============================================================
    // READ DOCUMENTATION
    // ============================================================

    async readDocumentation() {
        const sources = [];
        try {
            const fs = require('fs');
            const path = require('path');
            const docDir = path.join(__dirname, '../docs');
            
            if (fs.existsSync(docDir)) {
                const files = fs.readdirSync(docDir);
                for (const file of files) {
                    if (file.endsWith('.md')) {
                        const content = fs.readFileSync(path.join(docDir, file), 'utf8');
                        sources.push({
                            id: `doc-${file}`,
                            type: 'documentation',
                            title: file.replace('.md', ''),
                            content: content.substring(0, 2000),
                            metadata: { file }
                        });
                    }
                }
            }
        } catch (error) {}
        return sources;
    }

    // ============================================================
    // READ KNOWLEDGE ARTICLES
    // ============================================================

    async readKnowledgeArticles() {
        const sources = [];
        try {
            const snapshot = await db.collection('knowledgeBase').get();
            snapshot.forEach(doc => {
                const data = doc.data();
                sources.push({
                    id: `knowledge-${doc.id}`,
                    type: 'knowledge',
                    title: data.question || 'Knowledge Article',
                    content: `${data.question}\n${data.answer}`.substring(0, 1000),
                    metadata: { category: data.category, tags: data.tags || [] }
                });
            });
        } catch (error) {}
        return sources;
    }

    // ============================================================
    // SEARCH - IMPROVED WITH CACHING
    // ============================================================

   search(query) {
    const cacheKey = query.toLowerCase().trim();
    if (this.cache.has(cacheKey)) {
        console.log(`📦 Using cached search results for: "${query}"`);
        return this.cache.get(cacheKey);
    }
    
    const results = [];
    const terms = query.toLowerCase().split(' ');
    const queryLower = query.toLowerCase();
    
    console.log(`🔍 Searching knowledge base for: "${query}" (${this.documents.length} documents)`);
    
    for (const doc of this.documents) {
        const content = doc.content ? doc.content.toLowerCase() : '';
        let score = 0;
        let matchCount = 0;
        
        // Score by term matches
        for (const term of terms) {
            if (term.length < 2) continue;
            if (content.includes(term)) {
                score += 15;
                matchCount++;
            }
        }
        
        // High score for exact phrase match
        if (content.includes(queryLower)) {
            score += 80;
            matchCount++;
        }
        
        // Title matches (higher value)
        if (doc.title && doc.title.toLowerCase().includes(queryLower)) {
            score += 50;
        }
        
        // Boost document types
        if (doc.type === 'page') score += 30;
        if (doc.type === 'route' && content.includes('http')) score += 25;
        if (doc.type === 'database') score += 15;
        if (doc.type === 'code' && doc.subType === 'backend') score += 10;
        
        // Content length bonus
        if (score > 0) {
            const lengthBonus = Math.min(content.length / 1000, 5);
            score += lengthBonus;
            results.push({ ...doc, score, matchCount });
        }
    }
    
    results.sort((a, b) => b.score - a.score);
    
    // ✅ DEBUG: Show ALL top results with content info
    console.log('📊 Top 10 results with content:');
    results.slice(0, 10).forEach((r, index) => {
        const hasContent = r.content && r.content.length > 0;
        console.log(`  ${index + 1}. ${r.title || r.id}: score ${r.score}`);
        console.log(`     Content exists: ${hasContent ? '✅ YES' : '❌ NO'}`);
        console.log(`     Content length: ${r.content ? r.content.length : 0} chars`);
        if (hasContent && r.content) {
            const preview = r.content.substring(0, 100).replace(/\s+/g, ' ');
            console.log(`     Preview: ${preview}...`);
        }
        console.log('---');
    });
    
    const topResults = results.slice(0, 15);
    
    console.log(`✅ Found ${topResults.length} relevant results`);
    
    this.cache.set(cacheKey, topResults);
    
    if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
    }
    
    return topResults;
}
}

// ============================================================
// 2. INTENT DETECTION
// ============================================================

class IntentDetector {
    detect(message) {
        const lower = message.toLowerCase();
        
       const intents = [
            { name: 'balance', keywords: ['balance', 'wallet', 'bal', 'acct', 'how much', 'money', 'funds'] },
            { name: 'deposit', keywords: ['deposit', 'fund', 'add money', 'top up', 'load'] },
            { name: 'withdraw', keywords: ['withdraw', 'withdrawal', 'cash out', 'payout'] },
            { name: 'order', keywords: ['order', 'orders', 'delivery', 'track', 'shipping'] },
            { name: 'product', keywords: ['product', 'products', 'buy', 'price', 'cost', 'shop'] },
            { name: 'marketplace', keywords: ['marketplace', 'market', 'shop', 'store'] },
            { name: 'investment', keywords: ['invest', 'investment', 'investor', 'private'] },
            { name: 'savings', keywords: ['save', 'savings', 'saving', 'goal'] },
            { name: 'profile', keywords: ['profile', 'account', 'settings', 'update'] },
            { name: 'support', keywords: ['help', 'support', 'assistance', 'issue', 'problem'] },
            { name: 'graduation', keywords: ['graduate', 'graduation', 'progress'] },
            { name: 'referral', keywords: ['refer', 'referral', 'invite', 'share'] },
            { name: 'premium', keywords: ['premium', 'plan', 'upgrade', 'subscribe'] },
            { name: 'admin', keywords: ['admin', 'administrator', 'manage', 'control'] },
            { name: 'greeting', keywords: ['hello', 'hi', 'hey', 'good morning', 'good evening'] },
            { name: 'app', keywords: ['app', 'platform', 'thespark', 'about'] },
            { name: 'owner', keywords: ['owner', 'founder', 'who created', 'company'] },
        ];
        
        for (const intent of intents) {
            for (const keyword of intent.keywords) {
                if (lower.includes(keyword)) {
                    return { 
                        name: intent.name, 
                        confidence: 0.8,
                        matchedKeyword: keyword
                    };
                }
            }
        }
        
        return { name: 'general', confidence: 0.3 };
    }
}

// ============================================================
// 3. CONTEXT MEMORY
// ============================================================

class ContextMemory {
    constructor() {
        this.sessions = new Map();
    }

    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                messages: [],
                context: {},
                lastActivity: Date.now()
            });
        }
        return this.sessions.get(sessionId);
    }

    addMessage(sessionId, message, response) {
        const session = this.getSession(sessionId);
        session.messages.push({ message, response, timestamp: Date.now() });
        session.lastActivity = Date.now();
        
        if (session.messages.length > 10) {
            session.messages.shift();
        }
    }

    getContext(sessionId) {
        const session = this.getSession(sessionId);
        return {
            recentMessages: session.messages.slice(-5),
            context: session.context
        };
    }

    updateContext(sessionId, key, value) {
        const session = this.getSession(sessionId);
        session.context[key] = value;
    }
}

// ============================================================
// 4. RESPONSE GENERATOR - OPTIMIZED FOR FREE TIER
// ============================================================

class ResponseGenerator {
    constructor() {
        this.knowledgeBase = new KnowledgeBase();
        this.intentDetector = new IntentDetector();
        this.contextMemory = new ContextMemory();
        this.cache = new Map();
        this.firstInteraction = new Map(); // ✅ Track if user is new
        this.cacheTTL = 300000; 
    }

    async initialize() {
        await this.knowledgeBase.initialize();

                // ✅ Clear response cache on service start
        this.cache.clear();
        console.log('🗑️ Response cache cleared');

    }

    async generateResponse(userId, message, sessionId = null) {
    const lowerMessage = message.toLowerCase();
    const cacheKey = `${userId}-${message.trim()}`;
    
    // ✅ Check cache with expiry
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
        console.log('📦 Using cached response');
        return cached.data;
    }
    
    // ✅ Check for human handoff - only if user explicitly says "customer support"
    if (lowerMessage.includes('customer support') || lowerMessage.includes('customer support agent')) {
        const session = sessionId || `session-${userId}-${Date.now()}`;
        await this.createHandoffRequest(userId, message, { session: session });
        
        const response = {
            response: "👤 I'll connect you to a human agent who can assist you further. Please wait a moment.",
            needsHuman: true,
            session: session,
            intent: 'customer support',
            confidence: 1.0,
            searchResults: []
        };
        
        this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
        return response;
    }
    
  // ✅ CHECK RATE LIMIT - BLOCK REQUESTS BEFORE API CALL
if (!rateLimiter.canMakeRequest()) {
    const status = rateLimiter.getStatus();
    let responseMessage = "⏳ I'm currently processing other requests. ";
    
    // ✅ Better wait time calculation
    let waitTime = status.pauseRemaining || status.nextSlotAvailable || 5;
    const secondsRemaining = Math.ceil(waitTime / 1000);
    
    if (status.isPaused) {
        responseMessage += `Please wait ${secondsRemaining} seconds and try again.`;
    } else if (status.requestsThisMinute >= status.maxPerMinute) {
        responseMessage += `I've reached the request limit for this minute. Please wait ${secondsRemaining} seconds and try again.`;
    } else {
        responseMessage += "Please wait a moment and try again.";
    }
    
    console.log(`⏳ Rate limited - blocking request for ${secondsRemaining}s`);
    
    return {
        response: responseMessage,
        needsHuman: false,
        session: sessionId || `session-${userId}-${Date.now()}`,
        intent: 'queued',
        confidence: 1.0,
        searchResults: []
    };
}
    
    const session = sessionId || `session-${userId}-${Date.now()}`;
    
    // Track first interaction
    const isFirstInteraction = !this.firstInteraction.has(session);
    if (isFirstInteraction) {
        this.firstInteraction.set(session, true);
        this.contextMemory.updateContext(session, 'isNewUser', true);
    } else {
        this.contextMemory.updateContext(session, 'isNewUser', false);
    }
    
    const context = this.contextMemory.getContext(session);
    const intent = this.intentDetector.detect(message);
    const searchResults = this.knowledgeBase.search(message);
    const userData = await this.getUserData(userId);
    
    const prompt = this.buildPrompt(message, intent, searchResults, userData, context);
    
    let response;
    try {
        response = await this.callAI(prompt);
        rateLimiter.recordRequest();
        console.log(`✅ Request recorded. ${rateLimiter.requests.length}/${rateLimiter.maxRequestsPerMinute} used this minute`);
    } catch (error) {
        if (error.message.includes('429') || error.message.includes('Rate limit')) {
            rateLimiter.handleRateLimit();
            throw new Error('The AI service is currently busy. Please try again in a moment.');
        }
        throw error;
    }
    
    this.contextMemory.addMessage(session, message, response);
    
    // ✅ Intent-based handoff decision
    const needsHuman = this.shouldHandoff(message, intent, response);
    
    const result = {
        response,
        needsHuman,
        session,
        intent: intent.name,
        confidence: intent.confidence,
        searchResults: searchResults.slice(0, 5)
    };
    
    // ✅ Only cache if confidence is high and not a handoff
    if (intent.confidence >= 0.7 && !needsHuman) {
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    }
    
    if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
    }
    
    return result;
}

    // ============================================================
    // GET USER DATA - OPTIMIZED
    // ============================================================

    async getUserData(userId) {
    const userData = { 
        balance: 0, 
        name: 'User',
        email: '',
        role: 'user',
        collections: {},
        allData: {}  // ✅ Store ALL user data here
    };
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            
            // ✅ DYNAMIC: Copy EVERYTHING from the document
            for (const [key, value] of Object.entries(data)) {
                if (value && typeof value === 'object' && value.constructor.name === 'Timestamp') {
                    userData.allData[key] = value.toDate().toISOString();
                } else if (typeof value !== 'function') {
                    userData.allData[key] = value;
                }
            }
        }
    } catch (error) {
        console.log('⚠️ Could not fetch user data:', error.message);
    }
    
    // ✅ DYNAMIC: Get user collections automatically
    try {
        const collections = await db.listCollections();
        let collectionCount = 0;
        
        for (const collection of collections) {
            if (collection.id === 'users') continue;
            if (collectionCount >= 10) break;
            
            try {
                const snapshot = await collection
                    .where('userId', '==', userId)
                    .orderBy('createdAt', 'desc')
                    .limit(5)
                    .get();
                
                if (!snapshot.empty) {
                    const docs = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const cleanData = {};
                        for (const [key, value] of Object.entries(data)) {
                            if (value && typeof value === 'object' && value.constructor.name === 'Timestamp') {
                                cleanData[key] = value.toDate().toISOString();
                            } else if (typeof value !== 'function') {
                                cleanData[key] = value;
                            }
                        }
                        docs.push({ id: doc.id, ...cleanData });
                    });
                    
                    userData.collections[collection.id] = docs;
                    console.log(`✅ Found ${docs.length} docs in ${collection.id}`);
                    collectionCount++;
                }
            } catch (error) {
                console.log(`ℹ️ Could not query ${collection.id}:`, error.message);
            }
        }
    } catch (error) {
        console.log('⚠️ Error fetching user collections:', error.message);
    }
    
    return userData;
}

    // ============================================================
    // BUILD PROMPT - OPTIMIZED FOR FREE TIER
    // ============================================================


buildPrompt(message, intent, searchResults, userData, context) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const isNewUser = context?.context?.isNewUser || false;
    const userStatus = isNewUser ? 'NEW USER' : 'RETURNING USER';
    
    // ✅ RELEVANT CONTENT ONLY - Max 10,000 characters TOTAL
    const pageContent = searchResults.filter(r => r.type === 'page').slice(0, 5);
    let pageInfo = '';
    let totalChars = 0;
    const MAX_TOTAL_CHARS = 10000;

    if (pageContent.length > 0) {
        pageInfo = '📄 PAGE CONTENT:\n\n';
        
        for (const p of pageContent) {
            if (totalChars >= MAX_TOTAL_CHARS) break;
            
            const content = p.content || '';
            const queryWords = message.toLowerCase().split(' ').filter(w => w.length > 3);
            
            const paragraphs = content.split(/\n\s*\n|\.\s+/).filter(p => p.length > 20);
            
            const scoredParagraphs = paragraphs.map(para => {
                const lowerPara = para.toLowerCase();
                let score = 0;
                queryWords.forEach(word => {
                    if (lowerPara.includes(word)) score += 10;
                });
                const matchCount = queryWords.filter(w => lowerPara.includes(w)).length;
                if (matchCount >= 2) score += 20;
                return { text: para, score };
            });
            
            const relevant = scoredParagraphs.filter(s => s.score > 0);
            const paragraphsToSend = relevant.length > 0 
                ? relevant.sort((a, b) => b.score - a.score).slice(0, 4).map(s => s.text)
                : scoredParagraphs.sort((a, b) => b.score - a.score).slice(0, 2).map(s => s.text);
            
            const contentToAdd = paragraphsToSend.join('. ').substring(0, Math.min(2500, MAX_TOTAL_CHARS - totalChars));
            
            if (contentToAdd) {
                pageInfo += `=== ${p.title || 'Page'} ===\n${contentToAdd}\n\n`;
                totalChars += contentToAdd.length;
            }
        }
    }
    
    // Routes (keep small)
    const routesDoc = searchResults.find(r => r.id === 'frontend-routes');
    let routesInfo = '';
    if (routesDoc && routesDoc.content) {
        const allRoutes = routesDoc.content.split('\n').filter(line => line.trim());
        const relevantRoutes = allRoutes.filter(line => {
            const lineLower = line.toLowerCase();
            return message.toLowerCase().split(' ').some(t => t.length > 2 && lineLower.includes(t));
        });
        routesInfo = (relevantRoutes.length > 0 ? relevantRoutes.slice(0, 3) : allRoutes.slice(0, 3)).join('\n');
    }
    
    // ✅ 5 collections, 200 chars each
    let dbInfo = '';
    if (userData.collections && Object.keys(userData.collections).length > 0) {
        const collectionEntries = Object.entries(userData.collections).slice(0, 5);
        dbInfo = '📊 USER DATA:\n\n';
        for (const [collectionName, docs] of collectionEntries) {
            if (docs && docs.length > 0) {
                dbInfo += `=== ${collectionName} ===\n`;
                dbInfo += JSON.stringify(docs.slice(0, 2), null, 2).substring(0, 200);
                dbInfo += '\n\n';
            }
        }
    }

    // ✅ DYNAMIC: Build user info from ALL data (NO HARDCODED FIELD NAMES)
    let userInfo = '';
    
    // ✅ Include ALL user data fields dynamically
    for (const [key, value] of Object.entries(userData.allData || {})) {
        if (value === undefined || value === null || value === '') continue;
        
        // Format the key as a readable label
        const label = key
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .trim()
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
        userInfo += `- ${label}: ${value}\n`;
    }

    const userSection = userInfo ? `\n\nUSER DATA:\n${userInfo}` : '';

    return `You are TheSpark AI support assistant.

User Status: ${userStatus}
${isNewUser ? '- This is the user\'s FIRST message. Greet them warmly by name ONCE.' : '- This is a RETURNING user. Do NOT greet them by name. Use their name only when natural or asked.'}

${routesInfo ? 'LINKS:\n' + routesInfo + '\n\n' : ''}
${pageInfo || ''}
${dbInfo || ''}${userSection}

Q: ${message}

A:`;
}

    // ============================================================
    // CALL AI - OPTIMIZED FOR FREE TIER
    // ============================================================

async callAI(prompt) {
    if (!process.env.GROQ_API_KEY) {
        console.error('❌ GROQ_API_KEY is not set');
        throw new Error('GROQ_API_KEY is not configured');
    }

    try {
        console.log('📤 Sending request to Groq API...');
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                      { 
                            role: 'system', 
                             content: `You are a customer support assistant for TheSpark.
                                Platform URL: ${process.env.APP_URL || 'http://localhost:3000'}.
                                - For NEW users: Greet them warmly by name once.
                                - For RETURNING users: Use their name only when natural or asked.
                                - Don't repeat greetings in every response.
                                - Be professional, helpful, and friendly.
                                - Use relevant emojis naturally in your responses to make them engaging.
                                - Keep responses concise and clear.
                                - If you don't know the answer, say so honestly. DO NOT offer to connect to a human agent.
                                - Be precise with numbers - report them exactly as you see them.` 
                                
                        },
                    { 
                        role: 'user', 
                        content: prompt 
                    }
                ],
                temperature: 0.8,
                max_tokens: 400
            })
        });

        const responseText = await response.text();

        // ✅ If rate limited, fail gracefully (should not happen with rate limiter)
        if (response.status === 429) {
            console.log('⚠️ Rate limit reached.');
            throw new Error('The AI service is currently busy. Please wait a moment and try again.');
        }

        if (!response.ok) {
            console.error('❌ Groq API Error:', response.status);
            throw new Error(`Groq API Error (${response.status})`);
        }

        const data = JSON.parse(responseText);
        return data.choices[0].message.content;

    } catch (error) {
        console.error('❌ Groq API error:', error);
        throw error;
    }
}




shouldHandoff(message, intent, response) {
    const lower = message.toLowerCase();
    
    // ✅ Only explicit 'customer support' triggers handoff
    for (const trigger of SUPPORT_CONFIG.handoffTriggers) {
        if (lower.includes(trigger)) {
            return true;
        }
    }
    
    return false;
}

    // ============================================================
    // CREATE HANDOFF REQUEST
    // ============================================================

    async createHandoffRequest(userId, message, result) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : {};
            
            await db.collection('handoffRequests').add({
                userId,
                userName: userData.fullName || userData.name || 'User',
                userEmail: userData.email || '',
                message,
                session: result.session,
                status: 'pending',
                priority: 'normal',
                createdAt: new Date().toISOString()
            });
            
            console.log('✅ Handoff request created for user:', userId);
            
            const adminsSnapshot = await db.collection('users')
                .where('role', '==', 'admin')
                .get();
            
            adminsSnapshot.forEach(async (adminDoc) => {
                await db.collection('notifications').add({
                    userId: adminDoc.id,
                    title: '👤 New Support Handoff Request',
                    message: `${userData.fullName || 'A user'} needs human assistance`,
                    type: 'support_handoff',
                    data: { userId, session: result.session },
                    read: false,
                    createdAt: new Date().toISOString()
                });
            });
            
        } catch (error) {
            console.error('Error creating handoff request:', error);
            throw error;
        }
    }
}

// ============================================================
// 5. MAIN SERVICE
// ============================================================

class AISupportService {
    constructor() {
        this.responseGenerator = new ResponseGenerator();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        await this.responseGenerator.initialize();
        this.initialized = true;
        console.log('🚀 AI Support Service initialized (free tier optimized)');
    }

    async processMessage(userId, message, sessionId = null) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        try {
            const result = await this.responseGenerator.generateResponse(userId, message, sessionId);
            await this.logInteraction(userId, message, result);
            return result;
        } catch (error) {
            console.error('Error processing message:', error);
            return {
                response: "I'm having trouble processing your request right now. Please try again in a moment.",
                needsHuman: false,
                error: error.message
            };
        }
    }

    async logInteraction(userId, message, result) {
        try {
            await db.collection('supportInteractions').add({
                userId,
                message,
                response: result.response,
                intent: result.intent,
                confidence: result.confidence,
                needsHuman: result.needsHuman,
                session: result.session,
                createdAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error logging interaction:', error);
        }
    }
}

// ============================================================
// EXPORT
// ============================================================

let aiSupportService = null;

async function getAISupportService() {
    if (!aiSupportService) {
        aiSupportService = new AISupportService();
        await aiSupportService.initialize();
    }
    return aiSupportService;
}

module.exports = { getAISupportService, AISupportService };