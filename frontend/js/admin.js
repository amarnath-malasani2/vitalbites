/**
 * VitalBites Admin Dashboard JavaScript
 */

class AdminDashboard {
    constructor() {
        this.baseUrl = window.location.origin;
        this.token = localStorage.getItem('adminToken');
        this.currentSection = 'dashboard';
        this.charts = {};
    }

    // Authentication
    async login(email, password) {
        try {
            const response = await fetch(`${this.baseUrl}/api/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                throw new Error('Login failed');
            }

            const data = await response.json();
            this.token = data.token;
            localStorage.setItem('adminToken', this.token);
            localStorage.setItem('adminUser', JSON.stringify(data.admin));

            this.showNotification('Login successful!', 'success');
            this.hidLoginForm();
            this.loadDashboard();
            
            return true;
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification(error.message || 'Login failed', 'error');
            return false;
        }
    }

    logout() {
        this.token = null;
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        this.showLoginForm();
    }

    // Dashboard Statistics
    async loadDashboardStats() {
        try {
            const response = await fetch(`${this.baseUrl}/api/admin/dashboard/stats`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }

            const stats = await response.json();
            this.renderDashboardStats(stats);
            
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            this.showNotification('Failed to load dashboard statistics', 'error');
        }
    }

    renderDashboardStats(stats) {
        // Update stat cards
        document.getElementById('totalUsers').textContent = stats.users?.total || 0;
        document.getElementById('totalOrders').textContent = stats.orders?.total || 0;
        document.getElementById('totalRevenue').textContent = `₹${stats.payments?.totalRevenue || 0}`;
        document.getElementById('totalMenuItems').textContent = stats.menu?.total || 0;

        // Update charts if needed
        this.updateCharts(stats);
    }

    // User Management
    async loadUsers(page = 1, search = '', status = '') {
        try {
            const params = new URLSearchParams({ page, limit: 20 });
            if (search) params.append('search', search);
            if (status) params.append('status', status);

            const response = await fetch(`${this.baseUrl}/api/admin/users?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }

            const data = await response.json();
            this.renderUsersTable(data);
            
        } catch (error) {
            console.error('Error loading users:', error);
            this.showNotification('Failed to load users', 'error');
        }
    }

    renderUsersTable(data) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        tbody.innerHTML = data.users.map(user => `
            <tr class="border-b border-gray-700 hover:bg-gray-800">
                <td class="px-4 py-3">
                    <div class="flex items-center">
                        <div class="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mr-3">
                            <i class="fas fa-user text-white text-sm"></i>
                        </div>
                        <div>
                            <div class="font-medium">${user.username || 'N/A'}</div>
                            <div class="text-gray-400 text-sm">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3">${user.mobile || 'N/A'}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs rounded-full ${user.role === 'admin' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}">
                        ${user.role}
                    </span>
                </td>
                <td class="px-4 py-3">${new Date(user.createdAt).toLocaleDateString()}</td>
                <td class="px-4 py-3">
                    <button onclick="adminDashboard.viewUser('${user._id}')" class="text-blue-400 hover:text-blue-300 mr-2">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="adminDashboard.editUser('${user._id}')" class="text-yellow-400 hover:text-yellow-300 mr-2">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Update pagination
        this.updatePagination('users', data);
    }

    // Order Management
    async loadOrders(page = 1, status = '', startDate = '', endDate = '') {
        try {
            const params = new URLSearchParams({ page, limit: 20 });
            if (status) params.append('status', status);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const response = await fetch(`${this.baseUrl}/api/admin/orders?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch orders');
            }

            const data = await response.json();
            this.renderOrdersTable(data);
            
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showNotification('Failed to load orders', 'error');
        }
    }

    renderOrdersTable(data) {
        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;

        tbody.innerHTML = data.orders.map(order => `
            <tr class="border-b border-gray-700 hover:bg-gray-800">
                <td class="px-4 py-3">
                    <div class="font-medium">#${order.orderNumber}</div>
                    <div class="text-gray-400 text-sm">${new Date(order.createdAt).toLocaleString()}</div>
                </td>
                <td class="px-4 py-3">
                    <div class="font-medium">${order.userId?.username || 'N/A'}</div>
                    <div class="text-gray-400 text-sm">${order.userId?.email || 'N/A'}</div>
                </td>
                <td class="px-4 py-3">₹${order.total}</td>
                <td class="px-4 py-3">
                    <select onchange="adminDashboard.updateOrderStatus('${order._id}', this.value)" 
                            class="bg-gray-700 text-white rounded px-2 py-1 text-sm">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
                        <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Ready</option>
                        <option value="out_for_delivery" ${order.status === 'out_for_delivery' ? 'selected' : ''}>Out for Delivery</option>
                        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
                <td class="px-4 py-3">
                    <button onclick="adminDashboard.viewOrder('${order._id}')" class="text-blue-400 hover:text-blue-300">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        this.updatePagination('orders', data);
    }

    async updateOrderStatus(orderId, status) {
        try {
            const response = await fetch(`${this.baseUrl}/api/admin/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                throw new Error('Failed to update order status');
            }

            this.showNotification('Order status updated successfully!', 'success');
            this.loadOrders(); // Reload orders table
            
        } catch (error) {
            console.error('Error updating order status:', error);
            this.showNotification('Failed to update order status', 'error');
        }
    }

    // Menu Management
    async loadMenuItems(page = 1, search = '', category = '') {
        try {
            const params = new URLSearchParams({ page, limit: 20 });
            if (search) params.append('search', search);
            if (category) params.append('category', category);

            const response = await fetch(`${this.baseUrl}/api/admin/menu?${params}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch menu items');
            }

            const data = await response.json();
            this.renderMenuTable(data);
            
        } catch (error) {
            console.error('Error loading menu items:', error);
            this.showNotification('Failed to load menu items', 'error');
        }
    }

    renderMenuTable(data) {
        const tbody = document.getElementById('menuTableBody');
        if (!tbody) return;

        tbody.innerHTML = data.items.map(item => `
            <tr class="border-b border-gray-700 hover:bg-gray-800">
                <td class="px-4 py-3">
                    <div class="flex items-center">
                        <img src="${item.image}" alt="${item.name}" class="w-12 h-12 rounded-lg object-cover mr-3">
                        <div>
                            <div class="font-medium">${item.name}</div>
                            <div class="text-gray-400 text-sm">${item.category}</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3">₹${item.price}</td>
                <td class="px-4 py-3">${item.restaurant}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs rounded-full ${item.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${item.available ? 'Available' : 'Unavailable'}
                    </span>
                </td>
                <td class="px-4 py-3">
                    <button onclick="adminDashboard.editMenuItem('${item._id}')" class="text-yellow-400 hover:text-yellow-300 mr-2">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="adminDashboard.toggleMenuItemAvailability('${item._id}', ${!item.available})" 
                            class="text-blue-400 hover:text-blue-300 mr-2">
                        <i class="fas fa-toggle-${item.available ? 'on' : 'off'}"></i>
                    </button>
                    <button onclick="adminDashboard.deleteMenuItem('${item._id}')" class="text-red-400 hover:text-red-300">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        this.updatePagination('menu', data);
    }

    async toggleMenuItemAvailability(itemId, available) {
        try {
            const response = await fetch(`${this.baseUrl}/api/menu/${itemId}/availability`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ available })
            });

            if (!response.ok) {
                throw new Error('Failed to update item availability');
            }

            this.showNotification(`Item ${available ? 'enabled' : 'disabled'} successfully!`, 'success');
            this.loadMenuItems();
            
        } catch (error) {
            console.error('Error updating item availability:', error);
            this.showNotification('Failed to update item availability', 'error');
        }
    }

    async deleteMenuItem(itemId) {
        if (!confirm('Are you sure you want to delete this menu item?')) return;

        try {
            const response = await fetch(`${this.baseUrl}/api/menu/${itemId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete menu item');
            }

            this.showNotification('Menu item deleted successfully!', 'success');
            this.loadMenuItems();
            
        } catch (error) {
            console.error('Error deleting menu item:', error);
            this.showNotification('Failed to delete menu item', 'error');
        }
    }

    // Analytics
    async loadAnalytics(period = '7d') {
        try {
            const response = await fetch(`${this.baseUrl}/api/analytics/sales?period=${period}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch analytics');
            }

            const data = await response.json();
            this.renderAnalytics(data);
            
        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showNotification('Failed to load analytics', 'error');
        }
    }

    // Notification Management
    async sendBulkNotification(userIds, title, message, type = 'system', priority = 'medium') {
        try {
            const response = await fetch(`${this.baseUrl}/api/admin/notifications/bulk`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userIds,
                    title,
                    message,
                    type,
                    priority
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send notifications');
            }

            const result = await response.json();
            this.showNotification(`Sent notifications to ${result.count} users!`, 'success');
            
        } catch (error) {
            console.error('Error sending notifications:', error);
            this.showNotification('Failed to send notifications', 'error');
        }
    }

    // Utility functions
    updatePagination(section, data) {
        const paginationContainer = document.getElementById(`${section}Pagination`);
        if (!paginationContainer || !data.pagination) return;

        const { currentPage, totalPages } = data.pagination;
        const paginationHTML = [];

        // Previous button
        paginationHTML.push(`
            <button ${currentPage <= 1 ? 'disabled' : ''} 
                    onclick="adminDashboard.changePage('${section}', ${currentPage - 1})"
                    class="px-3 py-1 rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50">
                Previous
            </button>
        `);

        // Page numbers
        for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
            paginationHTML.push(`
                <button onclick="adminDashboard.changePage('${section}', ${i})"
                        class="px-3 py-1 rounded ${i === currentPage ? 'bg-orange-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}">
                    ${i}
                </button>
            `);
        }

        // Next button
        paginationHTML.push(`
            <button ${currentPage >= totalPages ? 'disabled' : ''} 
                    onclick="adminDashboard.changePage('${section}', ${currentPage + 1})"
                    class="px-3 py-1 rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50">
                Next
            </button>
        `);

        paginationContainer.innerHTML = paginationHTML.join('');
    }

    changePage(section, page) {
        switch (section) {
            case 'users':
                this.loadUsers(page);
                break;
            case 'orders':
                this.loadOrders(page);
                break;
            case 'menu':
                this.loadMenuItems(page);
                break;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg text-white font-medium shadow-lg transform translate-x-full transition-transform duration-300 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
        }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            notification.style.transform = 'translateX(full)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Navigation
    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });

        // Show selected section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
            this.currentSection = sectionId;

            // Load data for the section
            switch (sectionId) {
                case 'dashboard':
                    this.loadDashboardStats();
                    break;
                case 'users':
                    this.loadUsers();
                    break;
                case 'orders':
                    this.loadOrders();
                    break;
                case 'menu':
                    this.loadMenuItems();
                    break;
                case 'analytics':
                    this.loadAnalytics();
                    break;
            }
        }

        // Update active menu item
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[data-section="${sectionId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    // Initialize
    init() {
        // Check if admin is already logged in
        if (this.token) {
            this.hideLoginForm();
            this.loadDashboard();
        } else {
            this.showLoginForm();
        }

        // Set up event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('adminEmail').value;
                const password = document.getElementById('adminPassword').value;
                await this.login(email, password);
            });
        }

        // Sidebar navigation
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.getAttribute('data-section');
                if (section) {
                    this.showSection(section);
                }
            });
        });

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    showLoginForm() {
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.style.display = 'flex';
        }
    }

    hideLoginForm() {
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.style.display = 'none';
        }
    }

    loadDashboard() {
        this.showSection('dashboard');
    }
}

// Initialize admin dashboard
window.adminDashboard = new AdminDashboard();
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard.init();
});