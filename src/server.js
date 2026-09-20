const path = require('node:path');
const { criarApp } = require('./app');
const { Banco } = require('./db');

const banco = new Banco(path.join(__dirname, '..', 'data', 'livraria.json'));
const porta = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) console.warn('Aviso: JWT_SECRET não definido; os logins expiram ao reiniciar.');
criarApp(banco).listen(porta, () => console.log(`API Livraria rodando em http://localhost:${porta}`));
