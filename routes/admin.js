import express from 'express';
import isAdmin from '../middlewares/isAdmin.js';
import {
  getAdminDashboard,
  getAdminAnalytics,
  getAllUsers,
  deleteUser,
  updateUserRole,
  getUserCreatedStats,
  getUserRoleStats,
  getAllBusinesses,
  updateBusinessStatus,
  deleteBusiness,
  getBusinessCategoryStats,
  getBusinessCreatedStats,
  getTopRevenueServices
} from '../controllers/adminController.js';

import {
  getAllServices,
  updateServiceStatus,
  getServiceViewStats,
  getServiceFeedbackStats,
  getTopRatedServices,      
  getMostViewedServices   ,
  getMonthlyStats,
  getCategoryStats,
  getStatusStats    
} from '../controllers/adminServiceController.js';

const router = express.Router();

// All routes below require admin access
router.use(isAdmin);

// Dashboard & Analytics
router.get('/dashboard', getAdminDashboard);
router.get('/analytics', getAdminAnalytics);

// User Management
router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/role', updateUserRole);
router.get('/users/stats/created', getUserCreatedStats);
router.get('/users/stats/roles', getUserRoleStats);

// Business Management
router.get('/businesses', getAllBusinesses);
router.put('/businesses/:id/status', updateBusinessStatus);
router.delete('/businesses/:id', deleteBusiness);
router.get('/businesses/stats/categories', getBusinessCategoryStats);
router.get('/businesses/stats/created', getBusinessCreatedStats);

// Service Management
router.get('/services', getAllServices);
router.put('/services/:id/status', updateServiceStatus);
router.get('/services/stats/views', getServiceViewStats);
router.get('/services/stats/feedback', getServiceFeedbackStats);
router.get('/services/stats/top-rated', getTopRatedServices);       
router.get('/services/stats/most-viewed', getMostViewedServices); 
router.get('/services/stats/monthly', getMonthlyStats);
router.get('/services/stats/by-category', getCategoryStats);
router.get('/services/stats/status-summary',getStatusStats) ; 
router.get('/services/stats/top-revenue', getTopRevenueServices);
export default router;
