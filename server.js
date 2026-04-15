require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

const User = require('./models/User');
const Organization = require('./models/Organization');
const Subscription = require('./models/Subscription');

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://chaurasiaaman709_db_user:aman1234@cluster0.pciaiwd.mongodb.net/?appName=Cluster0';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.log('MongoDB connection error:', err));

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_123';

// Middleware to get organization from subdomain
const getOrganization = async (req, res, next) => {
  try {
    const host = req.headers.host;
    const subdomain = host.split('.')[0];

    // Skip for main domain (app.placement.com) - public routes
    if (subdomain === 'app' || subdomain === 'localhost:3000' || subdomain === '127.0.0.1:3000') {
      return next();
    }

    const organization = await Organization.findOne({ domain: subdomain });
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    req.organization = organization;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const app = express();
app.use(express.json());
app.use(cors());
app.use(getOrganization); // Add organization middleware

// Serve HTML contents
app.use(express.static(path.join(__dirname)));

// ----------------------------------------
// API ROUTES
// ----------------------------------------

// 1. Get application stats
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    if (!req.organization) {
      // Public stats for main domain
      const totalOrgs = await Organization.countDocuments();
      const totalUsers = await User.countDocuments();
      return res.json({ totalOrganizations: totalOrgs, totalUsers });
    }

    // Organization-specific stats
    const userCount = await User.countDocuments({ organizationId: req.organization._id, isActive: true });
    const activeUsers = await User.countDocuments({
      organizationId: req.organization._id,
      isActive: true,
      lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });

    res.json({
      totalUsers: userCount,
      activeUsers,
      plan: req.organization.plan,
      subscriptionStatus: req.organization.subscriptionStatus
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, organizationName, organizationDomain } = req.body;

    // Check if user already exists
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    let organization;
    if (req.organization) {
      // Registering within existing organization
      organization = req.organization;
    } else {
      // Creating new organization
      if (!organizationName || !organizationDomain) {
        return res.status(400).json({ error: 'Organization name and domain are required' });
      }

      // Check if organization domain already exists
      const existingOrg = await Organization.findOne({ domain: organizationDomain });
      if (existingOrg) {
        return res.status(400).json({ error: 'Organization domain already exists' });
      }

      // Create new organization
      organization = new Organization({
        name: organizationName,
        domain: organizationDomain,
        plan: 'free'
      });
      await organization.save();
    }

    // Create user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      organizationId: organization._id,
      role: req.organization ? 'user' : 'owner' // First user is owner
    });
    await user.save();

    // Update organization stats
    await Organization.findByIdAndUpdate(organization._id, {
      $inc: { 'stats.totalUsers': 1, 'stats.activeUsers': 1 }
    });

    const token = jwt.sign(
      { id: user._id, organizationId: organization._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: {
          id: organization._id,
          name: organization.name,
          domain: organization.domain,
          plan: organization.plan
        }
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate('organizationId');
    if (!user || !user.isActive) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check organization context
    if (req.organization && req.organization._id.toString() !== user.organizationId._id.toString()) {
      return res.status(400).json({ error: 'Invalid credentials for this organization' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    const token = jwt.sign(
      { id: user._id, organizationId: user.organizationId._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: {
          id: user.organizationId._id,
          name: user.organizationId.name,
          domain: user.organizationId.domain,
          plan: user.organizationId.plan
        }
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------
// ORGANIZATION MANAGEMENT ROUTES
// ----------------------------------------

// 4. Get organization details
app.get('/api/organization', authenticateToken, async (req, res) => {
  try {
    const organization = await Organization.findById(req.user.organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.json(organization);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 5. Update organization
app.put('/api/organization', authenticateToken, async (req, res) => {
  try {
    // Only owners and admins can update organization
    if (!['owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const updates = req.body;
    const allowedUpdates = ['name', 'description', 'logo', 'website', 'industry', 'size', 'settings'];
    const filteredUpdates = {};

    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const organization = await Organization.findByIdAndUpdate(
      req.user.organizationId,
      filteredUpdates,
      { new: true }
    );

    res.json(organization);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 6. Get organization users
app.get('/api/organization/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.find({ organizationId: req.user.organizationId, isActive: true })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 7. Update user role
app.put('/api/users/:userId/role', authenticateToken, async (req, res) => {
  try {
    // Only owners and admins can update roles
    if (!['owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { role } = req.body;
    if (!['owner', 'admin', 'manager', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.userId, organizationId: req.user.organizationId },
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------
// SUBSCRIPTION MANAGEMENT ROUTES
// ----------------------------------------

// 8. Get subscription details
app.get('/api/subscription', authenticateToken, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ organizationId: req.user.organizationId })
      .sort({ createdAt: -1 });
    res.json(subscription || { plan: 'free', status: 'trial' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 9. Upgrade subscription plan
app.post('/api/subscription/upgrade', authenticateToken, async (req, res) => {
  try {
    // Only owners can manage subscriptions
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can manage subscriptions' });
    }

    const { plan } = req.body;
    if (!['basic', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const organization = await Organization.findById(req.user.organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Update organization plan
    organization.plan = plan;
    organization.subscriptionStatus = 'active';
    await organization.save();

    // Create or update subscription record
    let subscription = await Subscription.findOne({ organizationId: organization._id });
    if (subscription) {
      subscription.plan = plan;
      subscription.status = 'active';
      subscription.currentPeriodStart = new Date();
      subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      subscription.amount = plan === 'basic' ? 2900 : 9900; // $29 or $99 in cents
      await subscription.save();
    } else {
      subscription = new Subscription({
        organizationId: organization._id,
        plan,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        amount: plan === 'basic' ? 2900 : 9900, // $29 or $99 in cents
        currency: 'usd'
      });
      await subscription.save();
    }

    res.json({
      success: true,
      subscription,
      message: `Successfully upgraded to ${plan} plan`
    });
  } catch (err) {
    console.error('Subscription upgrade error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fallback all non-API routes to index (for SPA routing if needed)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
