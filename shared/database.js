const mongoose = require('mongoose');

// Database connection with retry logic
const connectDB = async (mongoUrl, options = {}) => {
  const defaultOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    bufferMaxEntries: 0, // Disable mongoose buffering
    bufferCommands: false, // Disable mongoose buffering
    ...options
  };

  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await mongoose.connect(mongoUrl, defaultOptions);
      console.log(`[DB] Connected to MongoDB: ${mongoose.connection.name}`);
      
      // Connection event handlers
      mongoose.connection.on('error', (err) => {
        console.error(`[DB] MongoDB error: ${err}`);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('[DB] MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('[DB] MongoDB reconnected');
      });

      return mongoose.connection;
    } catch (error) {
      retries += 1;
      console.error(`[DB] Connection attempt ${retries} failed: ${error.message}`);
      
      if (retries >= maxRetries) {
        console.error('[DB] Max retries reached. Unable to connect to database.');
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
    }
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  try {
    await mongoose.connection.close();
    console.log('[DB] Database connection closed gracefully');
  } catch (error) {
    console.error('[DB] Error closing database connection:', error);
  }
};

module.exports = {
  connectDB,
  gracefulShutdown
};