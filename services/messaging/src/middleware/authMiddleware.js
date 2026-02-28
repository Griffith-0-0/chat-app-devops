const axios = require('axios');
require('dotenv').config();

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const response = await axios.get(`${process.env.AUTH_SERVICE_URL}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    req.userId = response.data.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

module.exports = authMiddleware;