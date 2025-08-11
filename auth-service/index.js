require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Auth DB connected'));

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Nodemailer setup (Gmail SMTP with app password)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL, // your gmail
    pass: process.env.SMTP_PASS   // your app password
  }
});

// Send or Resend OTP
app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  let user = await User.findOne({ email });
  const now = new Date();

  // Resend logic: allow resend only after 30s
  if (user && user.lastOtpSent && now - user.lastOtpSent < 30 * 1000) {
    const wait = 30 - Math.floor((now - user.lastOtpSent) / 1000);
    return res.status(429).json({ error: `Please wait ${wait}s before resending OTP.` });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(now.getTime() + 10 * 60 * 1000); // 10 min

  console.log(`[OTP DEBUG] Generated OTP for ${email}: ${otp}`);

  if (!user) {
    user = await User.create({ email, otp, otpExpires, lastOtpSent: now });
  } else {
    user.otp = otp;
    user.otpExpires = otpExpires;
    user.lastOtpSent = now;
    await user.save();
  }

  // Send OTP email
  await transporter.sendMail({
    from: process.env.SMTP_EMAIL,
    to: email,
    subject: 'Your VitalBites Login OTP',
    text: `Your OTP is ${otp}. It is valid for 10 minutes.`,
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#f9fafb;border-radius:12px;border:1px solid #eee;">
        <h2 style="color:#ff8800;text-align:center;margin-bottom:16px;">VitalBites Login Verification</h2>
        <p style="font-size:16px;color:#222;text-align:center;">Hello,</p>
        <p style="font-size:16px;color:#222;text-align:center;">
          Use the following <b style="font-size:22px;letter-spacing:2px;color:#ff8800;">OTP</b> to log in to your VitalBites account:
        </p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#ff8800;text-align:center;margin:24px 0;">
          ${otp}
        </div>
        <p style="font-size:15px;color:#444;text-align:center;">
          This OTP is valid for <b>10 minutes</b>.<br>
          If you did not request this, you can safely ignore this email.
        </p>
        <hr style="margin:24px 0;">
        <p style="font-size:13px;color:#888;text-align:center;">Thank you for using VitalBites!</p>
      </div>
    `
  }, (err, info) => {
    if (err) {
      console.error(`[OTP] Failed to send email to ${email}:`, err);
    } else {
      console.log(`[OTP] Email sent to ${email}:`, info.response);
    }
  });

  res.json({ message: "OTP sent" });
});

// OTP Verification
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Missing fields" });

  const user = await User.findOne({ email });
  if (!user || user.otp !== otp || user.otpExpires < new Date()) {
    console.log(`OTP verification failed for: ${email}`);
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  console.log(`OTP verified successfully for: ${email}`);

  // Check if user is new (no username or mobile)
  if (!user.username || !user.mobile) {
    console.log(`New user detected: ${email}. Showing registration form.`);
    return res.json({
      needDetails: true,
      isNewUser: true,
      message: "Please complete your registration"
    });
  }

  // Existing user: login directly
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
  console.log(`Existing user login: ${email}`);
  res.json({
    token,
    userId: user._id,
    username: user.username,
    mobile: user.mobile,
    role: user.role
  });
});

// Complete registration for new user
app.post('/api/auth/complete-registration', async (req, res) => {
  const { email, username, mobile } = req.body;

  // Validate input
  if (!email || !username || !mobile) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Validate username (letters only, 2-50 characters)
  const namePattern = /^[a-zA-Z\s]{2,50}$/;
  if (!namePattern.test(username.trim())) {
    return res.status(400).json({ error: "Name must contain only letters and be 2-50 characters long" });
  }

  // Validate Indian mobile number (+91 followed by 10 digits starting with 6-9)
  const mobilePattern = /^\+91[6-9]\d{9}$/;
  if (!mobilePattern.test(mobile)) {
    return res.status(400).json({ error: "Mobile number must be in format +91XXXXXXXXXX and start with 6-9" });
  }

  try {
    // Check if mobile is already used by another user
    const existingMobile = await User.findOne({ 
      mobile: mobile,
      email: { $ne: email } // Not the current user
    });
    
    if (existingMobile) {
      return res.status(400).json({ 
        error: "This mobile number is already registered with another account" 
      });
    }
    
    // Continue with registration...
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const wasNewUser = !user.username || !user.mobile;

    user.username = username.trim();
    user.mobile = mobile;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    if (wasNewUser) {
      console.log(`New user registered: ${email}, Name: ${username}, Mobile: ${mobile}`);
    } else {
      console.log(`User completed registration: ${email}, Name: ${username}, Mobile: ${mobile}`);
    }

    res.json({
      token,
      userId: user._id,
      username: user.username,
      mobile: user.mobile,
      role: user.role
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({ error: "Server error during registration" });
  }
});

// Verify JWT
app.get('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ user: decoded });
  } catch (e) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Debug endpoint to check user status (remove in production)
app.get('/api/auth/debug-user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ exists: false, message: 'User not found' });
    }

    const now = new Date();
    const otpValid = user.otp && user.otpExpires && user.otpExpires > now;

    res.json({
      exists: true,
      email: user.email,
      hasUsername: !!user.username,
      hasMobile: !!user.mobile,
      currentOtp: user.otp,
      otpValid,
      otpExpires: user.otpExpires,
      needsDetails: !user.username || !user.mobile
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// JWT Middleware for protected routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ===== ADDRESS MANAGEMENT ENDPOINTS =====

// Get all addresses for a user
app.get('/api/auth/addresses', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('addresses');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ addresses: user.addresses || [] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add new address
app.post('/api/auth/addresses', authenticateToken, async (req, res) => {
  try {
    const { fullName, mobile, street, city, state, pincode, deliveryInstructions, isDefault } = req.body;

    // Validation
    if (!fullName || !mobile || !street || !city || !state || !pincode) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    const newAddress = {
      fullName,
      mobile,
      street,
      city,
      state,
      pincode,
      deliveryInstructions,
      isDefault: isDefault || user.addresses.length === 0 // First address is default
    };

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json({
      message: 'Address added successfully',
      address: user.addresses[user.addresses.length - 1]
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update address
app.put('/api/auth/addresses/:addressId', authenticateToken, async (req, res) => {
  try {
    const { addressId } = req.params;
    const updates = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // If setting as default, unset other defaults
    if (updates.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    Object.assign(address, updates);
    await user.save();

    res.json({ message: 'Address updated successfully', address });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete address
app.delete('/api/auth/addresses/:addressId', authenticateToken, async (req, res) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const wasDefault = address.isDefault;
    address.deleteOne();

    // If deleted address was default, make first remaining address default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Set default address
app.put('/api/auth/addresses/:addressId/default', authenticateToken, async (req, res) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Unset all defaults
    user.addresses.forEach(addr => addr.isDefault = false);

    // Set new default
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    address.isDefault = true;
    await user.save();

    res.json({ message: 'Default address set successfully', address });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
app.put('/api/user/update-profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get updated data
    const { username, gender, dateOfBirth } = req.body;
    
    // Find and update user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Update fields - only name, gender and dateOfBirth can be changed
    user.username = username;
    
    // Only set gender if provided
    if (gender !== undefined) {
      user.gender = gender;
    }
    
    // Only set dateOfBirth if provided
    if (dateOfBirth !== undefined) {
      user.dateOfBirth = dateOfBirth;
    }
    
    await user.save();
    
    res.json({ success: true, message: "Profile updated successfully" });
    
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get user profile
app.get('/api/user/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }
    
    // Verify token and find user (existing code)...
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Format mobile number without +91 prefix
    const mobileDisplay = user.mobile ? user.mobile.replace('+91', '') : null;
    
    // Format user data for frontend
    const userData = {
      name: user.username || null,
      email: user.email || null,
      mobile: mobileDisplay,  // Mobile without +91 prefix
      gender: user.gender || null,
      dateOfBirth: user.dateOfBirth || null,
      createdAt: user.createdAt || new Date()
    };
    
    console.log(`Sending profile data for user ${user.email}:`, userData);
    res.json(userData);
    
  } catch (error) {
    console.error('Error in profile endpoint:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin endpoints for user management
app.get('/api/auth/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('-otp -otpExpires -password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await User.countDocuments(query);
    
    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/auth/admin/users/count', async (req, res) => {
  try {
    const total = await User.countDocuments();
    const thisMonth = await User.countDocuments({
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    });
    
    res.json({ total, thisMonth });
  } catch (error) {
    console.error('Error getting user count:', error);
    res.status(500).json({ error: 'Failed to get user count' });
  }
});

// JWT Middleware for protected routes
const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Auth Service is running' });
});

app.listen(5000, () => console.log('Auth Service on 5000'));

