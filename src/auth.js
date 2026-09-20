const crypto = require('node:crypto');

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

function hashSenha(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  return `${sal}:${crypto.scryptSync(senha, sal, 64).toString('hex')}`;
}

function conferirSenha(senha, armazenado) {
  const [sal, hash] = armazenado.split(':');
  const calculado = crypto.scryptSync(senha, sal, 64);
  return crypto.timingSafeEqual(calculado, Buffer.from(hash, 'hex'));
}

// Sem JWT_SECRET definido, usa um segredo aleatório (tokens deixam de valer ao reiniciar).
const segredo = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const assinar = (dados) => crypto.createHmac('sha256', segredo).update(dados).digest('base64url');

function gerarToken(usuario, duracaoSeg = 60 * 60 * 24) {
  const corpo = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    sub: usuario.id,
    exp: Math.floor(Date.now() / 1000) + duracaoSeg,
  })}`;
  return `${corpo}.${assinar(corpo)}`;
}

function verificarToken(token) {
  const partes = String(token).split('.');
  if (partes.length !== 3) return null;
  const esperado = Buffer.from(assinar(`${partes[0]}.${partes[1]}`));
  const recebido = Buffer.from(partes[2]);
  if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) return null;
  try {
    const payload = JSON.parse(Buffer.from(partes[1], 'base64url').toString());
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
}

function criarMiddlewares(usuarios) {
  const autenticar = (req, res, next) => {
    const payload = verificarToken((req.headers.authorization || '').replace(/^Bearer /, ''));
    const usuario = payload && usuarios.buscar(payload.sub);
    if (!usuario) return res.status(401).json({ erro: 'Não autenticado' });
    req.usuario = usuario;
    next();
  };
  const exigirAdmin = (req, res, next) =>
    req.usuario.papel === 'admin' ? next() : res.status(403).json({ erro: 'Acesso restrito a administradores' });
  return { autenticar, exigirAdmin };
}

module.exports = { hashSenha, conferirSenha, gerarToken, criarMiddlewares };
