/**
 * Node.js API Gateway for AI Sales Agent
 * 
 * Production-ready Express server that:
 * - Routes requests between frontend and Python AI core
 * - Handles session management
 * - Provides security middleware
 * - Rate limits requests
 * - Ready for future telephony integration (LiveKit/Twilio)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { AccessToken } = require('livekit-server-sdk');

// Initialize Express app
const app = express();

// Trust Fly.io proxy for rate-limiting
app.set('trust proxy', 1);

// Configuration
const PORT = process.env.PORT || 4000;
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'https://ai-sales-agent-theta.vercel.app'];

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    // Check if origin is allowed or if it's a localhost variation
    const isAllowed = ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed)) ||
      origin.includes('localhost') ||
      origin.includes('vercel.app');

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'bypass-tunnel-reminder'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Health Check Endpoint
// Must be lightweight for platform health monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'AI Sales Agent - API Gateway',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      message: 'POST /api/message',
      session: {
        create: 'POST /api/session/new',
        get: 'GET /api/session/:sessionId',
        delete: 'DELETE /api/session/:sessionId'
      }
    }
  });
});

// Create New Session
app.post('/api/session/new', async (req, res) => {
  try {
    const payload = req.body || {};
    console.log(`DEBUG: Requesting new session from Python AI: ${PYTHON_AI_URL}/session/new`);

    const response = await axios.post(`${PYTHON_AI_URL}/session/new`, payload, {
      timeout: 10000 
    });

    console.log(`DEBUG: Python AI responded: ${response.status} - Session ID: ${response.data.session_id}`);
    res.json(response.data);
  } catch (error) {
    console.error('CRITICAL: Python AI backend (main.py) is unavailable.', error.message);

    // Option A: Removed the silent fake fallback. If a client relies on this endpoint,
    // they should get an honest error so that the developers know the Text API is down.
    res.status(503).json({
      success: false,
      error: "Service Unavailable",
      message: "The Python Text API is currently disabled or offline."
    });
  }
});

// Send Message to AI Agent
app.post('/api/message', async (req, res) => {
  try {
    const { text, session_id } = req.body;

    // Validation
    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: text is required and must be a string'
      });
    }

    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: session_id is required and must be a string'
      });
    }

    // Sanitize input
    const sanitizedText = text.trim().substring(0, 1000);

    // Forward to Python AI backend
    const response = await axios.post(
      `${PYTHON_AI_URL}/message`,
      {
        text: sanitizedText,
        session_id: session_id
      },
      {
        timeout: 30000, // 30 seconds for AI generation
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Return AI response
    res.json(response.data);

  } catch (error) {
    console.error('Error sending message:', error.message);

    // Handle different error types
    if (error.response) {
      // Python backend returned an error
      res.status(error.response.status).json({
        success: false,
        error: error.response.data.detail || 'Error from AI backend',
        details: error.response.data
      });
    } else if (error.request) {
      // Python backend didn't respond
      res.status(503).json({
        success: false,
        error: 'AI backend is not responding',
        message: 'Please ensure the Python AI service is running'
      });
    } else {
      // Other errors
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

// Get Session Information
app.get('/api/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const response = await axios.get(
      `${PYTHON_AI_URL}/session/${sessionId}`,
      { timeout: 5000 }
    );

    res.json(response.data);

  } catch (error) {
    console.error('Error getting session:', error.message);

    if (error.response && error.response.status === 404) {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error retrieving session information'
      });
    }
  }
});

// Delete Session
app.delete('/api/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const response = await axios.delete(
      `${PYTHON_AI_URL}/session/${sessionId}`,
      { timeout: 5000 }
    );

    res.json(response.data);

  } catch (error) {
    console.error('Error deleting session:', error.message);

    if (error.response && error.response.status === 404) {
      res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error deleting session'
      });
    }
  }
});

// LiveKit Token Generation (for voice features)
app.post('/api/livekit/token', async (req, res) => {
  try {
    const { roomName, identity } = req.body;
    console.log(`DEBUG: Token request for room: ${roomName}, identity: ${identity}`);

    if (!roomName) {
      return res.status(400).json({
        success: false,
        error: 'roomName is required'
      });
    }

    // Default identity if not provided
    const participantIdentity = identity || `user_${uuidv4().slice(0, 8)}`;

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    console.log(`DEBUG: LiveKit Config - URL: ${livekitUrl}, API_KEY: ${apiKey ? 'SET' : 'MISSING'}`);

    if (!apiKey || !apiSecret) {
      throw new Error('LiveKit credentials not configured in .env');
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    const token = await at.toJwt();
    console.log(`DEBUG: Token generated successfully for ${participantIdentity}`);

    res.json({
      success: true,
      token: token,
      serverUrl: livekitUrl || 'ws://localhost:7800'
    });

  } catch (error) {
    console.error('DEBUG ERROR: LiveKit token generation failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate token',
      message: error.message
    });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   AI Sales Agent - API Gateway       ║
║                                       ║
║   🚀 Server running on port ${PORT}    ║
║   📍 http://localhost:${PORT}          ║
║   🔗 Python AI: ${PYTHON_AI_URL}
║                                       ║
║   Environment: ${process.env.NODE_ENV || 'development'}              ║
╚═══════════════════════════════════════╝
  `);

  // Notice: Python backend connection check removed.
  // In our decoupled Option A architecture, the Node API Gateway purely serves 
  // as a LiveKit Token generator, and no longer relies on the Python Text API (main.py).
  /* 
  axios.get(`${PYTHON_AI_URL}/health`, { timeout: 5000 })
    .then(...)
  */
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('📮 SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📮 SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});
