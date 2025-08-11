/**
 * Favorites Manager - Handle favorites functionality
 */
class FavoritesManager {
    constructor() {
        this.favorites = this.loadFavorites();
        this.baseUrl = window.location.origin;
        this.token = localStorage.getItem('authToken');
    }

    // Load favorites from localStorage and server
    loadFavorites() {
        try {
            return JSON.parse(localStorage.getItem('vitalbites_favorites') || '[]');
        } catch {
            return [];
        }
    }

    // Save favorites to localStorage
    saveFavorites() {
        try {
            localStorage.setItem('vitalbites_favorites', JSON.stringify(this.favorites));
        } catch (error) {
            console.error('Failed to save favorites to localStorage:', error);
        }
    }

    // Check if item is in favorites
    isFavorite(itemId) {
        return this.favorites.some(fav => fav.itemId === itemId.toString());
    }

    // Add item to favorites
    async addToFavorites(item) {
        try {
            // Prevent duplicates
            if (this.isFavorite(item.id)) {
                throw new Error('Item already in favorites');
            }

            const favoriteItem = {
                itemId: item.id.toString(),
                name: item.name,
                description: item.description,
                price: item.price,
                image: item.image,
                restaurant: item.restaurant,
                category: item.category || 'Unknown',
                addedAt: new Date().toISOString()
            };

            // Add to local storage first
            this.favorites.push(favoriteItem);
            this.saveFavorites();

            // If user is logged in, sync with server
            if (this.token) {
                await this.syncToServer('add', favoriteItem);
            }

            this.updateFavoriteButtons(item.id, true);
            this.showNotification(`${item.name} added to favorites!`, 'success');
            
            return true;
        } catch (error) {
            console.error('Failed to add to favorites:', error);
            this.showNotification(error.message || 'Failed to add to favorites', 'error');
            return false;
        }
    }

    // Remove item from favorites
    async removeFromFavorites(itemId) {
        try {
            const itemIndex = this.favorites.findIndex(fav => fav.itemId === itemId.toString());
            
            if (itemIndex === -1) {
                throw new Error('Item not found in favorites');
            }

            const itemName = this.favorites[itemIndex].name;
            
            // Remove from local storage
            this.favorites.splice(itemIndex, 1);
            this.saveFavorites();

            // If user is logged in, sync with server
            if (this.token) {
                await this.syncToServer('remove', { itemId: itemId.toString() });
            }

            this.updateFavoriteButtons(itemId, false);
            this.showNotification(`${itemName} removed from favorites!`, 'info');
            
            return true;
        } catch (error) {
            console.error('Failed to remove from favorites:', error);
            this.showNotification(error.message || 'Failed to remove from favorites', 'error');
            return false;
        }
    }

    // Toggle favorite status
    async toggleFavorite(item) {
        if (this.isFavorite(item.id)) {
            return await this.removeFromFavorites(item.id);
        } else {
            return await this.addToFavorites(item);
        }
    }

    // Update favorite button appearance
    updateFavoriteButtons(itemId, isFavorite) {
        const buttons = document.querySelectorAll(`[data-id="${itemId}"]`);
        buttons.forEach(button => {
            const heart = button.querySelector('.heart-icon');
            if (heart) {
                if (isFavorite) {
                    heart.className = 'fas fa-heart heart-icon text-red-500 transition-colors duration-300';
                    button.title = 'Remove from favorites';
                } else {
                    heart.className = 'far fa-heart heart-icon text-gray-400 hover:text-red-400 transition-colors duration-300';
                    button.title = 'Add to favorites';
                }
            }
        });
    }

    // Sync favorites with server
    async syncToServer(action, data) {
        if (!this.token) return;

        try {
            const url = `${this.baseUrl}/api/favorites/${action}`;
            const method = action === 'remove' ? 'DELETE' : 'POST';
            
            let endpoint = url;
            let body = null;
            
            if (action === 'remove') {
                endpoint = `${this.baseUrl}/api/favorites/remove/${data.itemId}`;
            } else if (action === 'add') {
                body = JSON.stringify(data);
            }

            const response = await fetch(endpoint, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: body
            });

            if (!response.ok) {
                throw new Error(`Server sync failed: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Favorites synced successfully:', result);
            
        } catch (error) {
            console.error('Failed to sync with server:', error);
            // Continue working offline
        }
    }

    // Sync from server when user logs in
    async syncFromServer() {
        if (!this.token) return;

        try {
            const response = await fetch(`${this.baseUrl}/api/favorites`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch favorites: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Merge server favorites with local favorites
            if (data.favorites && Array.isArray(data.favorites)) {
                const serverFavorites = data.favorites.map(fav => ({
                    itemId: fav.itemId,
                    name: fav.name,
                    description: fav.description,
                    price: fav.price,
                    image: fav.image,
                    restaurant: fav.restaurant,
                    category: fav.category,
                    addedAt: fav.addedAt
                }));

                // Create a combined favorites list (server takes precedence)
                const combinedFavorites = [...serverFavorites];
                
                // Add local favorites that aren't on server
                this.favorites.forEach(localFav => {
                    if (!serverFavorites.some(serverFav => serverFav.itemId === localFav.itemId)) {
                        combinedFavorites.push(localFav);
                        // Sync this item to server
                        this.syncToServer('add', localFav);
                    }
                });

                this.favorites = combinedFavorites;
                this.saveFavorites();
                this.refreshFavoriteButtons();
                
                console.log('Favorites synced from server successfully');
            }
            
        } catch (error) {
            console.error('Failed to sync favorites from server:', error);
            // Continue with local favorites
        }
    }

    // Refresh all favorite buttons on the page
    refreshFavoriteButtons() {
        const favoriteButtons = document.querySelectorAll('.favorite-btn');
        favoriteButtons.forEach(button => {
            const itemId = button.getAttribute('data-id');
            const isFavorite = this.isFavorite(itemId);
            this.updateFavoriteButtons(itemId, isFavorite);
        });
    }

    // Get all favorites
    getFavorites() {
        return [...this.favorites];
    }

    // Get favorites count
    getFavoritesCount() {
        return this.favorites.length;
    }

    // Clear all favorites
    async clearFavorites() {
        try {
            if (!confirm('Are you sure you want to clear all favorites?')) {
                return false;
            }

            this.favorites = [];
            this.saveFavorites();

            if (this.token) {
                await fetch(`${this.baseUrl}/api/favorites/clear`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
            }

            this.refreshFavoriteButtons();
            this.showNotification('All favorites cleared!', 'info');
            
            return true;
        } catch (error) {
            console.error('Failed to clear favorites:', error);
            this.showNotification('Failed to clear favorites', 'error');
            return false;
        }
    }

    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg text-white font-medium shadow-lg transform translate-x-full transition-transform duration-300 ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            type === 'info' ? 'bg-blue-500' : 'bg-gray-500'
        }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto hide after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(full)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Initialize event listeners
    init() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.favorite-btn')) {
                const button = e.target.closest('.favorite-btn');
                const itemId = button.getAttribute('data-id');
                
                // Find the item data
                if (window.foodItems) {
                    const item = window.foodItems.find(food => food.id.toString() === itemId);
                    if (item) {
                        this.toggleFavorite(item);
                    }
                }
            }
        });

        // Refresh buttons on page load
        this.refreshFavoriteButtons();
        
        console.log('Favorites Manager initialized');
    }

    // Update token when user logs in
    updateToken(token) {
        this.token = token;
        if (token) {
            this.syncFromServer();
        }
    }
}

// Initialize favorites manager
window.favoritesManager = new FavoritesManager();