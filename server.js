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
import webhookRoute from './controllers/stripeWebhook.js';
import stripeRoutes from './routes/stripe.js';
import amenitiesRouter from './routes/amenities.js';
import searchRoutes from './routes/search.js';

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
app.use('/api/search', searchRoutes);

app.use('/customer', customerRoutes);
app.use('/plans', planRoutes); 

app.use('/stripe', webhookRoute);
app.use('/api/bookings', bookingRoutes);
app.use('/pay', paymentRoutes);
app.use('/stripe', stripeRoutes);
// app.js or index.js
app.use('/api/amenities', amenitiesRouter);


app.use(errorHandler);



app.listen(port, '0.0.0.0',() => {
  console.log(`Server running on port ${port}`);
});
