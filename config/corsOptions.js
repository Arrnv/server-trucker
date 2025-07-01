const corsOptions = {
  origin: 'https://frontend-bmnm.vercel.app', // ✅ no slash

  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};

export default corsOptions;
