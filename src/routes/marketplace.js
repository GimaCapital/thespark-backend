// // src/routes/marketplace.js
const express = require('express');
const { db } = require('../services/firebase');
const admin = require('firebase-admin');
const { authenticate, isAdmin } = require('../middleware/auth');
const router = express.Router();

// ============ HELPER FUNCTIONS ============

// Generate unique order ID
const generateOrderId = () => {
    const prefix = 'ORD';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
};

// Get order status based on tracking progress
const getOrderStatus = (tracking) => {
    if (!tracking || tracking.length === 0) return 'pending';
    const completed = tracking.filter(t => t.completed).length;
    const total = tracking.length;
    if (completed === total) return 'delivered';
    if (completed >= total - 2) return 'out_for_delivery';
    if (completed >= total - 3) return 'dispatched';
    if (completed > 0) return 'processing';
    return 'pending';
};

// Create notification
const createNotification = async (userId, title, message, type, data = {}) => {
    try {
        await db.collection('notifications').add({
            userId: userId,
            title: title,
            message: message,
            type: type,
            read: false,
            data: data,
            createdAt: new Date().toISOString()
        });
        console.log(`📢 Notification sent to ${userId}: ${title}`);
        return true;
    } catch (error) {
        console.error('Failed to send notification:', error);
        return false;
    }
};

// ============ PRODUCT ROUTES ============

// Get all approved products (public)
router.get('/products', async (req, res) => {
    try {
        const snapshot = await db.collection('marketplace_products')
            .where('status', '==', 'approved')
            .get();
        
        const products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        
        products.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get user's own products
router.get('/my-products', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    try {
        const snapshot = await db.collection('marketplace_products')
            .where('userId', '==', userId)
            .get();
        
        const products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        
        products.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        res.json(products);
    } catch (error) {
        console.error('Error fetching user products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// Get single product
router.get('/products/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const doc = await db.collection('marketplace_products').doc(productId).get();
        
        if (!doc.exists) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const product = doc.data();
        if (product.status !== 'approved') {
            return res.status(403).json({ error: 'Product not available' });
        }
        
        res.json({ id: doc.id, ...product });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Submit a product for approval
router.post('/products/submit', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { name, category, originalPrice, discountPrice, description, unit, stock, image } = req.body;
    
    if (!name || name.trim().length < 3) {
        return res.status(400).json({ error: 'Product name must be at least 3 characters' });
    }
    if (!category) {
        return res.status(400).json({ error: 'Category is required' });
    }
    if (!originalPrice || originalPrice < 100) {
        return res.status(400).json({ error: 'Original price must be at least ₦100' });
    }
    if (!discountPrice || discountPrice < 100) {
        return res.status(400).json({ error: 'Discount price must be at least ₦100' });
    }
    if (discountPrice >= originalPrice) {
        return res.status(400).json({ error: 'Discount price must be less than original price' });
    }
    if (!description || description.trim().length < 10) {
        return res.status(400).json({ error: 'Description must be at least 10 characters' });
    }
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userData = userDoc.data();
        
        const discount = Math.round(((originalPrice - discountPrice) / originalPrice) * 100);
        
        const newProduct = {
            userId: userId,
            sellerId: userId, // ✅ ADDED: Explicitly set sellerId
            name: name.trim(),
            category: category,
            originalPrice: originalPrice,
            discountPrice: discountPrice,
            discount: discount,
            image: image || '📦',
            description: description.trim(),
            unit: unit || 'unit',
            stock: stock || 0,
            status: 'pending',
            sellerName: userData.fullName || 'Unknown Seller',
            sellerEmail: userData.email || '',
            sellerPhone: userData.phone || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const docRef = await db.collection('marketplace_products').add(newProduct);
        
        const adminsSnapshot = await db.collection('users')
            .where('role', '==', 'admin')
            .get();
        
        adminsSnapshot.forEach(async (adminDoc) => {
            await createNotification(
                adminDoc.id,
                '📦 New Product Pending Approval',
                `${userData.fullName || 'A user'} submitted "${name}" for approval`,
                'product_submitted',
                { productId: docRef.id, sellerId: userId }
            );
        });
        
        res.json({ 
            success: true, 
            productId: docRef.id,
            message: 'Product submitted for admin approval' 
        });
    } catch (error) {
        console.error('Error submitting product:', error);
        res.status(500).json({ error: 'Failed to submit product' });
    }
});

// Update product
router.put('/products/update/:productId', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { productId } = req.params;
    const { name, category, originalPrice, discountPrice, description, unit, stock, image, imageSource } = req.body;
    
    try {
        const productRef = db.collection('marketplace_products').doc(productId);
        const productDoc = await productRef.get();
        
        if (!productDoc.exists) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const productData = productDoc.data();
        
        if (productData.userId !== userId) {
            return res.status(403).json({ error: 'You can only edit your own products' });
        }
        
        if (productData.status === 'approved') {
            return res.status(400).json({ error: 'Cannot edit approved products. Please contact admin.' });
        }
        
        const discount = Math.round(((originalPrice - discountPrice) / originalPrice) * 100);
        
        await productRef.update({
            name: name.trim(),
            category: category,
            originalPrice: originalPrice,
            discountPrice: discountPrice,
            discount: discount,
            image: image || '📦',
            imageSource: imageSource || null,
            description: description.trim(),
            unit: unit || 'unit',
            stock: stock || 0,
            status: 'pending',
            sellerId: userId, // ✅ ADDED: Preserve sellerId on update
            updatedAt: new Date().toISOString(),
            resubmittedAt: new Date().toISOString(),
            rejectionReason: null
        });
        
        const adminsSnapshot = await db.collection('users')
            .where('role', '==', 'admin')
            .get();
        
        const notificationPromises = [];
        adminsSnapshot.forEach(async (adminDoc) => {
            const promise = createNotification(
                adminDoc.id,
                '🔄 Product Resubmitted',
                `${productData.sellerName || 'A user'} resubmitted "${name}" for approval after ${productData.status === 'rejected' ? 'rejection' : 'update'}`,
                'product_resubmitted',
                { 
                    productId: productId,
                    previousStatus: productData.status,
                    sellerId: userId
                }
            );
            notificationPromises.push(promise);
        });
        
        await Promise.all(notificationPromises);
        
        await db.collection('productActivityLogs').add({
            productId: productId,
            userId: userId,
            action: 'resubmitted',
            previousStatus: productData.status,
            newStatus: 'pending',
            timestamp: new Date().toISOString(),
            details: {
                name: name.trim(),
                category: category,
                originalPrice: originalPrice,
                discountPrice: discountPrice
            }
        });
        
        res.json({ 
            success: true, 
            message: 'Product updated and resubmitted for approval',
            status: 'pending'
        });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete product
router.delete('/products/delete/:productId', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { productId } = req.params;
    
    try {
        const productRef = db.collection('marketplace_products').doc(productId);
        const productDoc = await productRef.get();
        
        if (!productDoc.exists) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const productData = productDoc.data();
        if (productData.userId !== userId) {
            return res.status(403).json({ error: 'You can only delete your own products' });
        }
        
        await productRef.delete();
        res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// ============ ADMIN PRODUCT ROUTES ============

router.get('/admin/pending', authenticate, isAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('marketplace_products')
            .where('status', '==', 'pending')
            .get();
        
        const products = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            products.push({ id: doc.id, ...data });
        });
        
        products.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateA - dateB;
        });
        
        res.json(products);
    } catch (error) {
        console.error('Error fetching pending products:', error);
        res.status(500).json({ error: 'Failed to fetch pending products' });
    }
});

// Admin: Approve a product with auto-add to stock
router.post('/admin/approve/:productId', authenticate, isAdmin, async (req, res) => {
    const { productId } = req.params;
    
    try {
        const productRef = db.collection('marketplace_products').doc(productId);
        const productDoc = await productRef.get();
        
        if (!productDoc.exists) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const product = productDoc.data();
        let stockPhotoAdded = false;

        if (product.image && product.image !== '📦') {
            try {
                const existingStock = await db.collection('stockPhotos')
                    .where('url', '==', product.image)
                    .get();

                if (existingStock.empty) {
                    const stockPhotoData = {
                        category: product.category || 'others',
                        url: product.image,
                        fileName: `user_uploaded_${product.userId}_${Date.now()}`,
                        fileSize: 0,
                        fileType: 'image/jpeg',
                        uploadedBy: product.userId,
                        uploadedByEmail: product.sellerEmail || 'unknown',
                        uploadedAt: new Date().toISOString(),
                        isActive: true,
                        isDefault: false,
                        usedCount: 0,
                        source: 'user_uploaded',
                        sourceProductId: productId,
                        sourceProductName: product.name,
                        uploadedByFullName: product.sellerName || 'Unknown Seller'
                    };

                    await db.collection('stockPhotos').add(stockPhotoData);
                    stockPhotoAdded = true;
                    console.log(`✅ Auto-added user image to stock: ${product.name}`);
                } else {
                    const existingDoc = existingStock.docs[0];
                    await existingDoc.ref.update({
                        usedCount: (existingDoc.data().usedCount || 0) + 1,
                        sourceProductId: productId,
                        sourceProductName: product.name
                    });
                    console.log(`📸 Image already in stock, usage count updated: ${product.name}`);
                }
            } catch (stockError) {
                console.error('Error adding to stock:', stockError);
            }
        }
        
        await productRef.update({
            status: 'approved',
            approvedAt: new Date().toISOString(),
            approvedBy: req.user.uid,
            stockPhotoAdded: stockPhotoAdded
        });
        
        await createNotification(
            product.userId,
            '✅ Product Approved!',
            `Your product "${product.name}" has been approved and is now live on the marketplace.${stockPhotoAdded ? ' Your product image has also been added to our stock photo library!' : ''}`,
            'product_approved',
            { productId: productId }
        );
        
        res.json({ 
            success: true, 
            message: 'Product approved successfully',
            stockPhotoAdded: stockPhotoAdded
        });
    } catch (error) {
        console.error('Error approving product:', error);
        res.status(500).json({ error: 'Failed to approve product' });
    }
});

// Admin: Reject a product
router.post('/admin/reject/:productId', authenticate, isAdmin, async (req, res) => {
    const { productId } = req.params;
    const { reason } = req.body;
    
    try {
        const productRef = db.collection('marketplace_products').doc(productId);
        const productDoc = await productRef.get();
        
        if (!productDoc.exists) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const product = productDoc.data();
        
        await productRef.update({
            status: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: req.user.uid,
            rejectionReason: reason || 'No reason provided'
        });
        
        await createNotification(
            product.userId,
            '❌ Product Rejected',
            `Your product "${product.name}" was rejected. Reason: ${reason || 'No reason provided'}`,
            'product_rejected',
            { productId: productId }
        );
        
        res.json({ success: true, message: 'Product rejected' });
    } catch (error) {
        console.error('Error rejecting product:', error);
        res.status(500).json({ error: 'Failed to reject product' });
    }
});

// ============ ORDER ROUTES ============

// Create order (checkout)
router.post('/orders', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { items, total, deliveryAddress, addressId  } = req.body;
    
    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
    }
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        const userData = userDoc.data();
        const currentBalance = userData.currentBalance || 0;

         let selectedAddress = null;
        if (addressId) {
            const addresses = userData.addresses || [];
            selectedAddress = addresses.find(addr => addr.id === addressId);
        }
        
        // If no addressId provided, try to find the default address
        if (!selectedAddress) {
            const addresses = userData.addresses || [];
            selectedAddress = addresses.find(addr => addr.isDefault) || addresses[0] || null;
        }
        
        if (total > currentBalance) {
            return res.status(400).json({ 
                error: 'Insufficient balance',
                balance: currentBalance,
                total: total,
                needed: total - currentBalance
            });
        }
        
        for (const item of items) {
            const productDoc = await db.collection('marketplace_products').doc(item.id).get();
            if (!productDoc.exists) {
                return res.status(404).json({ error: `Product ${item.name} not found` });
            }
            const product = productDoc.data();
            if (product.stock < item.quantity) {
                return res.status(400).json({ 
                    error: `Not enough stock for ${item.name}. Available: ${product.stock}` 
                });
            }
        }
        
        const orderId = generateOrderId();
        const orderRef = db.collection('marketplace_orders').doc(orderId);
        
        const tracking = [
            { stage: 'Order Placed', time: new Date().toISOString(), completed: true },
            { stage: 'Processing', time: null, completed: false },
            { stage: 'Dispatched', time: null, completed: false },
            { stage: 'Out for Delivery', time: null, completed: false },
            { stage: 'Delivered', time: null, completed: false }
        ];
        
        // ✅ FIX: Include sellerId in order
        const order = {
            orderId: orderId,
            userId: userId,
            sellerId: items[0]?.sellerId || null, // Store sellerId from first item
            items: items.map(item => ({
                productId: item.id,
                sellerId: item.sellerId || null, // Store sellerId per item
                name: item.name,
                quantity: item.quantity,
                price: item.discountPrice,
                originalPrice: item.originalPrice,
                image: item.image,
                unit: item.unit
            })),
            total: total,
            savings: items.reduce((sum, item) => 
                sum + ((item.originalPrice - item.discountPrice) * item.quantity), 0
            ),
            deliveryAddress: deliveryAddress || userData.deliveryAddress || 'Not provided',
            deliveryPhone: selectedAddress?.phone || userData.phone || '', // ← SAVE PHONE
            deliveryContact: selectedAddress?.fullName || userData.fullName || '', // ← SAVE CONTACT
            deliveryCity: selectedAddress?.city || '',
            deliveryState: selectedAddress?.state || '',
            deliveryStreet: selectedAddress?.street || '',
            status: 'pending',
            tracking: tracking,
            rated: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await orderRef.set(order);
        
        await db.collection('users').doc(userId).update({
            currentBalance: admin.firestore.FieldValue.increment(-total),
            updatedAt: new Date().toISOString()
        });
        
        await db.collection('transactions').add({
            userId: userId,
            type: 'marketplace_purchase',
            amount: total,
            description: `Marketplace order ${orderId}`,
            balanceAfter: currentBalance - total,
            orderId: orderId,
            createdAt: new Date().toISOString()
        });
        
        for (const item of items) {
            const productRef = db.collection('marketplace_products').doc(item.id);
            await productRef.update({
                stock: admin.firestore.FieldValue.increment(-item.quantity),
                updatedAt: new Date().toISOString()
            });
        }
        
        await createNotification(
            userId,
            '📦 Order Placed Successfully!',
            `Your order ${orderId} has been placed. Total: ₦${total.toLocaleString()}`,
            'order_placed',
            { orderId: orderId, total: total }
        );
        
        const adminsSnapshot = await db.collection('users')
            .where('role', '==', 'admin')
            .get();
        
        adminsSnapshot.forEach(async (adminDoc) => {
            await createNotification(
                adminDoc.id,
                '🛒 New Order Placed',
                `Order ${orderId} placed by ${userData.fullName || 'A user'}. Total: ₦${total.toLocaleString()}`,
                'new_order',
                { orderId: orderId, userId: userId }
            );
        });
        
        res.json({
            success: true,
            orderId: orderId,
            message: 'Order placed successfully',
            total: total,
            balanceAfter: currentBalance - total
        });
        
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

// Get user orders
router.get('/orders', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    try {
        const snapshot = await db.collection('marketplace_orders')
            .where('userId', '==', userId)
            .get();
        
        const orders = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            data.status = getOrderStatus(data.tracking);
            orders.push({ id: doc.id, ...data });
        });
        
        orders.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Get order by ID
router.get('/orders/:orderId', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { orderId } = req.params;
    
    try {
        const doc = await db.collection('marketplace_orders').doc(orderId).get();
        
        if (!doc.exists) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        const data = doc.data();
        if (data.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        data.status = getOrderStatus(data.tracking);
        res.json({ id: doc.id, ...data });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

// Cancel order
router.delete('/orders/:orderId', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { orderId } = req.params;
    
    try {
        const orderRef = db.collection('marketplace_orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        const order = orderDoc.data();
        if (order.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        if (order.status === 'delivered') {
            return res.status(400).json({ error: 'Cannot cancel delivered order' });
        }
        
        await db.collection('users').doc(userId).update({
            currentBalance: admin.firestore.FieldValue.increment(order.total),
            updatedAt: new Date().toISOString()
        });
        
        await orderRef.update({
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        for (const item of order.items) {
            const productRef = db.collection('marketplace_products').doc(item.productId);
            await productRef.update({
                stock: admin.firestore.FieldValue.increment(item.quantity),
                updatedAt: new Date().toISOString()
            });
        }
        
        await createNotification(
            userId,
            '🔄 Order Cancelled',
            `Your order ${orderId} has been cancelled. ₦${order.total.toLocaleString()} has been refunded to your wallet.`,
            'order_cancelled',
            { orderId: orderId }
        );
        
        res.json({ success: true, message: 'Order cancelled and refunded' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ error: 'Failed to cancel order' });
    }
});

// ============ ADMIN ORDER ROUTES ============

// Admin: Update order status
router.put('/orders/:orderId/status', authenticate, isAdmin, async (req, res) => {
    const { orderId } = req.params;
    const { stage } = req.body;
    
    try {
        const orderRef = db.collection('marketplace_orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        const order = orderDoc.data();
        const tracking = order.tracking || [];
        
        const stageMap = {
            'processing': 1,
            'dispatched': 2,
            'out_for_delivery': 3,
            'delivered': 4
        };
        
        const index = stageMap[stage];
        if (index !== undefined && index < tracking.length) {
            tracking[index].completed = true;
            tracking[index].time = new Date().toISOString();
        }
        
        if (index !== undefined) {
            for (let i = 1; i < index; i++) {
                if (tracking[i] && !tracking[i].completed) {
                    tracking[i].completed = true;
                    tracking[i].time = new Date().toISOString();
                }
            }
        }
        
        await orderRef.update({
            tracking: tracking,
            status: stage,
            updatedAt: new Date().toISOString()
        });
        
        const statusMessages = {
            'processing': '⚙️ Your order is being processed.',
            'dispatched': '📦 Your order has been dispatched.',
            'out_for_delivery': '🚚 Your order is out for delivery.',
            'delivered': '✅ Your order has been delivered!'
        };
        
        await createNotification(
            order.userId,
            `📦 Order ${stage.replace('_', ' ').toUpperCase()}`,
            `${statusMessages[stage] || 'Order status updated'} Order ID: ${orderId}`,
            `order_${stage}`,
            { orderId: orderId }
        );
        
        res.json({ success: true, message: `Order status updated to ${stage}` });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// Admin: Get all orders
router.get('/admin/orders', authenticate, isAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('marketplace_orders')
            .get();
        
        const orders = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            data.status = getOrderStatus(data.tracking);
            orders.push({ id: doc.id, ...data });
        });
        
        orders.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// ============================================================
// COMPLETE RATING SYSTEM
// ============================================================

// Get seller rating and stats
router.get('/seller/:sellerId/rating', async (req, res) => {
    const { sellerId } = req.params;
    
    try {
        // Check if seller exists
        const sellerDoc = await db.collection('users').doc(sellerId).get();
        if (!sellerDoc.exists) {
            return res.status(404).json({ error: 'Seller not found' });
        }
        
        const sellerData = sellerDoc.data();
        
        // Get all reviews for this seller
        const reviewsSnapshot = await db.collection('sellerRatings')
            .where('sellerId', '==', sellerId)
            .get();
        
        const reviews = [];
        let totalRating = 0;
        reviewsSnapshot.forEach(doc => {
            const data = doc.data();
            reviews.push({ id: doc.id, ...data });
            totalRating += data.rating || 0;
        });
        
        const reviewCount = reviews.length;
        const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
        
        // Get seller's products count
        const productsSnapshot = await db.collection('marketplace_products')
            .where('sellerId', '==', sellerId)
            .where('status', '==', 'approved')
            .get();
        
        const productCount = productsSnapshot.size;
        
        // ✅ FIX: Convert Firestore timestamp to ISO string
        let joinedDate = null;
        if (sellerData.joinDate) {
            // Check if it's a Firestore timestamp
            if (sellerData.joinDate.toDate) {
                joinedDate = sellerData.joinDate.toDate().toISOString();
            } else if (typeof sellerData.joinDate === 'string') {
                joinedDate = sellerData.joinDate;
            } else {
                joinedDate = new Date(sellerData.joinDate).toISOString();
            }
        } else if (sellerData.createdAt) {
            // Fallback to createdAt if joinDate doesn't exist
            if (sellerData.createdAt.toDate) {
                joinedDate = sellerData.createdAt.toDate().toISOString();
            } else if (typeof sellerData.createdAt === 'string') {
                joinedDate = sellerData.createdAt;
            } else {
                joinedDate = new Date(sellerData.createdAt).toISOString();
            }
        }
        
        // Calculate rating distribution
        const distribution = {
            5: 0, 4: 0, 3: 0, 2: 0, 1: 0
        };
        reviews.forEach(r => {
            const rating = Math.round(r.rating || 0);
            if (distribution[rating] !== undefined) {
                distribution[rating]++;
            }
        });
        
        // Get recent reviews (last 5)
        const recentReviews = reviews
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5)
            .map(r => ({
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                reviewerName: r.reviewerName || 'Anonymous',
                createdAt: r.createdAt,
                productName: r.productName || ''
            }));
        
        res.json({
            success: true,
            data: {
                averageRating: parseFloat(averageRating.toFixed(1)),
                totalReviews: reviewCount,
                productCount: productCount,
                joinedDate: joinedDate,
                positivePercentage: reviewCount > 0 
                    ? Math.round((reviews.filter(r => r.rating >= 4).length / reviewCount) * 100) 
                    : 0,
                distribution: distribution,
                recentReviews: recentReviews,
                sellerName: sellerData.fullName || 'Unknown Seller'
            }
        });
        
    } catch (error) {
        console.error('Error fetching seller rating:', error);
        res.status(500).json({ error: 'Failed to fetch seller rating' });
    }
});

// Submit rating for a product and seller
router.post('/orders/:orderId/rate', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { orderId } = req.params;
    const { ratings, sellerRating, sellerComment } = req.body;

    try {
        const orderRef = db.collection('marketplace_orders').doc(orderId);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const orderData = orderDoc.data();

        if (orderData.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (orderData.status !== 'delivered') {
            return res.status(400).json({ error: 'Can only rate delivered orders' });
        }

        if (orderData.rated) {
            return res.status(400).json({ error: 'Order already rated' });
        }

        if (!ratings || !Array.isArray(ratings) || ratings.length === 0) {
            return res.status(400).json({ error: 'Please rate at least one product' });
        }

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const reviewerName = userData.fullName || userData.displayName || 'Anonymous';

        const ratingPromises = [];
        let sellerRatingTotal = 0;
        let sellerRatingCount = 0;
        let mainSellerId = orderData.sellerId || orderData.items[0]?.sellerId || orderData.userId;

        for (const item of ratings) {
            const orderItem = orderData.items.find(p => p.productId === item.productId);
            if (!orderItem) {
                return res.status(400).json({ error: `Product ${item.productId} not in this order` });
            }

            const sellerId = orderItem.sellerId || orderData.sellerId || orderData.userId;
            
            if (!mainSellerId) {
                mainSellerId = sellerId;
            }

            const ratingValue = Math.round(item.rating);
            
            const productRatingData = {
                productId: item.productId,
                userId: userId,
                orderId: orderId,
                rating: ratingValue,
                comment: item.comment || '',
                reviewerName: reviewerName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                sellerId: sellerId,
                productName: orderItem.name || 'Unknown Product'
            };

            Object.keys(productRatingData).forEach(key => {
                if (productRatingData[key] === undefined) {
                    delete productRatingData[key];
                }
            });

            const productRatingRef = db.collection('productRatings').doc();
            ratingPromises.push(productRatingRef.set(productRatingData));

            // ✅ UPDATE: Also update the product's rating distribution
            const productRef = db.collection('marketplace_products').doc(item.productId);
            const productDoc = await productRef.get();
            if (productDoc.exists) {
                const productData = productDoc.data();
                
                // ✅ Get current distribution or initialize
                const distribution = productData.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                
                // ✅ Increment the rating count for this star value
                if (distribution[ratingValue] !== undefined) {
                    distribution[ratingValue] = (distribution[ratingValue] || 0) + 1;
                }
                
                const currentTotal = (productData.ratingTotal || 0) + ratingValue;
                const currentCount = (productData.ratingCount || 0) + 1;
                
                await productRef.update({
                    ratingTotal: currentTotal,
                    ratingCount: currentCount,
                    averageRating: currentTotal / currentCount,
                    ratingDistribution: distribution, // ✅ Save distribution
                    updatedAt: new Date().toISOString()
                });
            }

            sellerRatingTotal += ratingValue;
            sellerRatingCount++;
        }

        if (sellerRating && mainSellerId) {
            const sellerRatingData = {
                sellerId: mainSellerId,
                userId: userId,
                orderId: orderId,
                rating: Math.round(sellerRating),
                comment: sellerComment || '',
                reviewerName: reviewerName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            Object.keys(sellerRatingData).forEach(key => {
                if (sellerRatingData[key] === undefined) {
                    delete sellerRatingData[key];
                }
            });

            const sellerRatingRef = db.collection('sellerRatings').doc();
            ratingPromises.push(sellerRatingRef.set(sellerRatingData));

            const sellerRef = db.collection('users').doc(mainSellerId);
            const sellerDoc = await sellerRef.get();
            if (sellerDoc.exists) {
                const sellerData = sellerDoc.data();
                const currentTotal = (sellerData.sellerRatingTotal || 0) + Math.round(sellerRating);
                const currentCount = (sellerData.sellerRatingCount || 0) + 1;
                await sellerRef.update({
                    sellerRatingTotal: currentTotal,
                    sellerRatingCount: currentCount,
                    sellerAverageRating: currentTotal / currentCount,
                    updatedAt: new Date().toISOString()
                });
            }
        }

        await Promise.all(ratingPromises);

        const updateData = {
            rated: true,
            ratedAt: new Date().toISOString(),
            ratingSummary: {
                productCount: ratings.length,
                averageRating: sellerRatingCount > 0 ? sellerRatingTotal / sellerRatingCount : 0
            }
        };

        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        await orderRef.update(updateData);

        if (mainSellerId) {
            await createNotification(
                mainSellerId,
                '⭐ New Rating Received!',
                `${reviewerName} rated your products: ${(sellerRatingTotal / sellerRatingCount).toFixed(1)} stars`,
                'new_rating',
                { orderId: orderId }
            );
        }

        const avgRating = sellerRatingCount > 0 ? sellerRatingTotal / sellerRatingCount : 0;

        res.json({
            success: true,
            message: 'Ratings submitted successfully!',
            sellerAverage: avgRating
        });

    } catch (error) {
        console.error('Error submitting ratings:', error);
        res.status(500).json({ error: error.message || 'Failed to submit ratings' });
    }
});

// Get order rating status
router.get('/orders/:orderId/rating-status', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { orderId } = req.params;

    try {
        const orderRef = db.collection('marketplace_orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const orderData = orderDoc.data();

        if (orderData.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (orderData.rated) {
            return res.json({
                success: true,
                canRate: false,
                alreadyRated: true,
                ratedAt: orderData.ratedAt
            });
        }

        const canRate = orderData.status === 'delivered';
        const daysSinceDelivery = orderData.status === 'delivered' 
            ? Math.floor((Date.now() - new Date(orderData.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        const isExpired = daysSinceDelivery > 30;

        res.json({
            success: true,
            canRate: canRate && !isExpired && !orderData.rated,
            alreadyRated: orderData.rated || false,
            isExpired: isExpired,
            daysSinceDelivery: daysSinceDelivery,
            orderItems: orderData.items || [],
            orderId: orderId
        });

    } catch (error) {
        console.error('Error checking rating status:', error);
        res.status(500).json({ error: 'Failed to check rating status' });
    }
});

// Get product ratings
router.get('/products/:productId/ratings', async (req, res) => {
    const { productId } = req.params;
    const { limit = 10 } = req.query;

    try {
        const ratingsSnapshot = await db.collection('productRatings')
            .where('productId', '==', productId)
            .orderBy('createdAt', 'desc')
            .limit(parseInt(limit))
            .get();

        const ratings = [];
        ratingsSnapshot.forEach(doc => {
            ratings.push({ id: doc.id, ...doc.data() });
        });

        const productRef = db.collection('marketplace_products').doc(productId);
        const productDoc = await productRef.get();
        const productData = productDoc.data();

        res.json({
            success: true,
            ratings: ratings,
            averageRating: productData?.averageRating || 0,
            totalRatings: productData?.ratingCount || 0,
            ratingDistribution: productData?.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        });

    } catch (error) {
        console.error('Error fetching product ratings:', error);
        res.status(500).json({ error: 'Failed to fetch ratings' });
    }
});

// Admin: Get marketplace stats
router.get('/admin/stats', authenticate, isAdmin, async (req, res) => {
    try {
        const ordersSnapshot = await db.collection('marketplace_orders').get();
        const productsSnapshot = await db.collection('marketplace_products')
            .where('status', '==', 'approved')
            .get();
        
        const orders = [];
        ordersSnapshot.forEach(doc => orders.push(doc.data()));
        
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
        const totalSavings = orders.reduce((sum, o) => sum + (o.savings || 0), 0);
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        const processingOrders = orders.filter(o => o.status === 'processing').length;
        const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
        const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
        
        res.json({
            totalOrders,
            totalRevenue,
            totalSavings,
            pendingOrders,
            processingOrders,
            deliveredOrders,
            cancelledOrders,
            totalProducts: productsSnapshot.size
        });
    } catch (error) {
        console.error('Error fetching marketplace stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;