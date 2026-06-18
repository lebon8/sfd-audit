'use strict';
require('dotenv').config();
const express = require('express');
const { shutdown } = require('./context');

const app = express();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.warn('[securite] JWT_SECRET faible ou absent — definissez-en un fort dans .env');
}
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ status: 'up', time: new Date().toISOString() }));
app.use('/api/v1/auth',    require('./routes/auth'));
app.use('/api/v1/ingest',  require('./routes/ingest'));
app.use('/api/v1/events',  require('./routes/query'));
app.use('/api/v1/verify',  require('./routes/verify'));
app.use('/api/v1/audit',   require('./routes/audit'));
app.use('/api/v1/reports', require('./routes/reports'));

const PORT = Number(process.env.API_PORT || 3000);
const server = app.listen(PORT, () => console.log(`API SFD AgnosticTrace sur http://localhost:${PORT}`));

async function stop() { server.close(); await shutdown(); process.exit(0); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);