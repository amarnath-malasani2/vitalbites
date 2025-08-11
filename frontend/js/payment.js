/**
 * VitalBites Payment Manager with Razorpay Integration
 */

class PaymentManager {
    constructor() {
        this.baseUrl = window.location.origin;
        this.token = localStorage.getItem('authToken');
        this.razorpayKey = null;
    }

    // Initialize Razorpay
    async initializeRazorpay() {
        return new Promise((resolve) => {
            // Load Razorpay script if not already loaded
            if (typeof Razorpay === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                script.onload = () => resolve(true);
                script.onerror = () => resolve(false);
                document.head.appendChild(script);
            } else {
                resolve(true);
            }
        });
    }

    // Create Razorpay Order
    async createPaymentOrder(orderData) {
        try {
            if (!this.token) {
                throw new Error('Please login to proceed with payment');
            }

            const response = await fetch(`${this.baseUrl}/api/payments/create-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    amount: orderData.total,
                    orderId: orderData.orderId,
                    customerDetails: {
                        name: orderData.customerName,
                        email: orderData.customerEmail,
                        contact: orderData.customerPhone
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create payment order');
            }

            const data = await response.json();
            this.razorpayKey = data.key;
            return data;

        } catch (error) {
            console.error('Error creating payment order:', error);
            throw error;
        }
    }

    // Process Payment
    async processPayment(paymentOrderData, orderData) {
        try {
            // Initialize Razorpay
            const isInitialized = await this.initializeRazorpay();
            if (!isInitialized) {
                throw new Error('Failed to initialize payment gateway');
            }

            return new Promise((resolve, reject) => {
                const options = {
                    key: this.razorpayKey,
                    amount: paymentOrderData.amount,
                    currency: paymentOrderData.currency,
                    order_id: paymentOrderData.razorpayOrderId,
                    name: 'VitalBites',
                    description: 'Food Order Payment',
                    image: '/favicon.ico', // Add your logo
                    handler: async (response) => {
                        try {
                            // Verify payment
                            const verificationResult = await this.verifyPayment(response);
                            if (verificationResult.success) {
                                resolve({
                                    success: true,
                                    paymentId: response.razorpay_payment_id,
                                    orderId: response.razorpay_order_id,
                                    signature: response.razorpay_signature
                                });
                            } else {
                                reject(new Error('Payment verification failed'));
                            }
                        } catch (error) {
                            reject(error);
                        }
                    },
                    prefill: {
                        name: orderData.customerName,
                        email: orderData.customerEmail,
                        contact: orderData.customerPhone
                    },
                    notes: {
                        order_id: orderData.orderId,
                        delivery_address: orderData.deliveryAddress
                    },
                    theme: {
                        color: '#ff8800'
                    },
                    modal: {
                        ondismiss: () => {
                            reject(new Error('Payment cancelled by user'));
                        }
                    }
                };

                const razorpay = new Razorpay(options);
                razorpay.open();
            });

        } catch (error) {
            console.error('Error processing payment:', error);
            throw error;
        }
    }

    // Verify Payment
    async verifyPayment(paymentResponse) {
        try {
            const response = await fetch(`${this.baseUrl}/api/payments/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    razorpayOrderId: paymentResponse.razorpay_order_id,
                    razorpayPaymentId: paymentResponse.razorpay_payment_id,
                    razorpaySignature: paymentResponse.razorpay_signature
                })
            });

            if (!response.ok) {
                throw new Error('Payment verification failed');
            }

            return await response.json();

        } catch (error) {
            console.error('Error verifying payment:', error);
            throw error;
        }
    }

    // Handle Payment Failure
    async handlePaymentFailure(error, orderId) {
        try {
            await fetch(`${this.baseUrl}/api/payments/failure`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    razorpayOrderId: orderId,
                    error: error.description || error.message
                })
            });
        } catch (failureError) {
            console.error('Error recording payment failure:', failureError);
        }
    }

    // Complete Checkout Process
    async completeCheckout(cartItems, deliveryAddress, customerDetails) {
        try {
            this.showLoadingState(true);

            // Step 1: Create Order
            const orderData = await this.createOrder(cartItems, deliveryAddress, customerDetails);

            // Step 2: Create Payment Order
            const paymentOrderData = await this.createPaymentOrder(orderData);

            // Step 3: Process Payment
            const paymentResult = await this.processPayment(paymentOrderData, orderData);

            // Step 4: Update Order with Payment Status
            await this.updateOrderPaymentStatus(orderData.orderId, paymentResult.paymentId, 'paid');

            // Step 5: Clear Cart and Redirect
            this.clearCart();
            this.showSuccess('Payment successful! Your order has been placed.');
            
            // Redirect to order success page
            setTimeout(() => {
                window.location.href = `order-success.html?orderId=${orderData.orderId}&paymentId=${paymentResult.paymentId}`;
            }, 2000);

            return {
                success: true,
                orderId: orderData.orderId,
                paymentId: paymentResult.paymentId
            };

        } catch (error) {
            console.error('Checkout failed:', error);
            this.showError(error.message || 'Payment failed. Please try again.');
            throw error;
        } finally {
            this.showLoadingState(false);
        }
    }

    // Create Order
    async createOrder(cartItems, deliveryAddress, customerDetails) {
        try {
            const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const deliveryFee = 50;
            const taxes = total * 0.05; // 5% tax
            const finalTotal = total + deliveryFee + taxes;

            const orderPayload = {
                items: cartItems.map(item => ({
                    menuItemId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    image: item.image,
                    restaurant: item.restaurant
                })),
                deliveryAddress,
                customerNotes: customerDetails.notes || '',
                deliveryInstructions: customerDetails.deliveryInstructions || ''
            };

            const response = await fetch(`${this.baseUrl}/api/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(orderPayload)
            });

            if (!response.ok) {
                throw new Error('Failed to create order');
            }

            const orderResult = await response.json();
            
            return {
                orderId: orderResult.order.id,
                orderNumber: orderResult.order.orderNumber,
                total: finalTotal,
                customerName: customerDetails.name,
                customerEmail: customerDetails.email,
                customerPhone: customerDetails.phone,
                deliveryAddress: deliveryAddress
            };

        } catch (error) {
            console.error('Error creating order:', error);
            throw error;
        }
    }

    // Update Order Payment Status
    async updateOrderPaymentStatus(orderId, paymentId, status) {
        try {
            await fetch(`${this.baseUrl}/api/orders/${orderId}/payment-status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    paymentId,
                    paymentStatus: status
                })
            });
        } catch (error) {
            console.error('Error updating order payment status:', error);
        }
    }

    // Get Payment History
    async getPaymentHistory(page = 1, limit = 10) {
        try {
            const response = await fetch(`${this.baseUrl}/api/payments/history?page=${page}&limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch payment history');
            }

            return await response.json();

        } catch (error) {
            console.error('Error fetching payment history:', error);
            throw error;
        }
    }

    // Utility Methods
    clearCart() {
        localStorage.removeItem('cartItems');
        // Also clear from cart manager if available
        if (typeof cartManager !== 'undefined') {
            cartManager.clearCart();
        }
    }

    showLoadingState(show) {
        const checkoutBtn = document.getElementById('completeOrderBtn');
        const loadingSpinner = document.getElementById('paymentLoading');
        
        if (checkoutBtn) {
            checkoutBtn.disabled = show;
            checkoutBtn.innerHTML = show ? 
                '<i class="fas fa-spinner fa-spin mr-2"></i>Processing Payment...' : 
                'Complete Order';
        }
        
        if (loadingSpinner) {
            loadingSpinner.style.display = show ? 'flex' : 'none';
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
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
        }, 4000);
    }

    // Update token when user logs in
    updateToken(token) {
        this.token = token;
    }
}

// Initialize payment manager
window.paymentManager = new PaymentManager();

// Make available globally for checkout page
window.PaymentManager = PaymentManager;