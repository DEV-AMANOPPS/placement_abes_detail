require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const { PDFParse: pdfParse } = require('pdf-parse');
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
    const host = req.headers.host || '';
    
    // Skip for localhost/development and main domain - public routes
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]') || host.includes(':3000');
    if (isLocalhost || host === 'app.placement.com' || host === 'placement.com') {
      return next();
    }

    // Improved subdomain extraction
    const parts = host.split('.');
    if (parts.length < 2) return next();
    
    const subdomain = parts[0];
    const organization = await Organization.findOne({ domain: subdomain });
    if (!organization) {
      // If we're on a subdomain that doesn't exist, we might want to redirect or error
      // For now, just continue without req.organization
      return next();
    }

    req.organization = organization;
    next();
  } catch (err) {
    console.error('getOrganization error:', err);
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
// Expanded Resume Analysis Keywords and Scoring
const ATS_KEYWORDS = {
  technical: {
    languages: ['javascript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'php', 'swift', 'kotlin', 'typescript', 'sql', 'html', 'css', 'sass', 'less'],
    frameworks: ['react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'rails', 'spring boot', '.net', 'laravel', 'bootstrap', 'tailwind', 'next.js', 'nuxt.js', 'svelte', 'fastapi'],
    database: ['mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'sqlite', 'mariadb', 'oracle', 'cassandra', 'dynamodb', 'firebase'],
    cloud: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'terraform', 'ansible', 'linux', 'unix', 'nginx', 'apache', 'cicd', 'gitlab', 'github actions', 'cloud computing'],
    data: ['machine learning', 'artificial intelligence', 'ai', 'deep learning', 'nlp', 'computer vision', 'data science', 'statistics', 'tableau', 'power bi', 'pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch'],
    concepts: ['api', 'rest', 'graphql', 'microservices', 'agile', 'scrum', 'testing', 'qa', 'sdlc', 'oops', 'data structures', 'algorithms', 'git', 'version control', 'security', 'penetration testing', 'web sockets']
  },
  soft: [
    'communication', 'teamwork', 'leadership', 'problem solving', 'analytical',
    'time management', 'adaptability', 'creativity', 'collaboration', 'initiative',
    'critical thinking', 'public speaking', 'negotiation', 'customer service', 'project management',
    'mentorship', 'strategic planning', 'decision making', 'attention to detail'
  ],
  education: [
    'bachelor', 'master', 'phd', 'degree', 'gpa', 'cgpa', 'graduation', 'university',
    'college', 'engineering', 'computer science', 'information technology', 'software engineering'
  ]
};

const ACTION_VERBS = [
  'achieved', 'acquired', 'adapted', 'addressed', 'administered', 'advised', 'analyzed', 'arranged', 'assembled', 'assessed',
  'authored', 'budgeted', 'built', 'calculated', 'centralized', 'clarified', 'collaborated', 'combined', 'communicated',
  'completed', 'composed', 'computed', 'conceptualized', 'conducted', 'consolidated', 'constructed', 'consulted', 'contacted',
  'contributed', 'coordinated', 'corresponded', 'counseled', 'created', 'critiqued', 'cultivated', 'customized', 'debugged',
  'decided', 'defined', 'delegated', 'delivered', 'demonstrated', 'designed', 'detailed', 'determined', 'developed', 'devised',
  'directed', 'discovered', 'displayed', 'distributed', 'documented', 'drafted', 'drove', 'edited', 'educated', 'eliminated',
  'enabled', 'encouraged', 'engineered', 'enlisted', 'established', 'estimated', 'evaluated', 'examined', 'executed', 'expanded',
  'expedited', 'explained', 'fabricated', 'facilitated', 'fostered', 'founded', 'generated', 'governed', 'guided', 'handled',
  'harmonized', 'helped', 'identified', 'illustrated', 'implemented', 'improved', 'increased', 'influenced', 'informed',
  'initiated', 'inspected', 'inspired', 'installed', 'instituted', 'instructed', 'integrated', 'interpreted', 'introduced',
  'invented', 'investigated', 'joined', 'launched', 'lectured', 'led', 'maintained', 'managed', 'mapped', 'marketed',
  'mediated', 'mentored', 'modeled', 'modified', 'monitored', 'motivated', 'negotiated', 'observed', 'obtained', 'operated',
  'optimized', 'orchestrated', 'ordered', 'organized', 'originated', 'overhauled', 'oversaw', 'participated', 'performed',
  'persuaded', 'photographed', 'pioneered', 'planned', 'prepared', 'presented', 'prioritized', 'processed', 'produced',
  'programmed', 'projected', 'promoted', 'proofread', 'proposed', 'protected', 'provided', 'publicized', 'purchased',
  'recorded', 'recruited', 'reduced', 'referred', 'regulated', 'rehabilitated', 'remodeled', 'repaired', 'replaced', 'reported',
  'represented', 'researched', 'resolved', 'responded', 'restructured', 'retrieved', 'reviewed', 'revised', 'revitalized',
  'scheduled', 'screened', 'selected', 'served', 'shaped', 'simplified', 'simulated', 'sketched', 'solved', 'sorted',
  'spearheaded', 'specialized', 'sponsored', 'staffed', 'standardized', 'stimulated', 'streamlined', 'strengthened', 'structured',
  'studied', 'supervised', 'supported', 'surveyed', 'synthesized', 'tabulated', 'taught', 'trained', 'translated', 'upgraded',
  'validated', 'visited', 'wrote'
];

const INDUSTRY_KEYWORDS = {
  software: ['software engineer', 'developer', 'programmer', 'coding', 'full stack', 'backend', 'frontend', 'sde'],
  data: ['data analyst', 'data scientist', 'machine learning', 'ai', 'statistics', 'analytics', 'data engineer'],
  web: ['web developer', 'ui/ux', 'frontend', 'react', 'angular', 'vue', 'web design'],
  mobile: ['mobile developer', 'ios', 'android', 'flutter', 'react native', 'mobile app'],
  cloud: ['cloud engineer', 'devops', 'aws associate', 'azure expert', 'sre', 'reliability engineer']
};

function analyzeResume(text) {
  const lowerText = text.toLowerCase();
  const words = text.split(/\s+/);
  
  // 1. ADVANCED STRUCTURAL ANALYSIS (20 pts)
  const structuralMetrics = {
    hasEmail: /[\w\.-]+@[\w\.-]+\.\w{2,}/.test(text),
    hasPhone: /\b\d{10}\b|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(text),
    hasLinkedIn: /linkedin\.com\/in\/[\w-]+/i.test(text),
    hasGithub: /github\.com\/[\w-]+/i.test(text),
    hasPortfolio: /portfolio|personal site|website/i.test(text) || /(www\.)?[\w-]+\.(com|io|me|dev|net)\b/i.test(text),
    
    hasSummary: /summary|objective|profile|professional profile/i.test(text),
    hasExperience: /experience|work history|employment|work experience/i.test(text),
    hasEducation: /education|academic background|degree/i.test(text),
    hasSkills: /skills|technical skills|competencies|technologies/i.test(text),
    hasProjects: /projects|academic projects|personal projects/i.test(text),
    hasCertifications: /certifications?|awards?|honors?|certificates?/i.test(text)
  };

  let structuralScore = 0;
  if (structuralMetrics.hasEmail && structuralMetrics.hasPhone) structuralScore += 4;
  if (structuralMetrics.hasLinkedIn) structuralScore += 3;
  if (structuralMetrics.hasGithub || structuralMetrics.hasPortfolio) structuralScore += 3;
  if (structuralMetrics.hasSummary) structuralScore += 2;
  if (structuralMetrics.hasExperience) structuralScore += 2;
  if (structuralMetrics.hasEducation) structuralScore += 2;
  if (structuralMetrics.hasSkills) structuralScore += 2;
  if (structuralMetrics.hasProjects || structuralMetrics.hasCertifications) structuralScore += 2;

  // 2. TECHNICAL KEYWORD DEPTH (30 pts)
  let foundKeywords = { technical: [], soft: [], education: [], industry: [], technicalByCat: {} };
  let keywordPoints = 0;
  
  // Evaluate Technical Skills (Languages, Frameworks, etc.)
  let techCategoriesFound = 0;
  Object.keys(ATS_KEYWORDS.technical).forEach(cat => {
    let foundInCat = [];
    ATS_KEYWORDS.technical[cat].forEach(kw => {
      if (lowerText.includes(kw.toLowerCase())) {
        foundInCat.push(kw);
      }
    });
    if (foundInCat.length > 0) {
      techCategoriesFound++;
      foundKeywords.technical.push(...foundInCat);
      foundKeywords.technicalByCat[cat] = {
        found: foundInCat,
        total: ATS_KEYWORDS.technical[cat].length
      };
      console.log(`[DEBUG] Category Found: ${cat}`, foundInCat);
      keywordPoints += Math.min(foundInCat.length * 1, 5); 
    }
  });
  console.log(`[DEBUG] Technical Keywords Grouped:`, Object.keys(foundKeywords.technicalByCat));
  
  // Score Technical Keywords (Max 30)
  const keywordScore = Math.min((keywordPoints + (techCategoriesFound * 2)), 30);

  // 3. SOFT SKILLS & EDUCATION (Evaluated as part of keywords or bonus)
  ATS_KEYWORDS.soft.forEach(kw => {
    if (lowerText.includes(kw.toLowerCase())) foundKeywords.soft.push(kw);
  });
  ATS_KEYWORDS.education.forEach(kw => {
    if (lowerText.includes(kw.toLowerCase())) foundKeywords.education.push(kw);
  });

  // 4. INDUSTRY ALIGNMENT (5 pts bonus included in final calc)
  let industryMatch = 'General';
  let maxIndustryScore = 0;
  Object.keys(INDUSTRY_KEYWORDS).forEach(industry => {
    const matches = INDUSTRY_KEYWORDS[industry].filter(kw => lowerText.includes(kw.toLowerCase())).length;
    foundKeywords.industry.push(...INDUSTRY_KEYWORDS[industry].filter(kw => lowerText.includes(kw.toLowerCase())));
    if (matches > maxIndustryScore) {
      maxIndustryScore = matches;
      industryMatch = industry.charAt(0).toUpperCase() + industry.slice(1);
    }
  });
  const industryScore = Math.min(maxIndustryScore * 1, 5);

  // 5. ACTION VERBS (15 pts)
  const foundVerbs = ACTION_VERBS.filter(verb => lowerText.includes(verb));
  const uniqueVerbs = new Set(foundVerbs);
  const actionScore = Math.min(uniqueVerbs.size * 1, 15);

  // 6. QUANTIFIABLE IMPACT & METRICS (20 pts)
  const metricPatterns = [
    /\d+%/g, // Percentages
    /\$[\d,MKB]+/g, // Money
    /\b\d+\+\s+(users|clients|projects|tasks|team members)\b/gi, // X+ users/etc
    /\b(increased|reduced|improved|saved|delivered)\s+[\w\s]{0,20}\d+/gi, // Action + Number
    /\b(million|billion|k)\b/gi // Scale indicators
  ];
  let metricCount = 0;
  metricPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) metricCount += matches.length;
  });
  const quantifiableScore = Math.min(metricCount * 3, 20);

  // 7. READABILITY & FORMAT (10 pts)
  const wordCount = words.length;
  let readabilityScore = 0;
  if (wordCount >= 400 && wordCount <= 800) readabilityScore = 10;
  else if (wordCount >= 300 && wordCount < 900) readabilityScore = 7;
  else if (wordCount > 150) readabilityScore = 4;
  else readabilityScore = 1;

  // FINAL ATS SCORE CALCULATION (Weighted)
  const atsScore = Math.min(Math.round(
    structuralScore +      // 20
    keywordScore +         // 30
    actionScore +          // 15
    quantifiableScore +    // 20
    readabilityScore +     // 10
    industryScore          // 5 (Bonus/Alignment)
  ), 100);

  // Generate Suggestions
  const suggestions = [];
  if (!structuralMetrics.hasEmail || !structuralMetrics.hasPhone) suggestions.push("CRITICAL: Add standardized contact info (email/phone).");
  if (!structuralMetrics.hasLinkedIn) suggestions.push("Add your LinkedIn profile to increase recruiter trust.");
  if (!structuralMetrics.hasGithub && industryMatch === 'Software') suggestions.push("Github link is highly recommended for developers.");
  
  if (quantifiableScore < 10) suggestions.push("Use more numbers and percentages (e.g., 'Improved performance by 20%') to show impact.");
  if (actionScore < 8) suggestions.push("Start bullet points with strong action verbs (e.g., 'Spearheaded', 'Orchestrated').");
  if (keywordScore < 15) suggestions.push("Keywords are sparse. Audit your tech stack and add specific tools/libraries you know.");
  
  if (wordCount < 400) suggestions.push("Resume is light (under 400 words). Expand on your project responsibilities.");
  if (wordCount > 1000) suggestions.push("Resume is overly long. Condense sections to keep it to 1-2 pages maximum.");

  // Strengths
  const strengths = [];
  if (atsScore >= 80) strengths.push("Strong candidate match with excellent keyword density.");
  if (actionScore >= 12) strengths.push("Exceptional use of strong action verbs.");
  if (quantifiableScore >= 15) strengths.push("Highly data-driven resume with clear achievement metrics.");
  if (structuralScore >= 18) strengths.push("Professional formatting with all critical sections present.");
  if (industryScore >= 3) strengths.push(`Well-calibrated for the ${industryMatch} industry.`);

  return {
    atsScore,
    breakdown: {
      keywordScore: keywordScore,
      structureScore: structuralScore,
      contentScore: actionScore + quantifiableScore,
      industryScore: industryScore,
      readabilityScore: readabilityScore
    },
    strengths,
    suggestions,
    keywords: {
      technical: [...new Set(foundKeywords.technical)],
      soft: [...new Set(foundKeywords.soft)],
      industry: [...new Set(foundKeywords.industry)],
      technicalByCat: foundKeywords.technicalByCat
    },
    metrics: {
      wordCount,
      actionVerbs: uniqueVerbs.size,
      quantifiableAchievements: metricCount,
      relevanceRank: industryMatch
    },
    industry: industryMatch,
    grade: atsScore >= 90 ? 'A+' : atsScore >= 80 ? 'A' : atsScore >= 70 ? 'B+' :
           atsScore >= 60 ? 'B' : atsScore >= 50 ? 'C+' : atsScore >= 40 ? 'C' : 'D',
    structuralMetrics
  };
}

const app = express();
app.use(express.json());
app.use(cors());
app.use(getOrganization); // Add organization middleware

// Serve HTML contents from the frontend directory
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ----------------------------------------
// API ROUTES
// ----------------------------------------

// 1. Get application stats
app.get('/api/stats', async (req, res) => {
  try {
    const stats = {};
    
    // Global stats (accessible to everyone or just super admins? assuming public for now)
    stats.global = {
      totalOrganizations: await Organization.countDocuments(),
      totalUsers: await User.countDocuments()
    };

    // Organization-specific stats if context is available
    if (req.organization) {
      const orgId = req.organization._id;
      const userCount = await User.countDocuments({ organizationId: orgId, isActive: true });
      const activeUsers = await User.countDocuments({
        organizationId: orgId,
        isActive: true,
        lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      stats.organization = {
        name: req.organization.name,
        totalUsers: userCount,
        activeUsers,
        plan: req.organization.plan,
        subscriptionStatus: req.organization.subscriptionStatus
      };
    }

    res.json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. Public registration/login

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'User already exists' });

    // Basic fake user detection (block obvious disposable/test emails)
    const fakePatterns = [/test/i, /mailinator\.com$/i, /tempmail/i];
    if (fakePatterns.some((pat) => pat.test(email))) {
      return res.status(400).json({ error: 'Fake or disposable email detected' });
    }

    const hashed = await bcrypt.hash(password, 10);
    
    const userPayload = { 
      name, 
      email, 
      password: hashed, 
      isActive: true 
    };

    // Associate with organization if registering on a subdomain
    if (req.organization) {
      userPayload.organizationId = req.organization._id;
    }

    const user = new User(userPayload);
    await user.save();
    res.json({ message: 'Registration successful' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email, isActive: true });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email,
        name: user.name,
        role: user.role, 
        organizationId: user.organizationId 
      }, 
      JWT_SECRET, 
      { expiresIn: '1d' }
    );
    
    // Update lastLogin
    user.lastLogin = new Date();
    await user.save();
    res.json({ message: 'Login successful', token, role: user.role, name: user.name });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin route: remove fake users matching simple patterns
app.delete('/api/admin/remove-fake-users', async (req, res) => {
  try {
    const fakePatterns = ['test', 'mailinator.com', 'tempmail'];
    const orClauses = fakePatterns.map(p => ({ email: { $regex: p, $options: 'i' } }));
    const result = await User.deleteMany({ $or: orClauses });
    res.json({ removed: result.deletedCount });
  } catch (err) {
    console.error('Remove fake users error:', err);
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
app.post('/api/resume/analyze', upload.single('resume'), async (req, res) => {
  try {
    let resumeText = '';

    if (req.file) {
      // Handle file upload
      if (req.file.mimetype === 'application/pdf') {
        console.log('Processing PDF resume, buffer size:', req.file.buffer.length);
        try {
          const parser = new pdfParse({ data: req.file.buffer });
          const data = await parser.getText();
          resumeText = data.text;
          console.log('PDF text extracted, length:', resumeText ? resumeText.length : 0);
          await parser.destroy();
        } catch (parseErr) {
          console.error('PDF parsing failed:', parseErr);
          throw parseErr;
        }
      } else if (req.file.mimetype === 'text/plain') {
        resumeText = req.file.buffer.toString('utf-8');
        console.log('Text resume processed, length:', resumeText.length);
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
    console.log('Analyzing resume text...');
    const analysis = analyzeResume(resumeText);
    console.log('Analysis complete. ATS Score:', analysis.atsScore);

    res.json({
      success: true,
      analysis,
      message: 'Resume analyzed successfully'
    });

  } catch (err) {
    console.error('Detailed Resume analysis error:', err);
    res.status(500).json({ 
      error: 'Failed to analyze resume', 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
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

// Fallback all non-API routes to index.html in the frontend directory
app.use((req, res) => {
  console.log(`Catch-all handler: ${req.method} ${req.path}`);
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('\nAvailable API routes:');
  console.log('--------------------');
  console.log('GET  /api/stats');
  console.log('POST /api/auth/register');
  console.log('POST /api/auth/login');
  console.log('GET  /api/organization (Auth)');
  console.log('PUT  /api/organization (Auth)');
  console.log('GET  /api/organization/users (Auth)');
  console.log('PUT  /api/users/:userId/role (Auth)');
  console.log('GET  /api/subscription (Auth)');
  console.log('POST /api/subscription/upgrade (Auth)');
  console.log('POST /api/resume/analyze');
  console.log('GET  /api/resume/history (Auth)');
  console.log('--------------------\n');
});
