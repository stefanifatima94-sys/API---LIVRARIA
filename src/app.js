const express = require('express');
const v = require('./validacao');
const { hashSenha, conferirSenha, gerarToken, criarMiddlewares } = require('./auth');

const semSenha = ({ senhaHash, ...resto }) => resto;
const naoEncontrado = (res, o = 'Registro') => res.status(404).json({ erro: `${o} não encontrado` });
const invalido = (res, erros) => res.status(400).json({ erros });

// CRUD com leitura pública e escrita restrita a admin (autores e categorias).
function crudSimples({ colecao, validar, emUso, autenticar, exigirAdmin, rotulo }) {
  const r = express.Router();
  const admin = [autenticar, exigirAdmin];

  r.get('/', (req, res) => res.json(colecao.listar()));
  r.get('/:id', (req, res) => {
    const item = colecao.buscar(Number(req.params.id));
    item ? res.json(item) : naoEncontrado(res, rotulo);
  });
  r.post('/', admin, (req, res) => {
    const { erros, dados } = validar(req.body ?? {});
    if (erros.length) return invalido(res, erros);
    res.status(201).json(colecao.criar(dados));
  });
  for (const [metodo, parcial] of [['put', false], ['patch', true]]) {
    r[metodo]('/:id', admin, (req, res) => {
      const { erros, dados } = validar(req.body ?? {}, { parcial });
      if (erros.length) return invalido(res, erros);
      const item = colecao.atualizar(Number(req.params.id), dados);
      item ? res.json(item) : naoEncontrado(res, rotulo);
    });
  }
  r.delete('/:id', admin, (req, res) => {
    const id = Number(req.params.id);
    if (colecao.buscar(id) && emUso(id)) return res.status(409).json({ erro: `${rotulo} possui livros vinculados` });
    colecao.remover(id) ? res.status(204).end() : naoEncontrado(res, rotulo);
  });
  return r;
}

function criarApp(banco) {
  const livros = banco.colecao('livros');
  const autores = banco.colecao('autores');
  const categorias = banco.colecao('categorias');
  const usuarios = banco.colecao('usuarios');
  const pedidos = banco.colecao('pedidos');
  const { autenticar, exigirAdmin } = criarMiddlewares(usuarios);
  const admin = [autenticar, exigirAdmin];

  const app = express();
  app.use(express.json());

  app.get('/', (req, res) =>
    res.json({ nome: 'API Livraria', rotas: ['/auth', '/livros', '/autores', '/categorias', '/pedidos'] })
  );

  // ---- Autenticação ----
  app.post('/auth/registrar', (req, res) => {
    const { erros, dados } = v.validarRegistro(req.body ?? {});
    if (erros.length) return invalido(res, erros);
    if (usuarios.listar((u) => u.email === dados.email).length) {
      return res.status(409).json({ erro: 'E-mail já cadastrado' });
    }
    const primeiro = usuarios.listar().length === 0; // o primeiro usuário vira admin
    const usuario = usuarios.criar({
      nome: dados.nome,
      email: dados.email,
      senhaHash: hashSenha(dados.senha),
      papel: primeiro ? 'admin' : 'cliente',
    });
    res.status(201).json({ usuario: semSenha(usuario), token: gerarToken(usuario) });
  });

  app.post('/auth/login', (req, res) => {
    const { email, senha } = req.body ?? {};
    const usuario = usuarios.listar((u) => u.email === String(email).trim().toLowerCase())[0];
    if (!usuario || typeof senha !== 'string' || !conferirSenha(senha, usuario.senhaHash)) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos' });
    }
    res.json({ usuario: semSenha(usuario), token: gerarToken(usuario) });
  });

  app.get('/auth/eu', autenticar, (req, res) => res.json(semSenha(req.usuario)));

  // ---- Autores e categorias ----
  const base = { autenticar, exigirAdmin };
  app.use('/autores', crudSimples({
    ...base, colecao: autores, validar: v.validarAutor, rotulo: 'Autor',
    emUso: (id) => livros.listar((l) => l.autorId === id).length > 0,
  }));
  app.use('/categorias', crudSimples({
    ...base, colecao: categorias, validar: v.validarNome, rotulo: 'Categoria',
    emUso: (id) => livros.listar((l) => l.categoriaId === id).length > 0,
  }));

  // ---- Livros ----
  // autorId/categoriaId preenchem os campos de texto autor/genero automaticamente.
  function resolverRelacoes(dados) {
    if (dados.autorId !== undefined) {
      const a = autores.buscar(dados.autorId);
      if (!a) return 'autorId não existe';
      dados.autor = a.nome;
    }
    if (dados.categoriaId !== undefined) {
      const c = categorias.buscar(dados.categoriaId);
      if (!c) return 'categoriaId não existe';
      dados.genero = c.nome;
    }
  }

  app.get('/livros', (req, res) => {
    const { busca, autor, genero, autorId, categoriaId } = req.query;
    const tem = (campo, termo) => String(campo ?? '').toLowerCase().includes(String(termo).toLowerCase());
    res.json(livros.listar((l) =>
      (!busca || tem(l.titulo, busca)) &&
      (!autor || tem(l.autor, autor)) &&
      (!genero || String(l.genero ?? '').toLowerCase() === String(genero).toLowerCase()) &&
      (!autorId || l.autorId === Number(autorId)) &&
      (!categoriaId || l.categoriaId === Number(categoriaId))
    ));
  });

  app.get('/livros/:id', (req, res) => {
    const livro = livros.buscar(Number(req.params.id));
    livro ? res.json(livro) : naoEncontrado(res, 'Livro');
  });

  app.post('/livros', admin, (req, res) => {
    const { erros, dados } = v.validarLivro(req.body ?? {});
    const erroRel = !erros.length && resolverRelacoes(dados);
    if (erros.length || erroRel) return invalido(res, erroRel ? [erroRel] : erros);
    res.status(201).json(livros.criar(dados));
  });

  for (const [metodo, parcial] of [['put', false], ['patch', true]]) {
    app[metodo]('/livros/:id', admin, (req, res) => {
      const { erros, dados } = v.validarLivro(req.body ?? {}, { parcial });
      const erroRel = !erros.length && resolverRelacoes(dados);
      if (erros.length || erroRel) return invalido(res, erroRel ? [erroRel] : erros);
      const livro = livros.atualizar(Number(req.params.id), dados);
      livro ? res.json(livro) : naoEncontrado(res, 'Livro');
    });
  }

  app.delete('/livros/:id', admin, (req, res) => {
    livros.remover(Number(req.params.id)) ? res.status(204).end() : naoEncontrado(res, 'Livro');
  });

  // ---- Pedidos ----
  const podeVer = (req, p) => req.usuario.papel === 'admin' || p.usuarioId === req.usuario.id;

  app.post('/pedidos', autenticar, (req, res) => {
    const { erros, itens } = v.validarPedido(req.body ?? {});
    if (erros.length) return invalido(res, erros);

    const linhas = [];
    for (const [livroId, quantidade] of itens) {
      const livro = livros.buscar(livroId);
      if (!livro) return invalido(res, [`Livro ${livroId} não existe`]);
      if (livro.estoque < quantidade) {
        return res.status(409).json({ erro: `Estoque insuficiente para "${livro.titulo}" (disponível: ${livro.estoque})` });
      }
      linhas.push({ livro, quantidade });
    }

    for (const { livro, quantidade } of linhas) livros.atualizar(livro.id, { estoque: livro.estoque - quantidade });
    const itensPedido = linhas.map(({ livro, quantidade }) => ({
      livroId: livro.id, titulo: livro.titulo, precoUnitario: livro.preco, quantidade,
    }));
    const total = Math.round(itensPedido.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0) * 100) / 100;
    res.status(201).json(pedidos.criar({ usuarioId: req.usuario.id, itens: itensPedido, total, status: 'criado' }));
  });

  app.get('/pedidos', autenticar, (req, res) => {
    res.json(pedidos.listar((p) => podeVer(req, p)));
  });

  app.get('/pedidos/:id', autenticar, (req, res) => {
    const p = pedidos.buscar(Number(req.params.id));
    p && podeVer(req, p) ? res.json(p) : naoEncontrado(res, 'Pedido');
  });

  app.post('/pedidos/:id/cancelar', autenticar, (req, res) => {
    const p = pedidos.buscar(Number(req.params.id));
    if (!p || !podeVer(req, p)) return naoEncontrado(res, 'Pedido');
    if (p.status !== 'criado') return res.status(409).json({ erro: `Pedido já está ${p.status}` });
    for (const i of p.itens) {
      const livro = livros.buscar(i.livroId);
      if (livro) livros.atualizar(livro.id, { estoque: livro.estoque + i.quantidade });
    }
    res.json(pedidos.atualizar(p.id, { status: 'cancelado' }));
  });

  // Admin avança o status: criado -> pago -> enviado -> entregue
  app.patch('/pedidos/:id/status', admin, (req, res) => {
    const validos = ['criado', 'pago', 'enviado', 'entregue'];
    if (!validos.includes(req.body?.status)) return invalido(res, [`status deve ser um de: ${validos.join(', ')}`]);
    const p = pedidos.buscar(Number(req.params.id));
    if (!p) return naoEncontrado(res, 'Pedido');
    if (p.status === 'cancelado') return res.status(409).json({ erro: 'Pedido cancelado' });
    res.json(pedidos.atualizar(p.id, { status: req.body.status }));
  });

  app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido' });
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
  });

  return app;
}

module.exports = { criarApp };
