// src/routes/ai.js
const express = require('express');
const router = express.Router();
const { getAISupportService } = require('../services/aiSupportService');
const { authenticate } = require('../middleware/auth');
const { db } = require('../services/firebase');
const admin = require('firebase-admin');
// ============================================================
// AI CHAT ENDPOINTS
// ============================================================

// Send message
router.post('/chat', authenticate, async (req, res) => {
    const { message, sessionId } = req.body;
    const userId = req.user.uid;
    
    if (!message || message.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Message is required'
        });
    }
    
    try {
        const service = await getAISupportService();
        const result = await service.processMessage(userId, message, sessionId);
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Service unavailable'
        });
    }
});


// Get session history - QUERY BY USER ID ONLY (Industry Standard)
router.get('/history/:sessionId', authenticate, async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user.uid;
    
    try {
        const snapshot = await db.collection('supportInteractions')
            .where('userId', '==', userId)  // ✅ REMOVED the session filter
            .orderBy('userId') 
            .orderBy('createdAt', 'asc')
            .get();
        
        const history = [];
        snapshot.forEach(doc => {
            history.push({ id: doc.id, ...doc.data() });
        });
        
        res.json(history);
        
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Get all sessions (admin only)
router.get('/sessions', authenticate, async (req, res) => {
    try {
        // Check if user is admin
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const snapshot = await db.collection('supportInteractions')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        const sessions = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!sessions[data.session]) {
                sessions[data.session] = {
                    session: data.session,
                    userId: data.userId,
                    messages: [],
                    createdAt: data.createdAt
                };
            }
            sessions[data.session].messages.push(data);
        });
        
        res.json(Object.values(sessions));
        
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});

// Get handoff requests (admin only)
router.get('/handoffs', authenticate, async (req, res) => {
    try {
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const snapshot = await db.collection('handoffRequests')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'asc')
            .get();
        
        const requests = [];
        snapshot.forEach(doc => {
            requests.push({ id: doc.id, ...doc.data() });
        });
        
        res.json(requests);
        
    } catch (error) {
        console.error('Error fetching handoffs:', error);
        res.status(500).json({ error: 'Failed to fetch handoffs' });
    }
});

// Claim handoff (admin only) - ORIGINAL
router.put('/handoffs/:handoffId/claim', authenticate, async (req, res) => {
    try {
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        await db.collection('handoffRequests').doc(req.params.handoffId).update({
            status: 'claimed',
            claimedBy: req.user.uid,
            claimedAt: new Date().toISOString()
        });
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error claiming handoff:', error);
        res.status(500).json({ error: 'Failed to claim handoff' });
    }
});

// Resolve handoff (admin only)
router.put('/handoffs/:handoffId/resolve', authenticate, async (req, res) => {
    try {
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        await db.collection('handoffRequests').doc(req.params.handoffId).update({
            status: 'resolved',
            resolvedBy: req.user.uid,
            resolvedAt: new Date().toISOString(),
            resolution: req.body.resolution || 'Resolved'
        });
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error resolving handoff:', error);
        res.status(500).json({ error: 'Failed to resolve handoff' });
    }
});

// Check human availability
router.get('/human-available', authenticate, async (req, res) => {
    try {
        const snapshot = await db.collection('users')
            .where('role', '==', 'admin')
            .where('isOnline', '==', true)
            .get();
        
        res.json({ available: snapshot.size > 0 });
    } catch (error) {
        res.json({ available: true });
    }
});

// src/routes/ai.js

/// Request human handoff - WITH AUTO-ASSIGN
router.post('/handoff', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { sessionId } = req.body;
    
    try {
        console.log(`📞 Handoff requested for user: ${userId}, session: ${sessionId}`);
        
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        
        // ✅ Step 1: Create handoff request
        const handoffData = {
            userId: userId,
            userEmail: userData.email || 'Unknown',
            userName: userData.fullName || userData.name || 'User',
            session: sessionId || 'unknown', // ✅ Use 'session' consistently
            sessionId: sessionId || 'unknown', // Keep for backward compatibility
            sessionIdAlt: sessionId ? sessionId.replace(/[^a-zA-Z0-9]/g, '') : 'unknown',
            sessionTimestamp: Date.now(),
            status: 'pending',
            priority: 'normal',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const handoffRef = await db.collection('handoffRequests').add(handoffData);
        console.log(`✅ Handoff created: ${handoffRef.id}`);
        
        // ✅ Step 2: Find an available agent
        const agentsSnapshot = await db.collection('users')
            .where('role', 'in', ['agent', 'admin'])
            .where('isOnline', '==', true)
            .limit(1)
            .get();
        
        let assignedAgentId = null;
        let assignedAgentName = null;
        
        if (!agentsSnapshot.empty) {
            const agentDoc = agentsSnapshot.docs[0];
            const agentData = agentDoc.data();
            assignedAgentId = agentDoc.id;
            assignedAgentName = agentData.fullName || agentData.name || 'Agent';
            
            // ✅ Create chat session
            const chatSession = {
                handoffId: handoffRef.id,
                userId: userId,
                agentId: assignedAgentId,
                agentName: assignedAgentName,
                userName: userData.fullName || 'User',
                status: 'active',
                messages: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            const chatRef = await db.collection('chatSessions').add(chatSession);
            const chatId = chatRef.id;
            
            // ✅ Update handoff with chat session ID
            await db.collection('handoffRequests').doc(handoffRef.id).update({
                status: 'claimed',
                claimedBy: assignedAgentId,
                claimedAt: new Date().toISOString(),
                chatSessionId: chatId  // ✅ Store the chat session ID
            });
            
            console.log(`✅ Chat session created: ${chatId} assigned to ${assignedAgentName}`);
            
            // ✅ Notify the user
            await db.collection('notifications').add({
                userId: userId,
                title: '👤 Agent Connected',
                message: `${assignedAgentName} has joined the chat.`,
                type: 'agent_connected',
                data: { 
                    sessionId: chatId, 
                    agentName: assignedAgentName,
                    handoffId: handoffRef.id
                },
                read: false,
            status: 'sent',
                createdAt: new Date().toISOString()
            });
            
            // ✅ Notify the agent
            await db.collection('notifications').add({
                userId: assignedAgentId,
                title: '💬 New Chat Assigned',
                message: `${userData.fullName || 'A user'} needs your assistance.`,
                type: 'chat_assigned',
                data: { 
                    sessionId: chatId, 
                    userId: userId,
                    handoffId: handoffRef.id
                },
                read: false,
            status: 'sent',
                createdAt: new Date().toISOString()
            });
            
            // ✅ Notify admins
            const adminsSnapshot = await db.collection('users')
                .where('role', '==', 'admin')
                .get();
            
            adminsSnapshot.forEach(async (adminDoc) => {
                await db.collection('notifications').add({
                    userId: adminDoc.id,
                    title: '👤 New Support Handoff',
                    message: `${userData.fullName || 'A user'} connected to ${assignedAgentName}`,
                    type: 'support_handoff',
                    data: { userId, sessionId, handoffId: handoffRef.id },
                    read: false,
            status: 'sent',
                    createdAt: new Date().toISOString()
                });
            });
            
            res.json({
                success: true,
                handoffId: handoffRef.id,
                sessionId: chatId,
                agentName: assignedAgentName,
                message: 'Human agent connected. You can now chat.',
                estimatedWaitTime: 'Connected instantly'
            });
            
        } else {
            // ✅ No agent available - keep it pending
            console.log('⏳ No agent available, handoff pending');
            
            // Notify admins that an agent is needed
            const adminsSnapshot = await db.collection('users')
                .where('role', '==', 'admin')
                .get();
            
            adminsSnapshot.forEach(async (adminDoc) => {
                await db.collection('notifications').add({
                    userId: adminDoc.id,
                    title: '👤 Agent Needed!',
                    message: `${userData.fullName || 'A user'} needs human assistance but no agent is online.`,
                    type: 'agent_needed',
                    data: { userId, sessionId, handoffId: handoffRef.id },
                    read: false,
            status: 'sent',
                    createdAt: new Date().toISOString()
                });
            });
            
            res.json({
                success: true,
                handoffId: handoffRef.id,
                message: 'No agents available. You will be connected shortly.',
                estimatedWaitTime: 'When an agent comes online'
            });
        }
        
    } catch (error) {
        console.error('❌ Error requesting handoff:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to connect to human agent'
        });
    }
});

// ============================================================
// ✅ FIXED: GET SESSION STATUS - Check chatSessions FIRST
// ============================================================
router.get('/session/:sessionId', authenticate, async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user.uid;
    
    try {
        console.log(`🔍 [SESSION] Checking: ${sessionId} for user: ${userId}`);
        
        // ✅ STEP 1: Check chatSessions collection FIRST (for new chat sessions)
        const sessionDoc = await db.collection('chatSessions').doc(sessionId).get();
        
        if (sessionDoc.exists) {
            const sessionData = sessionDoc.data();
            console.log(`✅ [SESSION] Found in chatSessions: ${sessionId}`);
            
            // Check if user is part of this chat
            if (sessionData.userId !== userId && sessionData.agentId !== userId) {
                console.log(`❌ [SESSION] Unauthorized`);
                return res.status(403).json({ error: 'Unauthorized' });
            }
            
            let agentName = 'Agent';
            if (sessionData.agentId) {
                try {
                    const agentDoc = await db.collection('users').doc(sessionData.agentId).get();
                    if (agentDoc.exists) {
                        agentName = agentDoc.data().fullName || agentDoc.data().name || 'Agent';
                    }
                } catch (error) {}
            }
            
            return res.json({
                success: true,
                sessionId: sessionDoc.id,
                userId: sessionData.userId,
                agentId: sessionData.agentId,
                agentName: agentName,
                status: sessionData.status || 'active',
                messages: sessionData.messages || [],
                handoffId: sessionData.handoffId || null
            });
        }
        
        // ✅ STEP 2: Check handoffRequests (backward compatible)
        console.log(`🔍 [SESSION] Not in chatSessions, checking handoffRequests...`);
        const handoffSnapshot = await db.collection('handoffRequests')
            .where('sessionId', '==', sessionId)
            .where('userId', '==', userId)
            .get();
        
        if (!handoffSnapshot.empty) {
            let handoffData = null;
            handoffSnapshot.forEach(doc => {
                handoffData = { id: doc.id, ...doc.data() };
            });
            
            console.log(`✅ [SESSION] Found in handoffRequests: ${handoffData.id}`);
            
            // Check if there's an active chat session for this handoff
            const chatSnapshot = await db.collection('chatSessions')
                .where('handoffId', '==', handoffData.id)
                .where('status', '==', 'active')
                .get();
            
            if (!chatSnapshot.empty) {
                let chatData = null;
                chatSnapshot.forEach(doc => {
                    chatData = { id: doc.id, ...doc.data() };
                });
                
                let agentName = 'Agent';
                if (chatData.agentId) {
                    try {
                        const agentDoc = await db.collection('users').doc(chatData.agentId).get();
                        if (agentDoc.exists) {
                            agentName = agentDoc.data().fullName || agentDoc.data().name || 'Agent';
                        }
                    } catch (error) {}
                }
                
                return res.json({
                    success: true,
                    sessionId: chatData.id,
                    agentName: agentName,
                    status: 'active',
                    handoffId: handoffData.id,
                    messages: chatData.messages || []
                });
            }
            
            return res.json({
                success: true,
                status: handoffData.status || 'pending',
                handoffId: handoffData.id,
                message: handoffData.status === 'claimed' ? 'Handoff claimed. Agent will connect shortly.' : 'Waiting for agent to claim...'
            });
        }
        
        // ✅ STEP 3: Try to find session by handoffId (final fallback)
        console.log(`🔍 [SESSION] Not found, trying handoffId fallback...`);
        const handoffByIdSnapshot = await db.collection('handoffRequests')
            .where('handoffId', '==', sessionId)
            .get();
        
        if (!handoffByIdSnapshot.empty) {
            let handoffData = null;
            handoffByIdSnapshot.forEach(doc => {
                handoffData = { id: doc.id, ...doc.data() };
            });
            
            return res.json({
                success: true,
                status: handoffData.status || 'unknown',
                handoffId: handoffData.id,
                message: `Handoff status: ${handoffData.status || 'unknown'}`
            });
        }
        
        console.log(`❌ [SESSION] Not found: ${sessionId}`);
        return res.status(404).json({ 
            success: false, 
            error: 'Session not found' 
        });
        
    } catch (error) {
        console.error('❌ [SESSION] Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to check session status: ' + error.message 
        });
    }
});

// ============================================================
// ✅ AGENT CHAT ENDPOINTS
// ============================================================

// Get pending handoff requests (agent/admin)
router.get('/handoffs/pending', authenticate, async (req, res) => {
    try {
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        if (!userDoc.exists) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const userData = userDoc.data();
        if (userData.role !== 'admin' && userData.role !== 'agent') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const snapshot = await db.collection('handoffRequests')
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'asc')
            .get();

        const requests = [];
        snapshot.forEach(doc => {
            requests.push({ id: doc.id, ...doc.data() });
        });

        res.json(requests);
    } catch (error) {
        console.error('Error fetching handoffs:', error);
        res.status(500).json({ error: 'Failed to fetch handoffs' });
    }
});


// Agent claims a handoff (creates chat session) - WITH AI HISTORY
router.put('/handoffs/:handoffId/claim-agent', authenticate, async (req, res) => {
    try {
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        if (!userDoc.exists) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const userData = userDoc.data();
        if (userData.role !== 'admin' && userData.role !== 'agent') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const handoffId = req.params.handoffId;
        const handoffDoc = await db.collection('handoffRequests').doc(handoffId).get();
        
        if (!handoffDoc.exists) {
            return res.status(404).json({ error: 'Handoff request not found' });
        }

        const handoffData = handoffDoc.data();
        const userId = handoffData.userId;
        
        // ✅ Try multiple possible field names for session
        const sessionFromHandoff = handoffData.session || handoffData.sessionId || null;

        console.log(`📤 Fetching AI chat history for user: ${userId}`);
        console.log(`📤 Session from handoff: ${sessionFromHandoff}`);
        console.log(`📤 UserName: ${handoffData.userName}`);

        let aiMessages = [];
        let aiHistoryFound = false;

        // ✅ STEP 1: Try to find AI history using the session from handoff
        if (sessionFromHandoff) {
            try {
                console.log(`🔍 Query 1: supportInteractions with userId: ${userId} AND session: "${sessionFromHandoff}"`);
                
                const aiHistorySnapshot = await db.collection('supportInteractions')
                    .where('userId', '==', userId)
                    .where('session', '==', sessionFromHandoff)
                    .orderBy('createdAt', 'asc')
                    .get();

                console.log(`📊 Query 1 result: ${aiHistorySnapshot.size} documents`);

                if (!aiHistorySnapshot.empty) {
                    aiHistoryFound = true;
                    aiHistorySnapshot.forEach(doc => {
                        const data = doc.data();
                        console.log(`📄 Found message:`, { 
                            id: data.id, 
                            message: data.message?.substring(0, 30), 
                            response: data.response?.substring(0, 30) 
                        });
                        // User message
                        aiMessages.push({
                            id: data.id || `ai-${Date.now()}-${aiMessages.length}`,
                            sender: 'user',
                            content: data.message || data.content || '',
                            timestamp: data.createdAt || new Date().toISOString(),
                            senderName: handoffData.userName || 'User',
                            senderId: userId,
                            isAgent: false,
                            isAI: true
                        });
                        
                        // AI response if it exists
                        if (data.response) {
                            aiMessages.push({
                                id: data.id ? `${data.id}-response` : `ai-resp-${Date.now()}-${aiMessages.length}`,
                                sender: 'ai',
                                content: data.response || '',
                                timestamp: data.createdAt || new Date().toISOString(),
                                senderName: 'AI Assistant',
                                senderId: 'ai-system',
                                isAgent: false,
                                isAI: true
                            });
                        }
                    });
                }
            } catch (error) {
                console.log('ℹ️ Error in Query 1:', error.message);
            }
        }

        // ✅ STEP 2: If no history found, try to find by userId only (get ALL history)
        if (!aiHistoryFound) {
            console.log('🔍 Query 2: Finding all supportInteractions for user (no session filter)');
            
            try {
                const allHistorySnapshot = await db.collection('supportInteractions')
                    .where('userId', '==', userId)
                    .orderBy('createdAt', 'asc')
                    .limit(100)
                    .get();

                console.log(`📊 Query 2 result: ${allHistorySnapshot.size} documents`);

                if (!allHistorySnapshot.empty) {
                    console.log(`✅ Found ${allHistorySnapshot.size} total support interactions for user`);
                    
                    // Log all sessions found
                    const sessionsFound = new Set();
                    allHistorySnapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.session) {
                            sessionsFound.add(data.session);
                        }
                    });
                    console.log(`📊 Sessions found in supportInteractions:`, Array.from(sessionsFound));
                    
                    // Use ALL interactions as AI history
                    let count = 0;
                    allHistorySnapshot.forEach(doc => {
                        if (count >= 50) return;
                        const data = doc.data();
                        
                        // User message
                        aiMessages.push({
                            id: data.id || `ai-${Date.now()}-${aiMessages.length}`,
                            sender: 'user',
                            content: data.message || data.content || '',
                            timestamp: data.createdAt || new Date().toISOString(),
                            senderName: handoffData.userName || 'User',
                            senderId: userId,
                            isAgent: false,
                            isAI: true
                        });
                        
                        // AI response if it exists
                        if (data.response) {
                            aiMessages.push({
                                id: data.id ? `${data.id}-response` : `ai-resp-${Date.now()}-${aiMessages.length}`,
                                sender: 'ai',
                                content: data.response || '',
                                timestamp: data.createdAt || new Date().toISOString(),
                                senderName: 'AI Assistant',
                                senderId: 'ai-system',
                                isAgent: false,
                                isAI: true
                            });
                        }
                        count++;
                    });
                    aiHistoryFound = true;
                    console.log(`✅ Using ${aiMessages.length} messages from user's history`);
                } else {
                    console.log('ℹ️ No support interactions found for this user');
                }
            } catch (error) {
                console.log('ℹ️ Error in Query 2:', error.message);
            }
        }

        // ✅ STEP 3: If still no history, try to find by userId and any session that contains the userId
        if (!aiHistoryFound && sessionFromHandoff) {
            console.log('🔍 Query 3: Trying to find by userId and session containing userId...');
            
            // Extract userId from session string
            const userIdMatch = sessionFromHandoff.match(/session-([^-]+)/);
            const extractedUserId = userIdMatch ? userIdMatch[1] : null;
            
            if (extractedUserId) {
                console.log(`🔍 Extracted userId from session: ${extractedUserId}`);
                
                try {
                    // Try to find interactions with session containing the userId
                    const allHistorySnapshot = await db.collection('supportInteractions')
                        .where('userId', '==', userId)
                        .orderBy('createdAt', 'asc')
                        .limit(100)
                        .get();

                    if (!allHistorySnapshot.empty) {
                        let count = 0;
                        allHistorySnapshot.forEach(doc => {
                            if (count >= 50) return;
                            const data = doc.data();
                            // User message
                            aiMessages.push({
                                id: data.id || `ai-${Date.now()}-${aiMessages.length}`,
                                sender: 'user',
                                content: data.message || data.content || '',
                                timestamp: data.createdAt || new Date().toISOString(),
                                senderName: handoffData.userName || 'User',
                                senderId: userId,
                                isAgent: false,
                                isAI: true
                            });
                            
                            // AI response if it exists
                            if (data.response) {
                                aiMessages.push({
                                    id: data.id ? `${data.id}-response` : `ai-resp-${Date.now()}-${aiMessages.length}`,
                                    sender: 'ai',
                                    content: data.response || '',
                                    timestamp: data.createdAt || new Date().toISOString(),
                                    senderName: 'AI Assistant',
                                    senderId: 'ai-system',
                                    isAgent: false,
                                    isAI: true
                                });
                            }
                            count++;
                        });
                        aiHistoryFound = true;
                        console.log(`✅ Found ${aiMessages.length} messages using userId extraction`);
                    }
                } catch (error) {
                    console.log('ℹ️ Error in Query 3:', error.message);
                }
            }
        }

        // ✅ STEP 4: Deduplicate messages by content and timestamp
        const uniqueMessages = [];
        const seen = new Set();
        for (const msg of aiMessages) {
            const key = `${msg.content}-${msg.timestamp}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueMessages.push(msg);
            }
        }

        console.log(`✅ Final: ${uniqueMessages.length} unique AI chat messages`);

        // ✅ STEP 5: Create chat session with AI history
        const chatSession = {
            handoffId: handoffId,
            userId: userId,
            agentId: req.user.uid,
            agentName: userData.fullName || 'Agent',
            userName: handoffData.userName || 'User',
            status: 'active',
            messages: uniqueMessages,
            aiHistory: uniqueMessages,
            aiHistoryCount: uniqueMessages.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const chatRef = await db.collection('chatSessions').add(chatSession);
        const chatId = chatRef.id;

        // ✅ STEP 6: Update handoff with chat session ID
        await db.collection('handoffRequests').doc(handoffId).update({
            status: 'claimed',
            claimedBy: req.user.uid,
            claimedByEmail: userData.email || 'Agent',
            claimedAt: new Date().toISOString(),
            chatSessionId: chatId,
            aiHistoryIncluded: true,
            aiMessageCount: uniqueMessages.length
        });

        // ✅ STEP 7: Notify the user
        await db.collection('notifications').add({
            userId: userId,
            title: '👤 Agent Connected',
            message: `${userData.fullName || 'An agent'} has joined the chat. They can see your previous conversation.`,
            type: 'agent_connected',
            data: { sessionId: chatId, agentName: userData.fullName || 'Agent' },
            read: false,
            status: 'sent',
            createdAt: new Date().toISOString()
        });

        console.log(`✅ Chat session created with ${uniqueMessages.length} AI history messages`);

        res.json({
            success: true,
            sessionId: chatId,
            agentName: userData.fullName || 'Agent',
            message: 'Handoff claimed. Chat session started with AI history.',
            aiMessageCount: uniqueMessages.length
        });
        
    } catch (error) {
        console.error('Error claiming handoff:', error);
        res.status(500).json({ error: 'Failed to claim handoff: ' + error.message });
    }
});

// src/routes/ai.js - Update the /chat/:sessionId/message endpoint
// src/routes/ai.js - Update the /chat/:sessionId/message endpoint

router.post('/chat/:sessionId/message', authenticate, async (req, res) => {
    const { sessionId } = req.params;
    const { message } = req.body;
    const userId = req.user.uid;

    if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        console.log(`📤 Sending message to session: ${sessionId} from user: ${userId}`);
        
        const sessionDoc = await db.collection('chatSessions').doc(sessionId).get();
        if (!sessionDoc.exists) {
            console.log(`❌ Session not found: ${sessionId}`);
            return res.status(404).json({ error: 'Chat session not found' });
        }

        const sessionData = sessionDoc.data();
        console.log(`📋 Session data:`, { 
            userId: sessionData.userId, 
            agentId: sessionData.agentId,
            status: sessionData.status 
        });
        
        // ✅ Check if user is the agent OR the user
        const isAgent = sessionData.agentId === userId;
        const isUser = sessionData.userId === userId;
        
        if (!isAgent && !isUser) {
            console.log(`❌ Unauthorized: User ${userId} not in session ${sessionId}`);
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};

        // ✅ CRITICAL: Set sender based on who is sending the message
        let senderType = 'user';
        let senderName = userData.fullName || 'User';
        
        if (isAgent) {
            senderType = 'agent';
            senderName = userData.fullName || 'Agent';
        }

        const newMessage = {
            id: Date.now().toString(),
            senderId: userId,
            senderName: senderName,
            isAgent: isAgent,
            sender: senderType, // ✅ 'agent' or 'user'
            content: message.trim(),
            timestamp: new Date().toISOString(),
            read: false
        };

        console.log('📤 Saving message:', {
            sender: newMessage.sender,
            isAgent: newMessage.isAgent,
            senderName: newMessage.senderName,
            content: newMessage.content
        });

        await db.collection('chatSessions').doc(sessionId).update({
            messages: admin.firestore.FieldValue.arrayUnion(newMessage),
            updatedAt: new Date().toISOString()
        });

        // Send notification to the other party
        const recipientId = isAgent ? sessionData.userId : sessionData.agentId;
        if (recipientId) {
            await db.collection('notifications').add({
                userId: recipientId,
                title: isAgent ? '💬 Agent Response' : '💬 New Message',
                message: `${newMessage.senderName}: ${message.trim().substring(0, 50)}${message.length > 50 ? '...' : ''}`,
                type: 'chat_message',
                data: { sessionId, messageId: newMessage.id },
                read: false,
            status: 'sent',
                createdAt: new Date().toISOString()
            });
        }

        console.log(`✅ Message sent successfully`);
        res.json({
            success: true,
            message: newMessage
        });
    } catch (error) {
        console.error('❌ Error sending chat message:', error);
        res.status(500).json({ 
            error: 'Failed to send message: ' + error.message 
        });
    }
});

// Get chat history for a session
router.get('/chat/:sessionId/history', authenticate, async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user.uid;

    try {
        const sessionDoc = await db.collection('chatSessions').doc(sessionId).get();
        if (!sessionDoc.exists) {
            return res.status(404).json({ error: 'Chat session not found' });
        }

        const sessionData = sessionDoc.data();
        
        if (sessionData.userId !== userId && sessionData.agentId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const messages = sessionData.messages || [];
        const updatedMessages = messages.map(msg => {
            if (msg.senderId !== userId && !msg.read) {
                return { ...msg, read: true, readAt: new Date().toISOString() };
            }
            return msg;
        });

        await db.collection('chatSessions').doc(sessionId).update({
            messages: updatedMessages
        });

        res.json({
            success: true,
            messages: updatedMessages,
            session: sessionData
        });
    } catch (error) {
        console.error('Error getting chat history:', error);
        res.status(500).json({ error: 'Failed to get chat history' });
    }
});

// Get agent's active chat sessions
router.get('/sessions/active', authenticate, async (req, res) => {
    try {
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        if (!userDoc.exists) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const userData = userDoc.data();
        if (userData.role !== 'admin' && userData.role !== 'agent') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const snapshot = await db.collection('chatSessions')
            .where('agentId', '==', req.user.uid)
            .where('status', '==', 'active')
            .orderBy('updatedAt', 'desc')
            .get();

        const sessions = [];
        snapshot.forEach(doc => {
            sessions.push({ id: doc.id, ...doc.data() });
        });

        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});


router.put('/chat/:sessionId/resolve', authenticate, async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user.uid;

    try {
        const sessionDoc = await db.collection('chatSessions').doc(sessionId).get();
        if (!sessionDoc.exists) {
            return res.status(404).json({ error: 'Chat session not found' });
        }

        const sessionData = sessionDoc.data();
        
        if (sessionData.agentId !== userId) {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists || userDoc.data().role !== 'admin') {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }

        // ✅ Create resolution message
        const resolvedMessage = {
            id: `resolved-${Date.now()}`,
            sender: 'ai',
            content: '✅ This conversation has been resolved. Thank you for contacting us!',
            timestamp: new Date().toISOString(),
            isResolved: true
        };

        // ✅ Create rating prompt message (Industry Standard)
        const ratingMessage = {
            id: `rating-${Date.now()}`,
            sender: 'ai',
            content: '📊 How was your experience with our support?',
            timestamp: new Date().toISOString(),
            isRatingPrompt: true
        };

        // ✅ Add messages to Firestore
        await db.collection('chatSessions').doc(sessionId).update({
            status: 'resolved',
            resolvedAt: new Date().toISOString(),
            resolvedBy: userId,
            messages: admin.firestore.FieldValue.arrayUnion(resolvedMessage, ratingMessage)
        });

        // ✅ Update handoffRequests
        const handoffSnapshot = await db.collection('handoffRequests')
            .where('chatSessionId', '==', sessionId)
            .get();
        
        handoffSnapshot.forEach(doc => {
            db.collection('handoffRequests').doc(doc.id).update({
                status: 'resolved',
                resolvedAt: new Date().toISOString(),
                resolvedBy: userId
            });
        });

        // ✅ Send notification to user
        await db.collection('notifications').add({
            userId: sessionData.userId,
            title: '✅ Chat Resolved',
            message: 'Your chat session has been resolved. Please rate your experience!',
            type: 'chat_resolved',
            data: { sessionId },
            read: false,
            status: 'sent',
            createdAt: new Date().toISOString()
        });

        res.json({ success: true, message: 'Chat resolved' });
    } catch (error) {
        console.error('Error resolving chat:', error);
        res.status(500).json({ error: 'Failed to resolve chat' });
    }
});


// ✅ Save rating endpoint
router.post('/chat/:sessionId/rating', authenticate, async (req, res) => {
    const { sessionId } = req.params;
    const { rating, userId } = req.body;
    
    try {
        // ✅ Save rating to chat session
        await db.collection('chatSessions').doc(sessionId).update({
            rating: rating,
            ratingAt: new Date().toISOString(),
            ratedBy: userId
        });
        
        // ✅ Save to analytics collection
        await db.collection('ratings').add({
            sessionId: sessionId,
            userId: userId,
            rating: rating,
            createdAt: new Date().toISOString()
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving rating:', error);
        res.status(500).json({ error: 'Failed to save rating' });
    }
});

module.exports = router;