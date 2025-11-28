const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'payfriends.db');
const db = new Database(dbPath);

const email = 'borrower@test.dev';
const password = 'password123';

const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

if (!user) {
    console.log('User not found');
} else {
    console.log('User found:', user.email);
    console.log('Hash:', user.password_hash);
    bcrypt.compare(password, user.password_hash).then(valid => {
        console.log('Password valid:', valid);
    });
}
