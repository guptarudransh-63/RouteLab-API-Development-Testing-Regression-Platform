import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5001;

async function bootstrap() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[RouteLab Server] Listening on http://localhost:${PORT}`);
      console.log(`[RouteLab Server] Swagger documentation at http://localhost:${PORT}/api-docs`);
      console.log(`[RouteLab Server] SSRF Local Requests Allowed: ${process.env.ALLOW_LOCAL_REQUESTS === 'true'}`);
    });
  } catch (err) {
    console.error('[RouteLab Bootstrap Error]', err);
    process.exit(1);
  }
}

bootstrap();
