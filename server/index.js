require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Jimp = require('jimp');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware 
// Increase payload limit to handle base64 images and audio notes
app.use(cors());

// Set Private Network Access header to allow public sites to fetch from localhost
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Private-Network", "true");
  next();
});

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// Admin UIDs
const ADMIN_UIDS = ['Fk0Yl77koDbTc8zklL4mDsu8CSJ2', 'SON9iSYEoEhUZQeiLfumvp7NwLF3'];

// In-Memory Database Fallback for Offline / Local Development
let isOfflineMode = false;
const memUsers = [
  {
    _id: 'offline_admin_id_1',
    firebaseUid: 'Fk0Yl77koDbTc8zklL4mDsu8CSJ2',
    email: 'hariharpradeepjaybal@gmail.com',
    name: 'Admin User 1',
    role: 'admin',
    approved: true,
    createdAt: new Date()
  },
  {
    _id: 'offline_admin_id_2',
    firebaseUid: 'SON9iSYEoEhUZQeiLfumvp7NwLF3',
    email: 'admin2@floravo.com',
    name: 'Admin User 2',
    role: 'admin',
    approved: true,
    createdAt: new Date()
  }
];
const memInviteCodes = [
  { _id: 'code1', code: 'FLORAVO-BETA-001', used: false, usedBy: null, createdAt: new Date() },
  { _id: 'code2', code: 'FLORAVO-BETA-002', used: false, usedBy: null, createdAt: new Date() },
  { _id: 'code3', code: 'FLORAVO-BETA-003', used: false, usedBy: null, createdAt: new Date() }
];
const memBouquets = [];

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
    seedInviteCodes();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    console.warn('⚠️ MongoDB failed to connect. Running in OFFLINE / LOCAL BYPASS mode with in-memory database.');
    isOfflineMode = true;
  });

// Schema Definition
const UserSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, default: '' },
    role: {
      type: String,
      enum: ['admin', 'user', 'pending'],
      default: 'pending'
    },
    approved: { type: Boolean, default: false },
    inviteCode: { type: String, default: null },
  },
  { timestamps: true }
);

const User = mongoose.model('User', UserSchema);

const InviteCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    used: { type: Boolean, default: false },
    usedBy: { type: String, default: null }, // firebaseUid
  },
  { timestamps: true }
);

const InviteCode = mongoose.model('InviteCode', InviteCodeSchema);

const BouquetSchema = new mongoose.Schema(
  {
    noteRecipient: { type: String, default: 'Beloved' },
    noteSender: { type: String, default: 'Secret Admirer' },
    noteText: { type: String, default: '' },
    arranged: [
      {
        id: String,
        flower: {
          id: String,
          name: String,
          file: String,
          category: String,
        },
        x: Number,
        y: Number,
        scale: Number,
        rotation: Number,
        layer: Number,
        isBg: Boolean,
        isSeam: Boolean,
      },
    ],
    polaroidImage: { type: String, default: null }, // Base64 Compressed String
    voiceNote: { type: String, default: null },     // Base64 Audio String
    creatorUid: { type: String, default: null, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Bouquet = mongoose.model('Bouquet', BouquetSchema);

const FeedbackSchema = new mongoose.Schema(
  {
    bouquetId:       { type: String, default: null },
    firebaseUid:     { type: String, default: null },
    shared:          { type: String, enum: ['yes', 'not_yet', 'no_plan'], default: null },
    meaningfulness:  { type: Number, min: 1, max: 5, default: null },
    frustrations:    { type: String, default: '' },
    wishFeature:     { type: String, default: '' },
    wouldUseAgain:   { type: String, enum: ['definitely', 'probably', 'maybe', 'unlikely', 'never'], default: null },
  },
  { timestamps: true }
);

const Feedback = mongoose.model('Feedback', FeedbackSchema);

// Helper to verify Firebase ID Token using Google Identity Toolkit API
async function verifyFirebaseToken(token) {
  if (isOfflineMode) {
    console.warn('Offline mode bypass activated for verifyFirebaseToken');
    return {
      localId: 'Fk0Yl77koDbTc8zklL4mDsu8CSJ2',
      email: 'hariharpradeepjaybal@gmail.com',
      displayName: 'Offline Admin User'
    };
  }

  if (!token) throw new Error('No token provided');
  
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) throw new Error('FIREBASE_API_KEY is not configured on server');

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token })
  });

  const data = await response.json();
  if (!response.ok || !data.users || data.users.length === 0) {
    throw new Error('Invalid Firebase token');
  }

  return data.users[0];
}

// Middleware to require a logged-in and approved user
async function requireApprovedUser(req, res, next) {
  try {
    if (isOfflineMode) {
      req.user = memUsers[0];
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const firebaseUser = await verifyFirebaseToken(token);
    const firebaseUid = firebaseUser.localId;

    let user = await User.findOne({ firebaseUid });

    // Auto-seed admin user if the firebaseUid matches any designated admin UID
    if (!user && ADMIN_UIDS.includes(firebaseUid)) {
      user = new User({
        firebaseUid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || '',
        role: 'admin',
        approved: true
      });
      await user.save();
    }

    if (!user) {
      return res.status(403).json({ success: false, error: 'Forbidden: No account synchronized with server. Please sync.' });
    }

    if (!user.approved) {
      return res.status(403).json({ success: false, error: 'Forbidden: Account pending approval' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({ success: false, error: error.message || 'Unauthorized' });
  }
}

// Middleware to require admin permissions
async function requireAdmin(req, res, next) {
  await requireApprovedUser(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }
    next();
  });
}

// Seed default invite codes if empty
async function seedInviteCodes() {
  try {
    const count = await InviteCode.countDocuments();
    if (count === 0) {
      await InviteCode.insertMany([
        { code: 'FLORAVO-BETA-001' },
        { code: 'FLORAVO-BETA-002' },
        { code: 'FLORAVO-BETA-003' }
      ]);
      console.log('Seeded default beta invite codes: FLORAVO-BETA-001, FLORAVO-BETA-002, FLORAVO-BETA-003');
    }
  } catch (error) {
    console.error('Error seeding invite codes:', error);
  }
}

// Helper to compress base64 image using Jimp
async function compressBase64Image(base64Str) {
  if (!base64Str) return null;
  
  // Check if it has data url prefix, extract raw base64
  const matches = base64Str.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  let mimeType = 'image/jpeg';
  let buffer;

  if (matches && matches.length === 3) {
    mimeType = matches[1];
    buffer = Buffer.from(matches[2], 'base64');
  } else {
    buffer = Buffer.from(base64Str, 'base64');
  }

  try {
    const image = await Jimp.read(buffer);
    
    // Resize image to maximum width/height of 500px while maintaining aspect ratio
    image.resize(500, Jimp.AUTO);
    
    // Set JPEG/PNG quality to 70%
    image.quality(70);
    
    const compressedBuffer = await image.getBufferAsync(mimeType);
    return `data:${mimeType};base64,${compressedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Error compressing image, keeping original:', error);
    return base64Str; // Fallback to original if compression fails
  }
}

// Routes
// 1. Sync User / Register
app.post('/api/auth/sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ success: false, error: 'Authorization token required' });
    }
    const token = authHeader.split(' ')[1];
    const firebaseUser = await verifyFirebaseToken(token);
    const firebaseUid = firebaseUser.localId;
    const email = firebaseUser.email;
    const name = req.body.name || firebaseUser.displayName || '';

    // Offline mode bypass
    if (isOfflineMode) {
      let user = memUsers.find((u) => u.firebaseUid === firebaseUid);
      let syncStatus = 'existing';
      if (!user) {
        syncStatus = 'created';
        const isAdminUser = ADMIN_UIDS.includes(firebaseUid);
        user = {
          _id: 'offline_user_' + Math.random().toString(36).substr(2, 9),
          firebaseUid,
          email,
          name,
          role: isAdminUser ? 'admin' : 'user',
          approved: true,
          createdAt: new Date(),
        };
        memUsers.push(user);
      }
      return res.status(200).json({ success: true, syncStatus, user });
    }

    let user = await User.findOne({ firebaseUid });
    let syncStatus = 'existing';

    if (!user) {
      syncStatus = 'created';
      user = new User({
        firebaseUid,
        email,
        name,
        role: 'user',
        approved: true,
      });

      // 1. Check if they are a designated admin
      if (ADMIN_UIDS.includes(firebaseUid)) {
        user.role = 'admin';
        user.approved = true;
      } 
      // 2. Check if an invite code was passed (legacy, since all are approved now)
      else if (req.body.inviteCode) {
        const cleanedCode = req.body.inviteCode.trim().toUpperCase();
        const codeDoc = await InviteCode.findOne({ code: cleanedCode, used: false });
        if (codeDoc) {
          user.role = 'user';
          user.approved = true;
          user.inviteCode = cleanedCode;
          
          codeDoc.used = true;
          codeDoc.usedBy = firebaseUid;
          await codeDoc.save();
        }
      }
      await user.save();
    } else {
      // If user is already in the database, ensure the admin user is force-synced to admin role
      if (ADMIN_UIDS.includes(firebaseUid) && user.role !== 'admin') {
        user.role = 'admin';
        user.approved = true;
        await user.save();
      }
    }

    res.status(200).json({
      success: true,
      syncStatus,
      user: {
        firebaseUid: user.firebaseUid,
        email: user.email,
        name: user.name,
        role: user.role,
        approved: user.approved,
        inviteCode: user.inviteCode,
        createdAt: user.createdAt,
      }
    });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(401).json({ success: false, error: error.message || 'Authentication failed' });
  }
});

// 2. Claim Invite Code (for pending users)
app.post('/api/auth/claim-invite', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(400).json({ success: false, error: 'Authorization token required' });
    }
    const token = authHeader.split(' ')[1];
    const firebaseUser = await verifyFirebaseToken(token);
    const firebaseUid = firebaseUser.localId;

    if (isOfflineMode) {
      const user = memUsers.find((u) => u.firebaseUid === firebaseUid);
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });
      if (user.approved) return res.status(200).json({ success: true, message: 'Account is already approved', user });

      const cleanedCode = req.body.inviteCode.trim().toUpperCase();
      const codeDoc = memInviteCodes.find((c) => c.code === cleanedCode && !c.used);
      if (!codeDoc) return res.status(400).json({ success: false, error: 'Invalid or already claimed invite code' });

      user.role = 'user';
      user.approved = true;
      user.inviteCode = cleanedCode;

      codeDoc.used = true;
      codeDoc.usedBy = firebaseUid;

      return res.status(200).json({ success: true, message: 'Invite code claimed!', user });
    }

    let user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.approved) {
      return res.status(200).json({ success: true, message: 'Account is already approved', user });
    }

    const cleanedCode = req.body.inviteCode.trim().toUpperCase();
    const codeDoc = await InviteCode.findOne({ code: cleanedCode, used: false });
    if (!codeDoc) {
      return res.status(400).json({ success: false, error: 'Invalid or already claimed invite code' });
    }

    user.role = 'user';
    user.approved = true;
    user.inviteCode = cleanedCode;
    await user.save();

    codeDoc.used = true;
    codeDoc.usedBy = firebaseUid;
    await codeDoc.save();

    res.status(200).json({
      success: true,
      message: 'Invite code claimed and account approved!',
      user: {
        firebaseUid: user.firebaseUid,
        email: user.email,
        name: user.name,
        role: user.role,
        approved: user.approved,
      }
    });
  } catch (error) {
    console.error('Error claiming invite:', error);
    res.status(401).json({ success: false, error: error.message || 'Authentication failed' });
  }
});

// 3. Admin: Get all pending users
app.get('/api/admin/pending-users', requireAdmin, async (req, res) => {
  try {
    if (isOfflineMode) {
      const pending = memUsers.filter((u) => !u.approved);
      return res.status(200).json({ success: true, users: pending });
    }

    const pending = await User.find({ approved: false }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, users: pending });
  } catch (error) {
    console.error('Error fetching pending users:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 4. Admin: Approve a user manually
app.patch('/api/admin/users/:id/approve', requireAdmin, async (req, res) => {
  try {
    if (isOfflineMode) {
      const userToApprove = memUsers.find((u) => u._id === req.params.id);
      if (!userToApprove) return res.status(404).json({ success: false, error: 'User not found' });
      userToApprove.approved = true;
      userToApprove.role = 'user';
      return res.status(200).json({ success: true, message: 'User approved successfully', user: userToApprove });
    }

    const userToApprove = await User.findById(req.params.id);
    if (!userToApprove) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    userToApprove.approved = true;
    userToApprove.role = 'user';
    await userToApprove.save();
    res.status(200).json({ success: true, message: 'User approved successfully', user: userToApprove });
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 4b. Admin: Approve all pending users
app.patch('/api/admin/users/approve-all', requireAdmin, async (req, res) => {
  try {
    if (isOfflineMode) {
      let count = 0;
      memUsers.forEach(u => {
        if (!u.approved) {
          u.approved = true;
          u.role = 'user';
          count++;
        }
      });
      return res.status(200).json({ success: true, message: `${count} users approved successfully` });
    }

    const result = await User.updateMany(
      { approved: false },
      { $set: { approved: true, role: 'user' } }
    );
    res.status(200).json({ success: true, message: `${result.modifiedCount} users approved successfully` });
  } catch (error) {
    console.error('Error approving all users:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 5. Admin: Reject / Delete a user registration
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    if (isOfflineMode) {
      const index = memUsers.findIndex((u) => u._id === req.params.id);
      if (index === -1) return res.status(404).json({ success: false, error: 'User not found' });
      memUsers.splice(index, 1);
      return res.status(200).json({ success: true, message: 'User registration deleted' });
    }

    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.status(200).json({ success: true, message: 'User registration deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Admin: Get all users
app.get('/api/admin/all-users', requireAdmin, async (req, res) => {
  try {
    if (isOfflineMode) {
      return res.status(200).json({ success: true, users: memUsers });
    }
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Admin: Get dashboard metrics
app.get('/api/admin/metrics', requireAdmin, async (req, res) => {
  try {
    if (isOfflineMode) {
      const totalUsers = memUsers.length;
      const approvedUsers = memUsers.filter(u => u.approved).length;
      const pendingUsers = memUsers.filter(u => !u.approved).length;
      const totalCodes = memInviteCodes.length;
      const claimedCodes = memInviteCodes.filter(c => c.used).length;
      const totalBouquets = memBouquets.length;

      return res.status(200).json({
        success: true,
        metrics: {
          totalUsers,
          approvedUsers,
          pendingUsers,
          totalCodes,
          claimedCodes,
          totalBouquets
        }
      });
    }

    const [totalUsers, approvedUsers, pendingUsers, totalCodes, claimedCodes, totalBouquets] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ approved: true }),
      User.countDocuments({ approved: false }),
      InviteCode.countDocuments(),
      InviteCode.countDocuments({ used: true }),
      Bouquet.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      metrics: {
        totalUsers,
        approvedUsers,
        pendingUsers,
        totalCodes,
        claimedCodes,
        totalBouquets
      }
    });
  } catch (error) {
    console.error('Error fetching admin metrics:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Admin: Update user role or approval status (e.g. revoke access)
app.patch('/api/admin/users/:id/update', requireAdmin, async (req, res) => {
  try {
    const { role, approved } = req.body;
    if (isOfflineMode) {
      const user = memUsers.find(u => u._id === req.params.id);
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });
      if (role !== undefined) user.role = role;
      if (approved !== undefined) user.approved = approved;
      return res.status(200).json({ success: true, message: 'User updated successfully', user });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (role !== undefined) user.role = role;
    if (approved !== undefined) user.approved = approved;
    await user.save();
    res.status(200).json({ success: true, message: 'User updated successfully', user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 6. Admin: Generate a new invite code
app.post('/api/admin/invite-codes', requireAdmin, async (req, res) => {
  try {
    const code = req.body.code ? req.body.code.trim().toUpperCase() : `FLORAVO-BETA-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    if (isOfflineMode) {
      const existing = memInviteCodes.find((c) => c.code === code);
      if (existing) return res.status(400).json({ success: false, error: 'Invite code already exists' });
      const newCode = {
        _id: 'offline_code_' + Math.random().toString(36).substr(2, 9),
        code,
        used: false,
        usedBy: null,
        createdAt: new Date()
      };
      memInviteCodes.unshift(newCode);
      return res.status(201).json({ success: true, inviteCode: newCode });
    }

    const existing = await InviteCode.findOne({ code });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Invite code already exists' });
    }
    const newCode = new InviteCode({ code });
    await newCode.save();
    res.status(201).json({ success: true, inviteCode: newCode });
  } catch (error) {
    console.error('Error generating invite code:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 7. Admin: Get all invite codes
app.get('/api/admin/invite-codes', requireAdmin, async (req, res) => {
  try {
    if (isOfflineMode) {
      return res.status(200).json({ success: true, inviteCodes: memInviteCodes });
    }

    const codes = await InviteCode.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, inviteCodes: codes });
  } catch (error) {
    console.error('Error fetching invite codes:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 8. Create a new Bouquet (Requires Approved User - Max 1 bouquet per user)
app.post('/api/bouquets', requireApprovedUser, async (req, res) => {
  try {
    const { noteRecipient, noteSender, noteText, arranged, polaroidImage, voiceNote } = req.body;
    const firebaseUid = req.user.firebaseUid;

    console.log(`Received request to save bouquet for ${noteRecipient}. Processing assets...`);

    // Check if user already has a bouquet
    if (isOfflineMode) {
      const existing = memBouquets.find(b => b.creatorUid === firebaseUid);
      if (existing) {
        return res.status(400).json({
          success: false,
          limitReached: true,
          existingBouquetId: existing._id,
          error: 'Free limit reached. You can only create one bouquet.'
        });
      }
    } else {
      const existing = await Bouquet.findOne({ creatorUid: firebaseUid });
      if (existing) {
        return res.status(400).json({
          success: false,
          limitReached: true,
          existingBouquetId: existing._id,
          error: 'Free limit reached. You can only create one bouquet.'
        });
      }
    }

    // Compress the polaroid image on the backend if it exists
    let compressedPhoto = null;
    if (polaroidImage) {
      compressedPhoto = await compressBase64Image(polaroidImage);
      console.log('Polaroid image compressed successfully');
    }

    if (isOfflineMode) {
      const mockId = 'mem_bouquet_' + Math.random().toString(36).substr(2, 9);
      const newBouquet = {
        _id: mockId,
        noteRecipient,
        noteSender,
        noteText,
        arranged,
        polaroidImage: compressedPhoto,
        voiceNote,
        creatorUid: firebaseUid,
        createdAt: new Date()
      };
      memBouquets.push(newBouquet);
      console.log(`Bouquet successfully saved in-memory with ID: ${mockId}`);
      return res.status(201).json({
        success: true,
        message: 'Bouquet saved successfully in-memory',
        id: mockId,
      });
    }

    const newBouquet = new Bouquet({
      noteRecipient,
      noteSender,
      noteText,
      arranged,
      polaroidImage: compressedPhoto,
      voiceNote, // Audio is already compressed by the browser (WebM/AAC)
      creatorUid: firebaseUid,
    });

    const savedBouquet = await newBouquet.save();
    console.log(`Bouquet successfully saved with ID: ${savedBouquet._id}`);
    
    res.status(201).json({
      success: true,
      message: 'Bouquet saved successfully',
      id: savedBouquet._id,
    });
  } catch (error) {
    console.error('Error saving bouquet:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 8b. Fetch My Bouquet (Requires Approved User)
app.get('/api/bouquets/my-bouquet', requireApprovedUser, async (req, res) => {
  try {
    const firebaseUid = req.user.firebaseUid;
    if (isOfflineMode) {
      const bouquet = memBouquets.find(b => b.creatorUid === firebaseUid);
      return res.status(200).json({ success: true, bouquet: bouquet || null });
    }

    const bouquet = await Bouquet.findOne({ creatorUid: firebaseUid });
    res.status(200).json({ success: true, bouquet: bouquet || null });
  } catch (error) {
    console.error('Error fetching my bouquet:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 8c. Delete a Bouquet (Requires Approved User & ownership check)
app.delete('/api/bouquets/:id', requireApprovedUser, async (req, res) => {
  try {
    const { id } = req.params;
    const firebaseUid = req.user.firebaseUid;

    if (isOfflineMode || id.startsWith('mem_')) {
      const idx = memBouquets.findIndex(b => b._id === id);
      if (idx === -1) {
        return res.status(404).json({ success: false, error: 'Bouquet not found' });
      }
      if (memBouquets[idx].creatorUid !== firebaseUid && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Forbidden: You do not own this bouquet' });
      }
      memBouquets.splice(idx, 1);
      return res.status(200).json({ success: true, message: 'Bouquet deleted successfully' });
    }

    const bouquet = await Bouquet.findById(id);
    if (!bouquet) {
      return res.status(404).json({ success: false, error: 'Bouquet not found' });
    }

    if (bouquet.creatorUid !== firebaseUid && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: You do not own this bouquet' });
    }

    await Bouquet.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Bouquet deleted successfully' });
  } catch (error) {
    console.error('Error deleting bouquet:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 9. Fetch a Bouquet by ID (Public)
app.get('/api/bouquets/:id', async (req, res) => {
  try {
    if (isOfflineMode || req.params.id.startsWith('mem_')) {
      const bouquet = memBouquets.find((b) => b._id === req.params.id);
      if (!bouquet) return res.status(404).json({ success: false, error: 'Bouquet not found' });
      return res.status(200).json({ success: true, bouquet });
    }

    const bouquet = await Bouquet.findById(req.params.id);
    if (!bouquet) {
      return res.status(404).json({ success: false, error: 'Bouquet not found' });
    }
    res.status(200).json({ success: true, bouquet });
  } catch (error) {
    console.error('Error fetching bouquet:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 10. Test Compression Endpoint (Requires Approved User)
app.post('/api/test-compression', requireApprovedUser, async (req, res) => {
  try {
    const { polaroidImage, voiceNote } = req.body;
    const result = {
      image: { received: false },
      audio: { received: false }
    };

    if (polaroidImage) {
      const originalLength = polaroidImage.length;
      const originalMime = polaroidImage.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,/)?.[1] || 'unknown';
      
      const compressed = await compressBase64Image(polaroidImage);
      const compressedLength = compressed ? compressed.length : 0;
      const compressedMime = compressed ? (compressed.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,/)?.[1] || 'unknown') : 'unknown';
      const ratio = originalLength > 0 ? ((originalLength - compressedLength) / originalLength * 100).toFixed(2) + '%' : '0%';
      
      result.image = {
        received: true,
        originalMime,
        originalBase64Length: originalLength,
        compressedMime,
        compressedBase64Length: compressedLength,
        reductionRatio: ratio,
        success: !!compressed
      };
    }

    if (voiceNote) {
      const originalLength = voiceNote.length;
      const originalMime = voiceNote.match(/^data:([^;]+);base64,/)?.[1] || 'unknown';
      
      result.audio = {
        received: true,
        originalMime,
        originalBase64Length: originalLength,
        success: true
      };
    }

    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Error in test-compression:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. Submit Post-Share Feedback (Auth-optional — we record uid if available)
app.post('/api/feedback', async (req, res) => {
  try {
    const { bouquetId, shared, meaningfulness, frustrations, wishFeature, wouldUseAgain } = req.body;

    // Optionally read firebase uid from auth header, but never block on it
    let firebaseUid = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const fbUser = await verifyFirebaseToken(token);
        firebaseUid = fbUser.localId || null;
      }
    } catch (_) { /* ignore auth errors for feedback */ }

    if (isOfflineMode) {
      return res.status(201).json({ success: true, message: 'Feedback noted (offline mode).' });
    }

    const feedback = new Feedback({
      bouquetId: bouquetId || null,
      firebaseUid,
      shared: shared || null,
      meaningfulness: meaningfulness != null ? Number(meaningfulness) : null,
      frustrations: frustrations || '',
      wishFeature: wishFeature || '',
      wouldUseAgain: wouldUseAgain || null,
    });
    await feedback.save();
    res.status(201).json({ success: true, message: 'Thank you for your feedback!' });
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 12. Admin: Get all feedback entries
app.get('/api/admin/feedback', requireAdmin, async (req, res) => {
  try {
    if (isOfflineMode) {
      return res.status(200).json({ success: true, feedback: [] });
    }
    const allFeedback = await Feedback.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, feedback: allFeedback });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Floravo backend running on port ${PORT}`);
});


