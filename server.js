import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import bodyParser from "body-parser";
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
import appAuthMiddleware from './middlewares/appAuthMiddleware.js'
import service from './routes/serivice.js'
import reviewRoutes from './routes/reviewRoutes.js';

dotenv.config();
const app = express();
const port = process.env.PORT || 8000;

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser()); 
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());



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
app.get("/api/auth/me", appAuthMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.use('/stripe', webhookRoute);
app.use('/api/bookings', bookingRoutes);
app.use('/pay', paymentRoutes);
app.use('/stripe', stripeRoutes);
// app.js or index.js
app.use('/api/amenities', amenitiesRouter);
app.use('/api/services', service);
app.use('/api/business-reviews', reviewRoutes);

app.use(errorHandler);



app.listen(port, '0.0.0.0',() => {
  console.log(`Server running on port ${port}`);
});
// import jwt from "jsonwebtoken";
// import fs from "fs";

// const privateKey = fs.readFileSync("./AuthKey_NJXX4SKRJL.p8");

// const token = jwt.sign(
//   {
//     iss: "HAK23MQ4FD", // e.g. AB123CD456
//     iat: Math.floor(Date.now() / 1000),
//     exp: Math.floor(Date.now() / 1000) + 15777000, // 6 months
//     aud: "https://appleid.apple.com",
//     sub: "com.pathsure.APP", // your Service ID
//   },
//   privateKey,
//   {
//     algorithm: "ES256",
//     header: {
//       kid: "NJXX4SKRJL", // e.g. XYZ987ABC
//     },
//   }
// );


// console.log("Generated Apple Secret JWT:");
// console.log(token);
