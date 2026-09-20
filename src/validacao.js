// Cada validador devolve { erros, dados }. Com parcial=true (PATCH) todos os campos são opcionais.
function campos(corpo, parcial, regras) {
  const erros = [];
  const dados = {};
  for (const [campo, { tipo, obrigatorio }] of Object.entries(regras)) {
    const v = corpo[campo];
    if (v === undefined) {
      if (obrigatorio && !parcial) erros.push(`${campo} é obrigatório`);
      continue;
    }
    if (tipo === 'texto') {
      if (typeof v !== 'string' || !v.trim()) erros.push(`${campo} deve ser um texto não vazio`);
      else dados[campo] = v.trim();
    } else if (tipo === 'preco') {
      if (typeof v !== 'number' || !(v >= 0)) erros.push(`${campo} deve ser um número >= 0`);
      else dados[campo] = v;
    } else if (tipo === 'inteiro') {
      if (!Number.isInteger(v) || v < 0) erros.push(`${campo} deve ser um inteiro >= 0`);
      else dados[campo] = v;
    } else if (tipo === 'email') {
      if (typeof v !== 'string' || !/^\S+@\S+\.\S+$/.test(v)) erros.push(`${campo} inválido`);
      else dados[campo] = v.trim().toLowerCase();
    } else if (tipo === 'senha') {
      if (typeof v !== 'string' || v.length < 6) erros.push(`${campo} deve ter ao menos 6 caracteres`);
      else dados[campo] = v;
    }
  }
  return { erros, dados };
}

const validarLivro = (corpo, { parcial = false } = {}) => {
  const r = campos(corpo, parcial, {
    titulo: { tipo: 'texto', obrigatorio: true },
    autor: { tipo: 'texto', obrigatorio: corpo.autorId === undefined },
    genero: { tipo: 'texto' },
    isbn: { tipo: 'texto' },
    preco: { tipo: 'preco', obrigatorio: true },
    estoque: { tipo: 'inteiro' },
    anoPublicacao: { tipo: 'inteiro' },
    autorId: { tipo: 'inteiro' },
    categoriaId: { tipo: 'inteiro' },
  });
  if (!parcial && r.dados.estoque === undefined) r.dados.estoque = 0;
  return r;
};

const validarNome = (corpo, { parcial = false } = {}) =>
  campos(corpo, parcial, { nome: { tipo: 'texto', obrigatorio: true } });

const validarAutor = (corpo, { parcial = false } = {}) =>
  campos(corpo, parcial, { nome: { tipo: 'texto', obrigatorio: true }, biografia: { tipo: 'texto' } });

const validarRegistro = (corpo) =>
  campos(corpo, false, {
    nome: { tipo: 'texto', obrigatorio: true },
    email: { tipo: 'email', obrigatorio: true },
    senha: { tipo: 'senha', obrigatorio: true },
  });

function validarPedido(corpo) {
  const erros = [];
  if (!Array.isArray(corpo.itens) || !corpo.itens.length) return { erros: ['itens deve ser uma lista não vazia'] };
  const itens = new Map();
  for (const [i, item] of corpo.itens.entries()) {
    if (!Number.isInteger(item?.livroId) || !Number.isInteger(item?.quantidade) || item.quantidade < 1) {
      erros.push(`itens[${i}] precisa de livroId e quantidade inteiros (quantidade >= 1)`);
    } else {
      itens.set(item.livroId, (itens.get(item.livroId) || 0) + item.quantidade);
    }
  }
  return { erros, itens };
}

module.exports = { validarLivro, validarNome, validarAutor, validarRegistro, validarPedido };
