import { Request, Response } from 'express';
import dotenv from "dotenv";
import express from 'express';
import cors from "cors";
import cookieParser from "cookie-parser";
import prisma from './config/db.config';


// Initialize Express app
const app = express();

// Load environment variables
dotenv.config({
  path: '.env'
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS", "PUT", "PATCH" , "DELETE"],
    allowedHeaders: ["Origin", "Content-Type", "Accept", "Authorization"],
    credentials: true
}));





app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({
  extended: true,
  limit: "16kb"
}));
app.use(express.static("public"));
app.use(cookieParser());






// Root route
app.get('/', (_req: Request, res: Response) => {
    res.send('Welcome to Sweety, on this line you are talking to Sweety server !!');
});

// Server start
const port = process.env.PORT || 3005;

// Graceful shutdown function
const shutdown = async () => {
  await prisma.$disconnect();
  console.log('Disconnected from database');
  process.exit(0);
};

// Connect and start server
async function startServer() {
  try {
    // Test the database connection
    await prisma.$connect();
  
    console.log('Connected to Postgres with Prisma');
    
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
  } catch (err) {
    console.error("Error connecting to database !!", err);
    process.exit(1);
  }
}

startServer();

export default app;