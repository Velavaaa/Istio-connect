const express = require('express');
const { Pool } = require('pg');
const dns = require('dns').promises;
const net = require('net');

const app = express();
const port = 3000;

// Log all environment variables
console.log('Environment variables:');
console.log('PGUSER:', process.env.PGUSER);
console.log('PGHOST:', process.env.PGHOST);
console.log('PGDATABASE:', process.env.PGDATABASE);
console.log('PGPASSWORD:', process.env.PGPASSWORD);
console.log('PGPORT:', process.env.PGPORT);

const connectionString = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;
console.log('Using connection string:', connectionString);

const pool = new Pool({ connectionString });

// Enhanced DNS lookup function
async function performDnsLookup(hostname) {
  try {
    const addresses = await dns.lookup(hostname);
    console.log(`DNS lookup for ${hostname}:`, addresses);
    return addresses;
  } catch (error) {
    console.error(`DNS lookup failed for ${hostname}:`, error);
    return null;
  }
}

// TCP connection test function
function testTcpConnection(host, port) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);  // 5 second timeout

    socket.connect(port, host, () => {
      console.log(`TCP connection to ${host}:${port} successful`);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', (error) => {
      console.error(`TCP connection to ${host}:${port} failed:`, error.message);
      reject(error);
    });

    socket.on('timeout', () => {
      console.error(`TCP connection to ${host}:${port} timed out`);
      socket.destroy();
      reject(new Error('Connection timed out'));
    });
  });
}

// Perform diagnostics
async function runDiagnostics() {
  console.log('Running diagnostics...');
  
  // DNS lookup
  const pgHostAddress = await performDnsLookup(process.env.PGHOST);
  
  // TCP connection test
  if (pgHostAddress) {
    try {
      await testTcpConnection(pgHostAddress.address, process.env.PGPORT);
    } catch (error) {
      console.error('TCP connection test failed:', error.message);
    }
  }
  
  // Test database connection and create table
  try {
    console.log('Attempting to connect to the database...');
    const client = await pool.connect();
    console.log('Successfully connected to the database.');

    // Create person table
    await client.query(`
      CREATE TABLE IF NOT EXISTS person (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        age INT,
        email VARCHAR(100),
        occupation VARCHAR(100)
      )
    `);
    console.log('Person table created or already exists.');

    // Insert 3 rows into the person table
    await client.query(`
      INSERT INTO person (name, age, email, occupation)
      VALUES 
        ('John Doe', 30, 'john@example.com', 'Developer'),
        ('Jane Smith', 28, 'jane@example.com', 'Designer'),
        ('Bob Johnson', 35, 'bob@example.com', 'Manager')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('Sample data inserted into person table.');

    const result = await client.query('SELECT NOW()');
    console.log('Database query successful. Current timestamp:', result.rows[0].now);
    client.release();
  } catch (error) {
    console.error('Error connecting to database or creating table:', error.message);
  }
}

// Run diagnostics on startup
runDiagnostics();

app.get('/person', async (req, res) => {
  console.log('Called /person endpoint');
  try {
    const result = await pool.query('SELECT * FROM person');
    console.log('Query executed successfully, row count:', result.rowCount);
    res.json(result.rows);
  } catch (error) {
    console.error('Error in /person endpoint:', error);
    res.status(500).json({
      error: 'Server error',
      details: error.message,
      stack: error.stack
    });
  }
});

app.get('/run-diagnostics', async (req, res) => {
  console.log('Running diagnostics from endpoint');
  await runDiagnostics();
  res.send('Diagnostics completed. Check server logs for details.');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Handle process termination
process.on('SIGINT', () => {
  pool.end(() => {
    console.log('Database pool has ended');
    process.exit(0);
  });
});
