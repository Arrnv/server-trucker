const allowedOrigins = [
  'https://frontend-bmnm.vercel.app',
  'https://desi22.com',
  'https://pathsure.com',
  'https://www.desi22.com',
  "http://localhost:3000",
  "http://localhost:8081",
  "https://appleid.apple.com"
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow null for mobile/native apps
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('Blocked CORS request from origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};

export default corsOptions;
