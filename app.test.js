const test = require('node:test');
const assert = require('node:assert');
const { criarApp } = require('./src/app');
const { Banco } = require('./src/db');

test('fluxo completo da livraria', async (t) => {
  const server = criarApp(new Banco(null)).listen(0);
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}`;
  const req = async (p, { method = 'GET', body, token } = {}) => {
    const r = await fetch(base + p, {
      method,
      headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
      body: body && JSON.stringify(body),
    });
    return { status: r.status, corpo: r.status === 204 ? null : await r.json() };
  };

  // Auth: primeiro usuário é admin, segundo é cliente
  const adm = (await req('/auth/registrar', { method: 'POST', body: { nome: 'Ana', email: 'ana@x.com', senha: '123456' } })).corpo;
  assert.equal(adm.usuario.papel, 'admin');
  assert.equal(adm.usuario.senhaHash, undefined);
  const cli = (await req('/auth/registrar', { method: 'POST', body: { nome: 'Bia', email: 'bia@x.com', senha: '123456' } })).corpo;
  assert.equal(cli.usuario.papel, 'cliente');
  assert.equal((await req('/auth/registrar', { method: 'POST', body: { nome: 'Z', email: 'ana@x.com', senha: '123456' } })).status, 409);
  assert.equal((await req('/auth/login', { method: 'POST', body: { email: 'ana@x.com', senha: 'errada' } })).status, 401);
  assert.equal((await req('/auth/login', { method: 'POST', body: { email: 'ana@x.com', senha: '123456' } })).status, 200);

  // Permissões
  const novoLivro = { titulo: 'Dom Casmurro', preco: 30 };
  assert.equal((await req('/livros', { method: 'POST', body: { ...novoLivro, autor: 'X' } })).status, 401);
  assert.equal((await req('/livros', { method: 'POST', body: { ...novoLivro, autor: 'X' }, token: cli.token })).status, 403);

  // Autor e categoria
  const autor = (await req('/autores', { method: 'POST', body: { nome: 'Machado de Assis' }, token: adm.token })).corpo;
  const cat = (await req('/categorias', { method: 'POST', body: { nome: 'Romance' }, token: adm.token })).corpo;
  let r = await req('/livros', { method: 'POST', token: adm.token, body: { ...novoLivro, autorId: autor.id, categoriaId: cat.id, estoque: 3 } });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.autor, 'Machado de Assis');
  assert.equal(r.corpo.genero, 'Romance');
  assert.equal((await req('/livros', { method: 'POST', token: adm.token, body: { ...novoLivro, autorId: 99 } })).status, 400);
  assert.equal((await req(`/autores/${autor.id}`, { method: 'DELETE', token: adm.token })).status, 409);
  assert.equal((await req('/livros?busca=casmurro')).corpo.length, 1);

  // Pedido: baixa estoque, calcula total, cancela e devolve estoque
  assert.equal((await req('/pedidos', { method: 'POST', body: { itens: [{ livroId: 1, quantidade: 1 }] } })).status, 401);
  assert.equal((await req('/pedidos', { method: 'POST', token: cli.token, body: { itens: [{ livroId: 1, quantidade: 9 }] } })).status, 409);
  r = await req('/pedidos', { method: 'POST', token: cli.token, body: { itens: [{ livroId: 1, quantidade: 2 }] } });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.total, 60);
  assert.equal((await req('/livros/1')).corpo.estoque, 1);
  assert.equal((await req('/pedidos', { token: adm.token })).corpo.length, 1);
  assert.equal((await req('/pedidos/1', { token: adm.token })).status, 200);
  r = await req('/pedidos/1/cancelar', { method: 'POST', token: cli.token });
  assert.equal(r.corpo.status, 'cancelado');
  assert.equal((await req('/livros/1')).corpo.estoque, 3);
  assert.equal((await req('/pedidos/1/cancelar', { method: 'POST', token: cli.token })).status, 409);
});
