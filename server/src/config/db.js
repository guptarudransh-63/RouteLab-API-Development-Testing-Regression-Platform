import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/routelab';
  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[DB] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error(`[DB Error] Connection failed: ${err.message}`);
    throw err;
  }
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('[DB] MongoDB Disconnected');
  } catch (err) {
    console.error(`[DB Error] Disconnect failed: ${err.message}`);
  }
}
