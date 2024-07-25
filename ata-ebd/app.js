const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'mysecret',
    resave: false,
    saveUninitialized: true,
}));

// Função para inicializar o banco de dados
function initializeDB(dbPath) {
    const db = new sqlite3.Database(dbPath);
    db.serialize(() => {
        db.run("CREATE TABLE IF NOT EXISTS attendees (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, conecta TEXT, phone TEXT, presencas INTEGER)");
        db.run("CREATE TABLE IF NOT EXISTS presences (id INTEGER PRIMARY KEY AUTOINCREMENT, attendee_id INTEGER, date TEXT, FOREIGN KEY(attendee_id) REFERENCES attendees(id))");
    });
    return db;
}

// Middleware de autenticação
function checkAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Rota para login
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    let dbPath, ebdName;
    if (username === 'juv') {
        dbPath = './databases/juv.db';
        ebdName = 'Juventude';
    } else if (username === 'manha') {
        dbPath = './databases/manha.db';
        ebdName = 'Recon Manhã';
    } else if (username === 'tarde') {
        dbPath = './databases/tarde.db';
        ebdName = 'Recon Tarde';
    } else {
        return res.render('login', { error: 'Usuário ou senha inválidos' });
    }

    const db = new sqlite3.Database(dbPath);
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) throw err;
        if (user && bcrypt.compareSync(password, user.password)) {
            req.session.user = { username, dbPath, ebdName };
            res.redirect('/');
        } else {
            res.render('login', { error: 'Usuário ou senha inválidos' });
        }
    });
});

// Rota para logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Rota principal
app.get('/', checkAuth, (req, res) => {
    const db = new sqlite3.Database(req.session.user.dbPath);
    db.all("SELECT * FROM attendees", (err, rows) => {
        if (err) throw err;
        res.render('index', { attendees: rows, ebd: req.session.user.ebdName });
    });
});

app.post('/add', checkAuth, (req, res) => {
    const { name, age, conecta, phone } = req.body;
    const db = new sqlite3.Database(req.session.user.dbPath);
    db.run("INSERT INTO attendees (name, age, conecta, phone, presencas) VALUES (?, ?, ?, ?, 0)", [name, age, conecta, phone], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

app.post('/update', checkAuth, (req, res) => {
    const { id, name, age, conecta, phone } = req.body;
    const db = new sqlite3.Database(req.session.user.dbPath);
    db.run("UPDATE attendees SET name = ?, age = ?, conecta = ?, phone = ? WHERE id = ?", [name, age, conecta, phone, id], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

app.post('/add-presenca', checkAuth, (req, res) => {
    const { id, date } = req.body;
    const db = new sqlite3.Database(req.session.user.dbPath);
    db.run("UPDATE attendees SET presencas = presencas + 1 WHERE id = ?", [id], (err) => {
        if (err) throw err;
        db.run("INSERT INTO presences (attendee_id, date) VALUES (?, ?)", [id, date], (err) => {
            if (err) throw err;
            res.redirect('/');
        });
    });
});

app.post('/remove-presenca', checkAuth, (req, res) => {
    const { id } = req.body;
    const db = new sqlite3.Database(req.session.user.dbPath);
    db.get("SELECT date FROM presences WHERE attendee_id = ? ORDER BY date DESC LIMIT 1", [id], (err, row) => {
        if (err) throw err;
        if (row) {
            const date = row.date;
            db.run("DELETE FROM presences WHERE attendee_id = ? AND date = ?", [id, date], (err) => {
                if (err) throw err;
                db.run("UPDATE attendees SET presencas = presencas - 1 WHERE id = ?", [id], (err) => {
                    if (err) throw err;
                    res.redirect('/');
                });
            });
        } else {
            res.redirect('/');
        }
    });
});

app.get('/presences/:id', checkAuth, (req, res) => {
    const { id } = req.params;
    const db = new sqlite3.Database(req.session.user.dbPath);
    db.all("SELECT date FROM presences WHERE attendee_id = ?", [id], (err, rows) => {
        if (err) throw err;
        res.render('presences', { presences: rows });
    });
});

// Inicializar bancos de dados
initializeDB('./databases/juv.db');
initializeDB('./databases/manha.db');
initializeDB('./databases/tarde.db');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

// Rota para adicionar participante
app.post('/add', checkAuth, (req, res) => {
    const { name, age, conecta, phone } = req.body;
    const db = new sqlite3.Database(req.session.user.dbPath);
    db.run("INSERT INTO attendees (name, age, conecta, phone, presencas) VALUES (?, ?, ?, ?, 0)", [name, age, conecta, phone], function (err) {
        if (err) {
            console.error(err.message);
            return res.redirect('/');
        }
        res.redirect('/');
    });
});

// Rota para atualizar participante
app.post('/update', checkAuth, (req, res) => {
    const { id, name, age, conecta, phone } = req.body;
    const db = new sqlite3.Database(req.session.user.dbPath);
    db.run("UPDATE attendees SET name = ?, age = ?, conecta = ?, phone = ? WHERE id = ?", [name, age, conecta, phone, id], function (err) {
        if (err) {
            console.error(err.message);
            return res.redirect('/');
        }
        res.redirect('/');
    });
});

// Rota para adicionar presença
app.post('/add-presenca', checkAuth, (req, res) => {
    const { id, date } = req.body;
    const db = new sqlite3.Database(req.session.user.dbPath);
    db.run("UPDATE attendees SET presencas = presencas + 1 WHERE id = ?", [id], function (err) {
        if (err) {
            console.error(err.message);
            return res.redirect('/');
        }
        db.run("INSERT INTO presences (attendee_id, date) VALUES (?, ?)", [id, date], function (err) {
            if (err) {
                console.error(err.message);
                return res.redirect('/');
            }
            res.redirect('/');
        });
    });
});

// Rota para remover presença
app.post('/remove-presenca', checkAuth, (req, res) => {
    const { id } = req.body;
    const db = new sqlite3.Database(req.session.user.dbPath);
    db.get("SELECT date FROM presences WHERE attendee_id = ? ORDER BY date DESC LIMIT 1", [id], function (err, row) {
        if (err) {
            console.error(err.message);
            return res.redirect('/');
        }
        if (row) {
            const date = row.date;
            db.run("DELETE FROM presences WHERE attendee_id = ? AND date = ?", [id, date], function (err) {
                if (err) {
                    console.error(err.message);
                    return res.redirect('/');
                }
                db.run("UPDATE attendees SET presencas = presencas - 1 WHERE id = ?", [id], function (err) {
                    if (err) {
                        console.error(err.message);
                        return res.redirect('/');
                    }
                    res.redirect('/');
                });
            });
        } else {
            res.redirect('/');
        }
    });
});


