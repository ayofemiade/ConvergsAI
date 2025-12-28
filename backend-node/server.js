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

// Initialize Express app
const app = express();

// Configuration
const PORT = process.env.PORT || 4000;
const PYTHON_AI_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

// Security Middleware
app.use(helmet());

// CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
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
app.get('/health', async (req, res) => {
  try {
    // Check Python AI backend
    const pythonHealth = await axios.get(`${PYTHON_AI_URL}/health`, {
      timeout: 5000
    });

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        gateway: 'online',
        pythonAI: pythonHealth.data.status || 'online'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        gateway: 'online',
        pythonAI: 'offline'
      },
      error: error.message
    });
  }
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
    // Forward any custom prompt configuration
    const payload = req.body || {};

    const response = await axios.post(`${PYTHON_AI_URL}/session/new`, payload, {
      timeout: 5000
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error creating session:', error.message);

    // Fallback: create session ID locally if Python backend is down
    const sessionId = uuidv4();
    res.json({
      success: true,
      session_id: sessionId,
      message: 'New session created',
      fallback: true
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

// Future: LiveKit Token Generation (for voice features)
app.post('/api/livekit/token', (req, res) => {
  // Placeholder for LiveKit token generation
  // Will be implemented when adding voice features
  res.status(501).json({
    success: false,
    message: 'Voice features coming soon',
    feature: 'livekit_integration'
  });
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
app.listen(PORT, () => {
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

  // Check Python backend connection
  axios.get(`${PYTHON_AI_URL}/health`, { timeout: 5000 })
    .then(() => {
      console.log('✅ Connected to Python AI backend');
    })
    .catch(() => {
      console.log('⚠️  Warning: Could not connect to Python AI backend');
      console.log('   Make sure the Python service is running on', PYTHON_AI_URL);
    });
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
