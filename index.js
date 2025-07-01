import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser'; 
import corsOptions from './config/corsOptions.js';
import authRoutes from './routes/authRoutes.js';
import errorHandler from './middlewares/errorHandler.js';
import dataRoutes from './routes/dataRoutes.js';
import businessRoutes from './routes/businessRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js'
import feedbackRoutes from './routes/feedback.js';
import adminRoutes from './routes/adminRoutes.js';
import admin from './routes/admin.js'
import planRoutes from './routes/planRoutes.js';
import bookingRoutes from './routes/bookingroutes.js';
import customerRoutes from './routes/customerRoutes.js';
import paymentRoutes from './routes/payments.js'; // adjust path accordingly


dotenv.config();
const app = express();
const port = process.env.PORT || 8000;

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser()); 

app.use('/api/auth', authRoutes);
app.use('/api', dataRoutes);
app.use('/businesses', businessRoutes); 
app.use('/api/analytics',analyticsRoutes)
app.use('/api/reviews', feedbackRoutes); // This must be exact
app.use('/api/admin', adminRoutes);
app.use('/admin', admin)

app.use('/customer', customerRoutes);
app.use('/plans', planRoutes); 


app.use('/api/bookings', bookingRoutes);
app.use('/pay', paymentRoutes);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
