require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const natural = require('natural');

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
    
    // Skip for localhost/development and main domain - public routes
    if (host.includes('localhost') || host.includes('127.0.0.1') || host === 'app.placement.com') {
      return next();
    }

    const subdomain = host.split('.')[0];
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

// Multer configuration for file uploads
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and text files are allowed'));
    }
  }
});

// Resume Analysis Keywords and Scoring
const ATS_KEYWORDS = {
  technical: [
    'javascript', 'python', 'java', 'c++', 'react', 'node.js', 'html', 'css', 'sql',
    'git', 'docker', 'aws', 'linux', 'api', 'database', 'algorithm', 'data structure',
    'machine learning', 'ai', 'cloud', 'devops', 'agile', 'scrum', 'testing'
  ],
  soft: [
    'communication', 'teamwork', 'leadership', 'problem solving', 'analytical',
    'time management', 'adaptability', 'creativity', 'collaboration', 'initiative'
  ],
  education: [
    'bachelor', 'master', 'phd', 'degree', 'gpa', 'cgpa', 'graduation', 'university',
    'college', 'engineering', 'computer science', 'information technology'
  ],
  experience: [
    'internship', 'project', 'developed', 'implemented', 'managed', 'led',
    'achieved', 'improved', 'created', 'designed', 'built'
  ]
};

const INDUSTRY_KEYWORDS = {
  software: ['software engineer', 'developer', 'programmer', 'coding', 'full stack', 'backend', 'frontend'],
  data: ['data analyst', 'data scientist', 'machine learning', 'ai', 'statistics', 'analytics'],
  web: ['web developer', 'ui/ux', 'frontend', 'react', 'angular', 'vue'],
  mobile: ['mobile developer', 'ios', 'android', 'flutter', 'react native']
};

function analyzeResume(text) {
  const lowerText = text.toLowerCase();
  const words = text.split(/\s+/);
  const sentences = text.split(/[.!?]+/);

  // Basic structure analysis
  const hasContact = /\b[\w\.-]+@[\w\.-]+\.\w{2,}\b|\b\d{10}\b|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text);
  const hasSummary = /summary|objective|profile/i.test(text);
  const hasExperience = /experience|work|employment|internship/i.test(text);
  const hasEducation = /education|degree|university|college/i.test(text);
  const hasSkills = /skills|technologies|tools/i.test(text);
  const hasProjects = /projects?|portfolio/i.test(text);

  // Keyword analysis
  let keywordScore = 0;
  let foundKeywords = { technical: [], soft: [], education: [], experience: [] };

  Object.keys(ATS_KEYWORDS).forEach(category => {
    ATS_KEYWORDS[category].forEach(keyword => {
      if (lowerText.includes(keyword.toLowerCase())) {
        keywordScore += 2;
        foundKeywords[category].push(keyword);
      }
    });
  });

  // Industry-specific analysis
  let industryMatch = 'general';
  let industryScore = 0;
  Object.keys(INDUSTRY_KEYWORDS).forEach(industry => {
    const matches = INDUSTRY_KEYWORDS[industry].filter(kw =>
      lowerText.includes(kw.toLowerCase())
    ).length;
    if (matches > industryScore) {
      industryScore = matches;
      industryMatch = industry;
    }
  });

  // Length and formatting analysis
  const wordCount = words.length;
  const pageEstimate = Math.ceil(wordCount / 300); // Rough estimate
  const lengthScore = wordCount > 200 && wordCount < 800 ? 20 : wordCount < 200 ? 5 : 10;

  // Action verb analysis
  const actionVerbs = ['developed', 'created', 'implemented', 'managed', 'led', 'achieved',
                      'improved', 'designed', 'built', 'launched', 'optimized', 'increased'];
  const actionVerbCount = actionVerbs.filter(verb => lowerText.includes(verb)).length;
  const actionScore = Math.min(actionVerbCount * 3, 15);

  // Quantifiable achievements
  const quantifiablePatterns = [/\d+%/, /\$\d+/, /\d+ (users|customers|projects|tasks)/i];
  const quantifiableCount = quantifiablePatterns.filter(pattern => pattern.test(text)).length;
  const quantifiableScore = Math.min(quantifiableCount * 5, 15);

  // Calculate ATS score (0-100)
  const atsScore = Math.min(Math.round(
    (keywordScore * 0.4) +
    (lengthScore * 0.2) +
    (actionScore * 0.15) +
    (quantifiableScore * 0.15) +
    ((hasContact && hasSummary && hasExperience && hasEducation && hasSkills) ? 10 : 5) +
    (industryScore * 2)
  ), 100);

  // Generate suggestions
  const suggestions = [];

  if (!hasContact) suggestions.push("Add contact information (email, phone) at the top");
  if (!hasSummary) suggestions.push("Include a professional summary/objective (2-3 sentences)");
  if (!hasExperience) suggestions.push("Add work experience section with job descriptions");
  if (!hasEducation) suggestions.push("Include education details with degree and institution");
  if (!hasSkills) suggestions.push("Add a skills section with relevant technologies");
  if (!hasProjects) suggestions.push("Include projects section to showcase practical experience");

  if (keywordScore < 20) suggestions.push("Add more industry-specific keywords relevant to your target roles");
  if (actionVerbCount < 3) suggestions.push("Use more action verbs (developed, created, implemented, managed, led)");
  if (quantifiableCount < 2) suggestions.push("Include quantifiable achievements with numbers and percentages");
  if (wordCount < 200) suggestions.push("Resume is too short - aim for 300-600 words");
  if (wordCount > 800) suggestions.push("Resume is too long - keep it concise and relevant");

  // Strengths
  const strengths = [];
  if (atsScore >= 80) strengths.push("Excellent ATS compatibility with strong keyword presence");
  if (actionVerbCount >= 5) strengths.push("Good use of action verbs demonstrating achievements");
  if (quantifiableCount >= 3) strengths.push("Strong quantifiable achievements showing impact");
  if (hasContact && hasSummary && hasExperience && hasEducation && hasSkills && hasProjects) {
    strengths.push("Complete resume structure with all essential sections");
  }
  if (industryScore >= 3) strengths.push(`Well-aligned with ${industryMatch} industry requirements`);

  return {
    atsScore,
    breakdown: {
      keywordScore: Math.min(keywordScore, 40),
      structureScore: (hasContact && hasSummary && hasExperience && hasEducation && hasSkills) ? 20 : 10,
      contentScore: lengthScore + actionScore + quantifiableScore,
      industryScore: Math.min(industryScore * 2, 10)
    },
    strengths,
    suggestions,
    keywords: foundKeywords,
    metrics: {
      wordCount,
      pageEstimate,
      actionVerbs: actionVerbCount,
      quantifiableAchievements: quantifiableCount,
      keywordMatches: Object.values(foundKeywords).flat().length
    },
    industry: industryMatch,
    grade: atsScore >= 90 ? 'A+' : atsScore >= 80 ? 'A' : atsScore >= 70 ? 'B+' :
           atsScore >= 60 ? 'B' : atsScore >= 50 ? 'C+' : atsScore >= 40 ? 'C' : 'D'
  };
}

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
      // For localhost/development, create or use default ABES organization
      if (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1')) {
        organization = await Organization.findOne({ domain: 'abes' });
        if (!organization) {
          organization = new Organization({
            name: 'ABES Engineering College',
            domain: 'abes',
            plan: 'free'
          });
          await organization.save();
        }
      } else {
        // Production: require organization details
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

// ----------------------------------------
// RESUME ANALYSIS ROUTES
// ----------------------------------------

// 10. Analyze resume
app.post('/api/resume/analyze', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    let resumeText = '';

    if (req.file) {
      // Handle file upload
      if (req.file.mimetype === 'application/pdf') {
        const data = await pdfParse(req.file.buffer);
        resumeText = data.text;
      } else if (req.file.mimetype === 'text/plain') {
        resumeText = req.file.buffer.toString('utf-8');
      }
    } else if (req.body.text) {
      // Handle text input
      resumeText = req.body.text;
    } else {
      return res.status(400).json({ error: 'No resume content provided' });
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Resume content is too short or empty' });
    }

    // Analyze the resume
    const analysis = analyzeResume(resumeText);

    // Update user's resume score in database
    await User.findByIdAndUpdate(req.user.id, {
      resumeScore: analysis.atsScore,
      lastLogin: new Date()
    });

    res.json({
      success: true,
      analysis,
      message: 'Resume analyzed successfully'
    });

  } catch (err) {
    console.error('Resume analysis error:', err);
    res.status(500).json({ error: 'Failed to analyze resume' });
  }
});

// 11. Get user's resume analysis history
app.get('/api/resume/history', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('resumeScore profile');
    res.json({
      currentScore: user.resumeScore || 0,
      profile: user.profile || {}
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Fallback all non-API routes to index (for SPA routing if needed)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
