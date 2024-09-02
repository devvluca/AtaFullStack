const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config(); // Correção aqui

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Conexão com o MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const attendeeSchema = new mongoose.Schema({
    name: String,
    age: Number,
    conecta: String,
    phone: String,
    presencas: { type: Number, default: 0 },
});

const presenceSchema = new mongoose.Schema({
    attendee_id: mongoose.Schema.Types.ObjectId,
    date: String,
});

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
});

const Attendee = mongoose.model('Attendee', attendeeSchema);
const Presence = mongoose.model('Presence', presenceSchema);
const User = mongoose.model('User', userSchema);

app.use(session({
    secret: 'mysecret',
    resave: false,
    saveUninitialized: true,
}));

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

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    let dbName;
    if (username === 'juv') {
        dbName = 'Juventude';
    } else if (username === 'manha') {
        dbName = 'Recon Manhã';
    } else if (username === 'tarde') {
        dbName = 'Recon Tarde';
    } else {
        return res.render('login', { error: 'Usuário ou senha inválidos' });
    }

    const user = await User.findOne({ username });
    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.user = { username, dbName };
        res.redirect('/');
    } else {
        res.render('login', { error: 'Usuário ou senha inválidos' });
    }
});

// Rota para logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Rota principal
app.get('/', checkAuth, async (req, res) => {
    const attendees = await Attendee.find();
    res.render('index', { attendees, ebd: req.session.user.dbName });
});

// Rota para adicionar participante
app.post('/add', checkAuth, async (req, res) => {
    const { name, age, conecta, phone } = req.body;
    const newAttendee = new Attendee({ name, age, conecta, phone });
    await newAttendee.save();
    res.redirect('/');
});

// Rota para atualizar participante
app.post('/update', checkAuth, async (req, res) => {
    const { id, name, age, conecta, phone } = req.body;
    await Attendee.findByIdAndUpdate(id, { name, age, conecta, phone });
    res.redirect('/');
});

// Rota para adicionar presença
app.post('/add-presenca', checkAuth, async (req, res) => {
    const { id, date } = req.body;
    await Attendee.findByIdAndUpdate(id, { $inc: { presencas: 1 } });
    const newPresence = new Presence({ attendee_id: id, date });
    await newPresence.save();
    res.redirect('/');
});

// Rota para remover presença
app.post('/remove-presenca', checkAuth, async (req, res) => {
    const { id } = req.body;
    const lastPresence = await Presence.findOne({ attendee_id: id }).sort({ date: -1 });

    if (lastPresence) {
        await Presence.findByIdAndDelete(lastPresence._id);
        await Attendee.findByIdAndUpdate(id, { $inc: { presencas: -1 } });
    }

    res.redirect('/');
});

app.get('/presences/:id', checkAuth, async (req, res) => {
    const { id } = req.params;
    const presences = await Presence.find({ attendee_id: id });
    res.render('presences', { presences });
});

// Adicione esta rota para a página de review
app.get('/review', checkAuth, async (req, res) => {
    const currentMonth = new Date().getMonth() + 1; // Janeiro é 0
    const currentYear = new Date().getFullYear();

    const monthParam = currentMonth.toString().padStart(2, '0');
    const yearParam = currentYear.toString();

    const monthAttendance = await Presence.countDocuments({
        date: { $regex: `^${yearParam}-${monthParam}` },
    });

    const yearAttendance = await Presence.countDocuments({
        date: { $regex: `^${yearParam}` },
    });

    const totalAttendees = await Attendee.countDocuments();

    const topAttendee = await Attendee.findOne().sort({ presencas: -1 });

    const noConecta = await Attendee.find({ conecta: 'Nenhum' });

    res.render('review', {
        monthAttendance,
        yearAttendance,
        totalAttendees,
        topAttendee,
        noConecta,
        ebd: req.session.user.dbName,
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
