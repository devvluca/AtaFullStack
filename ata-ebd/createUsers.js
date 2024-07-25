const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

function createUser(dbPath, username, password) {
    const db = new sqlite3.Database(dbPath);
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.serialize(() => {
        db.run("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)");
        db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword]);

        db.run("CREATE TABLE IF NOT EXISTS attendees (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, conecta TEXT, phone TEXT, presencas INTEGER)");
        db.run("CREATE TABLE IF NOT EXISTS presences (id INTEGER PRIMARY KEY AUTOINCREMENT, attendee_id INTEGER, date TEXT, FOREIGN KEY(attendee_id) REFERENCES attendees(id))");
    });

    db.close();
}

// Criação de usuários para cada EBD
createUser('./databases/juv.db', 'juv', '123');
createUser('./databases/manha.db', 'manha', '123');
createUser('./databases/tarde.db', 'tarde', '123');
