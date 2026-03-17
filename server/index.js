const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/keywords', require('./routes/keywords'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/articles', require('./routes/articles'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
