/**
 * Real-time Notifications Manager for VitalBites
 */

class NotificationManager {
    constructor() {
        this.baseUrl = window.location.origin;
        this.token = localStorage.getItem('authToken');
        this.socket = null;
        this.notifications = [];
        this.isInitialized = false;
        this.maxNotifications = 50;
    }

    // Initialize notifications
    async init() {
        if (this.isInitialized) return;

        try {
            // Load existing notifications from server
            await this.loadNotifications();
            
            // Initialize WebSocket connection if user is logged in
            if (this.token) {
                this.connectWebSocket();
            }

            // Create notification UI
            this.createNotificationUI();
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('Notification Manager initialized');
        } catch (error) {
            console.error('Error initializing notifications:', error);
        }
    }

    // Load notifications from server
    async loadNotifications() {
        if (!this.token) return;

        try {
            const response = await fetch(`${this.baseUrl}/api/notifications?limit=20`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.notifications = data.notifications || [];
                this.updateNotificationUI();
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    // Connect to WebSocket for real-time notifications
    connectWebSocket() {
        try {
            // Load Socket.IO if not already loaded
            if (typeof io === 'undefined') {
                const script = document.createElement('script');
                script.src = '/socket.io/socket.io.js';
                script.onload = () => this.initializeSocket();
                document.head.appendChild(script);
            } else {
                this.initializeSocket();
            }
        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
        }
    }

    initializeSocket() {
        try {
            this.socket = io({
                auth: {
                    token: this.token
                }
            });

            this.socket.on('connect', () => {
                console.log('Connected to notification server');
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from notification server');
            });

            this.socket.on('new_notification', (notification) => {
                this.handleNewNotification(notification);
            });

            this.socket.on('notification_updated', (data) => {
                this.updateNotificationStatus(data.id, data.status);
            });

        } catch (error) {
            console.error('Error initializing socket:', error);
        }
    }

    // Handle new notification
    handleNewNotification(notification) {
        // Add to notifications array
        this.notifications.unshift(notification);
        
        // Limit the number of notifications stored
        if (this.notifications.length > this.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.maxNotifications);
        }

        // Update UI
        this.updateNotificationUI();
        
        // Show toast notification
        this.showToastNotification(notification);

        // Play notification sound (optional)
        this.playNotificationSound();

        // Update page title if tab is not active
        this.updatePageTitle();
    }

    // Create notification UI elements
    createNotificationUI() {
        // Create notification bell icon (if not exists)
        if (!document.getElementById('notificationBell')) {
            this.createNotificationBell();
        }

        // Create notification panel (if not exists)
        if (!document.getElementById('notificationPanel')) {
            this.createNotificationPanel();
        }
    }

    createNotificationBell() {
        const bell = document.createElement('div');
        bell.id = 'notificationBell';
        bell.className = 'fixed top-4 right-4 z-40 cursor-pointer';
        bell.innerHTML = `
            <div class="relative">
                <div class="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg transition-colors">
                    <i class="fas fa-bell text-xl"></i>
                </div>
                <div id="notificationBadge" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center hidden">
                    0
                </div>
            </div>
        `;

        bell.addEventListener('click', () => this.toggleNotificationPanel());
        document.body.appendChild(bell);
    }

    createNotificationPanel() {
        const panel = document.createElement('div');
        panel.id = 'notificationPanel';
        panel.className = 'fixed top-16 right-4 z-30 w-80 max-h-96 bg-gray-800 rounded-lg shadow-xl border border-gray-700 hidden';
        panel.innerHTML = `
            <div class="p-4 border-b border-gray-700">
                <div class="flex justify-between items-center">
                    <h3 class="font-semibold text-white">Notifications</h3>
                    <div class="flex gap-2">
                        <button id="markAllRead" class="text-sm text-blue-400 hover:text-blue-300">
                            Mark all read
                        </button>
                        <button id="closeNotifications" class="text-gray-400 hover:text-white">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div id="notificationList" class="max-h-80 overflow-y-auto">
                <div id="noNotifications" class="p-6 text-center text-gray-400">
                    <i class="fas fa-bell-slash text-3xl mb-2"></i>
                    <p>No notifications yet</p>
                </div>
            </div>
            <div class="p-3 border-t border-gray-700">
                <button onclick="window.location.href='menu-page.html?tab=notifications'" 
                        class="w-full text-center text-sm text-blue-400 hover:text-blue-300">
                    View all notifications
                </button>
            </div>
        `;

        // Set up event listeners
        panel.querySelector('#markAllRead').addEventListener('click', () => this.markAllAsRead());
        panel.querySelector('#closeNotifications').addEventListener('click', () => this.hideNotificationPanel());

        document.body.appendChild(panel);
    }

    // Toggle notification panel
    toggleNotificationPanel() {
        const panel = document.getElementById('notificationPanel');
        if (panel.classList.contains('hidden')) {
            this.showNotificationPanel();
        } else {
            this.hideNotificationPanel();
        }
    }

    showNotificationPanel() {
        const panel = document.getElementById('notificationPanel');
        panel.classList.remove('hidden');
        this.updateNotificationUI();
        
        // Close when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this.handleOutsideClick.bind(this));
        }, 100);
    }

    hideNotificationPanel() {
        const panel = document.getElementById('notificationPanel');
        panel.classList.add('hidden');
        document.removeEventListener('click', this.handleOutsideClick.bind(this));
    }

    handleOutsideClick(event) {
        const panel = document.getElementById('notificationPanel');
        const bell = document.getElementById('notificationBell');
        
        if (!panel.contains(event.target) && !bell.contains(event.target)) {
            this.hideNotificationPanel();
        }
    }

    // Update notification UI
    updateNotificationUI() {
        const unreadCount = this.notifications.filter(n => n.status === 'unread').length;
        
        // Update badge
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // Update notification list
        this.updateNotificationList();
    }

    updateNotificationList() {
        const listContainer = document.getElementById('notificationList');
        const noNotifications = document.getElementById('noNotifications');
        
        if (!listContainer) return;

        if (this.notifications.length === 0) {
            noNotifications.classList.remove('hidden');
            return;
        }

        noNotifications.classList.add('hidden');

        const recentNotifications = this.notifications.slice(0, 10); // Show only 10 most recent
        listContainer.innerHTML = recentNotifications.map(notification => this.renderNotificationItem(notification)).join('');
    }

    renderNotificationItem(notification) {
        const isUnread = notification.status === 'unread';
        const timeAgo = this.getTimeAgo(new Date(notification.createdAt));
        
        return `
            <div class="notification-item p-3 border-b border-gray-700 hover:bg-gray-750 cursor-pointer ${isUnread ? 'bg-blue-900 bg-opacity-20' : ''}" 
                 onclick="notificationManager.handleNotificationClick('${notification.id}')">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0">
                        ${this.getNotificationIcon(notification.type)}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start">
                            <p class="font-medium text-white text-sm line-clamp-1">${notification.title}</p>
                            <div class="flex items-center gap-1">
                                ${isUnread ? '<div class="w-2 h-2 bg-blue-500 rounded-full"></div>' : ''}
                                <span class="text-xs text-gray-400">${timeAgo}</span>
                            </div>
                        </div>
                        <p class="text-sm text-gray-400 mt-1 line-clamp-2">${notification.message}</p>
                    </div>
                </div>
            </div>
        `;
    }

    getNotificationIcon(type) {
        const iconMap = {
            order_status: '<i class="fas fa-box text-blue-400"></i>',
            payment: '<i class="fas fa-credit-card text-green-400"></i>',
            delivery: '<i class="fas fa-truck text-orange-400"></i>',
            promotion: '<i class="fas fa-tag text-purple-400"></i>',
            system: '<i class="fas fa-info-circle text-gray-400"></i>'
        };

        return iconMap[type] || iconMap.system;
    }

    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    }

    // Handle notification click
    async handleNotificationClick(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (!notification) return;

        // Mark as read
        if (notification.status === 'unread') {
            await this.markAsRead(notificationId);
        }

        // Navigate if there's an action URL
        if (notification.metadata && notification.metadata.actionUrl) {
            window.location.href = notification.metadata.actionUrl;
        }

        // Close panel
        this.hideNotificationPanel();
    }

    // Mark notification as read
    async markAsRead(notificationId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/notifications/${notificationId}/read`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                // Update local status
                const notification = this.notifications.find(n => n.id === notificationId);
                if (notification) {
                    notification.status = 'read';
                    this.updateNotificationUI();
                }
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    // Mark all notifications as read
    async markAllAsRead() {
        try {
            const response = await fetch(`${this.baseUrl}/api/notifications/read-all`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                // Update local statuses
                this.notifications.forEach(notification => {
                    notification.status = 'read';
                });
                this.updateNotificationUI();
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    // Update notification status
    updateNotificationStatus(notificationId, status) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.status = status;
            this.updateNotificationUI();
        }
    }

    // Show toast notification
    showToastNotification(notification) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 z-50 bg-gray-800 text-white p-4 rounded-lg shadow-lg max-w-sm border border-gray-700 transform translate-x-full transition-transform duration-300';
        
        toast.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="flex-shrink-0">
                    ${this.getNotificationIcon(notification.type)}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-medium text-sm">${notification.title}</p>
                    <p class="text-sm text-gray-300 mt-1">${notification.message}</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-white">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.style.transform = 'translateX(full)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);

        // Make it clickable
        toast.addEventListener('click', () => {
            this.handleNotificationClick(notification.id);
            toast.remove();
        });
    }

    // Play notification sound
    playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiS2e/NeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiS2e/NeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiS2e/NeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiS2e/NeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiS2e/NeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiS2e/NeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiS2e/NeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGIcBjiS2e/NeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvGI=');
            audio.volume = 0.3;
            audio.play().catch(() => {
                // Ignore audio play errors (browser restrictions)
            });
        } catch (error) {
            // Ignore audio errors
        }
    }

    // Update page title with notification count
    updatePageTitle() {
        const unreadCount = this.notifications.filter(n => n.status === 'unread').length;
        const originalTitle = document.title.replace(/^\(\d+\) /, '');
        
        if (unreadCount > 0) {
            document.title = `(${unreadCount}) ${originalTitle}`;
        } else {
            document.title = originalTitle;
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Handle page visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updatePageTitle();
            }
        });

        // Handle user login
        window.addEventListener('userLoggedIn', (event) => {
            this.token = event.detail.token;
            this.connectWebSocket();
            this.loadNotifications();
        });

        // Handle user logout
        window.addEventListener('userLoggedOut', () => {
            this.token = null;
            if (this.socket) {
                this.socket.disconnect();
                this.socket = null;
            }
            this.notifications = [];
            this.updateNotificationUI();
        });
    }

    // Update token when user logs in
    updateToken(token) {
        this.token = token;
        if (this.socket) {
            this.socket.disconnect();
        }
        this.connectWebSocket();
        this.loadNotifications();
    }

    // Cleanup
    destroy() {
        if (this.socket) {
            this.socket.disconnect();
        }
        
        // Remove UI elements
        const bell = document.getElementById('notificationBell');
        const panel = document.getElementById('notificationPanel');
        
        if (bell) bell.remove();
        if (panel) panel.remove();
        
        this.isInitialized = false;
    }
}

// Initialize notification manager
window.notificationManager = new NotificationManager();

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.notificationManager.init();
});