// const express = require('express');
// const { db } = require('../services/firebase');
// const { authenticate, isAdmin } = require('../middleware/auth');

// const router = express.Router();

// // Get all approved stories (public) - NO orderBy to avoid index
// router.get('/', async (req, res) => {
//     try {
//         const storiesSnapshot = await db.collection('successStories')
//             .where('status', '==', 'approved')
//             .get();
        
//         const stories = [];
//         storiesSnapshot.forEach(doc => {
//             stories.push({ id: doc.id, ...doc.data() });
//         });
        
//         // Sort manually by createdAt (newest first) - NO index needed
//         stories.sort((a, b) => {
//             const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
//             const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
//             return dateB - dateA;
//         });
        
//         // Limit to 20
//         res.json(stories.slice(0, 20));
//     } catch (error) {
//         console.error('Error fetching stories:', error);
//         res.status(500).json({ error: 'Failed to fetch stories' });
//     }
// });

// // Get user's own story (authenticated)
// router.get('/my-story', authenticate, async (req, res) => {
//     const userId = req.user.uid;
    
//     try {
//         const storySnapshot = await db.collection('successStories')
//             .where('userId', '==', userId)
//             .where('status', 'in', ['pending', 'approved'])
//             .get();
        
//         if (storySnapshot.empty) {
//             return res.json({ story: null });
//         }
        
//         const storyDoc = storySnapshot.docs[0];
//         res.json({ story: { id: storyDoc.id, ...storyDoc.data() } });
//     } catch (error) {
//         console.error('Error fetching user story:', error);
//         res.status(500).json({ error: 'Failed to fetch story' });
//     }
// });

// // Submit a new story (authenticated)
// router.post('/submit', authenticate, async (req, res) => {
//     const userId = req.user.uid;
//     const { story } = req.body;
    
//     if (!story || story.trim().length < 20) {
//         return res.status(400).json({ error: 'Story must be at least 20 characters' });
//     }
    
//     try {
//         // Check if user already has a story
//         const existingStory = await db.collection('successStories')
//             .where('userId', '==', userId)
//             .where('status', 'in', ['pending', 'approved'])
//             .get();
        
//         if (!existingStory.empty) {
//             return res.status(400).json({ error: 'You already have a story. Edit it instead.' });
//         }
        
//         // Get user data
//         const userDoc = await db.collection('users').doc(userId).get();
//         const userData = userDoc.data();
        
//         const newStory = {
//             userId,
//             name: userData.fullName,
//             story: story.trim(),
//             saved: userData.totalPrincipalSaved || 0,
//             interest: userData.totalInterestEarned || 0,
//             total: userData.currentBalance || 0,
//             status: 'pending',
//             createdAt: new Date(),
//             updatedAt: new Date()
//         };
        
//         const storyRef = await db.collection('successStories').add(newStory);
        
//         res.json({ 
//             success: true, 
//             storyId: storyRef.id,
//             message: 'Story submitted for admin approval' 
//         });
//     } catch (error) {
//         console.error('Error submitting story:', error);
//         res.status(500).json({ error: 'Failed to submit story' });
//     }
// });

// // Update a story (authenticated - user's own story)
// router.put('/update/:storyId', authenticate, async (req, res) => {
//     const userId = req.user.uid;
//     const { storyId } = req.params;
//     const { story } = req.body;
    
//     if (!story || story.trim().length < 20) {
//         return res.status(400).json({ error: 'Story must be at least 20 characters' });
//     }
    
//     try {
//         const storyRef = db.collection('successStories').doc(storyId);
//         const storyDoc = await storyRef.get();
        
//         if (!storyDoc.exists) {
//             return res.status(404).json({ error: 'Story not found' });
//         }
        
//         const storyData = storyDoc.data();
//         if (storyData.userId !== userId) {
//             return res.status(403).json({ error: 'You can only edit your own story' });
//         }
        
//         await storyRef.update({
//             story: story.trim(),
//             status: 'pending',
//             updatedAt: new Date()
//         });
        
//         res.json({ success: true, message: 'Story updated and resubmitted for approval' });
//     } catch (error) {
//         console.error('Error updating story:', error);
//         res.status(500).json({ error: 'Failed to update story' });
//     }
// });

// // Delete a story (authenticated - user's own story)
// router.delete('/delete/:storyId', authenticate, async (req, res) => {
//     const userId = req.user.uid;
//     const { storyId } = req.params;
    
//     try {
//         const storyRef = db.collection('successStories').doc(storyId);
//         const storyDoc = await storyRef.get();
        
//         if (!storyDoc.exists) {
//             return res.status(404).json({ error: 'Story not found' });
//         }
        
//         const storyData = storyDoc.data();
//         if (storyData.userId !== userId) {
//             return res.status(403).json({ error: 'You can only delete your own story' });
//         }
        
//         await storyRef.delete();
        
//         res.json({ success: true, message: 'Story deleted' });
//     } catch (error) {
//         console.error('Error deleting story:', error);
//         res.status(500).json({ error: 'Failed to delete story' });
//     }
// });

// // Admin: Get all pending stories (NO orderBy)
// router.get('/admin/pending', authenticate, isAdmin, async (req, res) => {
//     try {
//         const storiesSnapshot = await db.collection('successStories')
//             .where('status', '==', 'pending')
//             .get();
        
//         const stories = [];
//         storiesSnapshot.forEach(doc => {
//             stories.push({ id: doc.id, ...doc.data() });
//         });
        
//         // Sort manually by createdAt (oldest first) for admin review
//         stories.sort((a, b) => {
//             const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
//             const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
//             return dateA - dateB;
//         });
        
//         res.json(stories);
//     } catch (error) {
//         console.error('Error fetching pending stories:', error);
//         res.status(500).json({ error: 'Failed to fetch pending stories' });
//     }
// });

// // Admin: Approve a story
// router.post('/admin/approve/:storyId', authenticate, isAdmin, async (req, res) => {
//     const { storyId } = req.params;
    
//     try {
//         const storyRef = db.collection('successStories').doc(storyId);
//         await storyRef.update({
//             status: 'approved',
//             approvedAt: new Date(),
//             approvedBy: req.user.uid
//         });
        
//         res.json({ success: true, message: 'Story approved' });
//     } catch (error) {
//         console.error('Error approving story:', error);
//         res.status(500).json({ error: 'Failed to approve story' });
//     }
// });

// // Admin: Reject a story
// router.post('/admin/reject/:storyId', authenticate, isAdmin, async (req, res) => {
//     const { storyId } = req.params;
    
//     try {
//         const storyRef = db.collection('successStories').doc(storyId);
//         await storyRef.update({
//             status: 'rejected',
//             rejectedAt: new Date(),
//             rejectedBy: req.user.uid
//         });
        
//         res.json({ success: true, message: 'Story rejected' });
//     } catch (error) {
//         console.error('Error rejecting story:', error);
//         res.status(500).json({ error: 'Failed to reject story' });
//     }
// });

// module.exports = router;



const express = require('express');
const { db } = require('../services/firebase');
const { authenticate, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Helper function to calculate badge based on savings
function calculateBadge(savedAmount) {
    if (savedAmount >= 500000) return { text: 'Platinum Saver', icon: '💎', level: 6 };
    if (savedAmount >= 250000) return { text: 'Gold Saver', icon: '🥇', level: 5 };
    if (savedAmount >= 100000) return { text: 'Silver Saver', icon: '🥈', level: 4 };
    if (savedAmount >= 50000) return { text: 'Bronze Saver', icon: '🥉', level: 3 };
    if (savedAmount >= 25000) return { text: 'Rising Star', icon: '⭐', level: 2 };
    return { text: 'Verified Saver', icon: '✓', level: 1 };
}

// Get all approved stories (public)
router.get('/', async (req, res) => {
    try {
        const storiesSnapshot = await db.collection('successStories')
            .where('status', '==', 'approved')
            .get();
        
        const stories = [];
        storiesSnapshot.forEach(doc => {
            stories.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort manually by createdAt (newest first)
        stories.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        res.json(stories.slice(0, 20));
    } catch (error) {
        console.error('Error fetching stories:', error);
        res.status(500).json({ error: 'Failed to fetch stories' });
    }
});

// Get user's own story (authenticated)
router.get('/my-story', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    try {
        const storySnapshot = await db.collection('successStories')
            .where('userId', '==', userId)
            .where('status', 'in', ['pending', 'approved'])
            .get();
        
        if (storySnapshot.empty) {
            return res.json({ story: null });
        }
        
        const storyDoc = storySnapshot.docs[0];
        res.json({ story: { id: storyDoc.id, ...storyDoc.data() } });
    } catch (error) {
        console.error('Error fetching user story:', error);
        res.status(500).json({ error: 'Failed to fetch story' });
    }
});

// Submit a new story (authenticated)
router.post('/submit', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { story, rating } = req.body;
    
    if (!story || story.trim().length < 20) {
        return res.status(400).json({ error: 'Story must be at least 20 characters' });
    }
    
    // Validate rating (1-5, defaults to 5)
    const userRating = rating && rating >= 1 && rating <= 5 ? rating : 5;
    
    try {
        // Check if user already has a story
        const existingStory = await db.collection('successStories')
            .where('userId', '==', userId)
            .where('status', 'in', ['pending', 'approved'])
            .get();
        
        if (!existingStory.empty) {
            return res.status(400).json({ error: 'You already have a story. Edit it instead.' });
        }
        
        // Get user data
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        // Calculate badge based on savings
        const savedAmount = userData.totalPrincipalSaved || 0;
        const badge = calculateBadge(savedAmount);
        
        const newStory = {
            userId,
            name: userData.fullName,
            story: story.trim(),
            saved: userData.totalPrincipalSaved || 0,
            interest: userData.totalInterestEarned || 0,
            total: userData.currentBalance || 0,
            rating: userRating,
            badgeText: badge.text,
            badgeIcon: badge.icon,
            badgeLevel: badge.level,
            currentCycle: userData.currentCycle || 1,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const storyRef = await db.collection('successStories').add(newStory);
        
        res.json({ 
            success: true, 
            storyId: storyRef.id,
            message: 'Story submitted for admin approval' 
        });
    } catch (error) {
        console.error('Error submitting story:', error);
        res.status(500).json({ error: 'Failed to submit story' });
    }
});

// Update a story (authenticated - user's own story)
router.put('/update/:storyId', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { storyId } = req.params;
    const { story, rating } = req.body;
    
    if (!story || story.trim().length < 20) {
        return res.status(400).json({ error: 'Story must be at least 20 characters' });
    }
    
    const userRating = rating && rating >= 1 && rating <= 5 ? rating : 5;
    
    try {
        const storyRef = db.collection('successStories').doc(storyId);
        const storyDoc = await storyRef.get();
        
        if (!storyDoc.exists) {
            return res.status(404).json({ error: 'Story not found' });
        }
        
        const storyData = storyDoc.data();
        if (storyData.userId !== userId) {
            return res.status(403).json({ error: 'You can only edit your own story' });
        }
        
        // Get latest user data to update badge if savings changed
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        const savedAmount = userData.totalPrincipalSaved || 0;
        const badge = calculateBadge(savedAmount);
        
        await storyRef.update({
            story: story.trim(),
            rating: userRating,
            saved: userData.totalPrincipalSaved || 0,
            interest: userData.totalInterestEarned || 0,
            total: userData.currentBalance || 0,
            badgeText: badge.text,
            badgeIcon: badge.icon,
            badgeLevel: badge.level,
            status: 'pending',
            updatedAt: new Date()
        });
        
        res.json({ success: true, message: 'Story updated and resubmitted for approval' });
    } catch (error) {
        console.error('Error updating story:', error);
        res.status(500).json({ error: 'Failed to update story' });
    }
});

// Delete a story (authenticated - user's own story)
router.delete('/delete/:storyId', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { storyId } = req.params;
    
    try {
        const storyRef = db.collection('successStories').doc(storyId);
        const storyDoc = await storyRef.get();
        
        if (!storyDoc.exists) {
            return res.status(404).json({ error: 'Story not found' });
        }
        
        const storyData = storyDoc.data();
        if (storyData.userId !== userId) {
            return res.status(403).json({ error: 'You can only delete your own story' });
        }
        
        await storyRef.delete();
        
        res.json({ success: true, message: 'Story deleted' });
    } catch (error) {
        console.error('Error deleting story:', error);
        res.status(500).json({ error: 'Failed to delete story' });
    }
});

// Admin: Get all pending stories
router.get('/admin/pending', authenticate, isAdmin, async (req, res) => {
    try {
        const storiesSnapshot = await db.collection('successStories')
            .where('status', '==', 'pending')
            .get();
        
        const stories = [];
        storiesSnapshot.forEach(doc => {
            stories.push({ id: doc.id, ...doc.data() });
        });
        
        stories.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateA - dateB;
        });
        
        res.json(stories);
    } catch (error) {
        console.error('Error fetching pending stories:', error);
        res.status(500).json({ error: 'Failed to fetch pending stories' });
    }
});

// Admin: Approve a story
router.post('/admin/approve/:storyId', authenticate, isAdmin, async (req, res) => {
    const { storyId } = req.params;
    const { rating } = req.body;
    
    try {
        const storyRef = db.collection('successStories').doc(storyId);
        const updateData = {
            status: 'approved',
            approvedAt: new Date(),
            approvedBy: req.user.uid
        };
        
        if (rating && rating >= 1 && rating <= 5) {
            updateData.rating = rating;
        }
        
        await storyRef.update(updateData);
        
        res.json({ success: true, message: 'Story approved' });
    } catch (error) {
        console.error('Error approving story:', error);
        res.status(500).json({ error: 'Failed to approve story' });
    }
});

// Admin: Reject a story
router.post('/admin/reject/:storyId', authenticate, isAdmin, async (req, res) => {
    const { storyId } = req.params;
    
    try {
        await db.collection('successStories').doc(storyId).update({
            status: 'rejected',
            rejectedAt: new Date(),
            rejectedBy: req.user.uid
        });
        
        res.json({ success: true, message: 'Story rejected' });
    } catch (error) {
        console.error('Error rejecting story:', error);
        res.status(500).json({ error: 'Failed to reject story' });
    }
});

module.exports = router;