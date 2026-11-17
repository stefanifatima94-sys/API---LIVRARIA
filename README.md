# API Livraria 📚

API REST para gestão de uma livraria (livros, autores, categorias, usuários e pedidos), desenvolvida em **Node.js** com **Express**, com autenticação por token, controle de acesso por perfil e testes automatizados.

## Tecnologias

- Node.js (módulos nativos `crypto`, `fs` e `node:test`)
- Express 5
- Persistência em arquivo JSON

## Destaques

- **Autenticação JWT** implementada do zero, com assinatura HMAC-SHA256 e expiração de 24h
- **Senhas com hash scrypt** e salt aleatório (a senha nunca é armazenada nem devolvida)
- **Controle de acesso por perfil**: o primeiro usuário cadastrado vira `admin`, os demais são `cliente`
- **CRUD completo** com `GET`, `POST`, `PUT` (substituição) e `PATCH` (atualização parcial)
- **Pedidos com regra de negócio**: baixa automática de estoque, cálculo do total, cancelamento com devolução ao estoque e fluxo de status `criado → pago → enviado → entregue`
- **Integridade dos dados**: um autor ou categoria com livros vinculados não pode ser excluído (`409 Conflict`)
- **Validação de entrada** com mensagens de erro claras e status HTTP adequados (`201`, `204`, `400`, `401`, `403`, `404`, `409`)
- **Busca e filtros** de livros por título, autor, gênero, `autorId` e `categoriaId`
- **Teste automatizado** de ponta a ponta com o test runner nativo do Node.js

## Como executar

Pré-requisito: [Node.js](https://nodejs.org/) 18 ou superior.

```bash
git clone https://github.com/stefanifatima94-sys/API---LIVRARIA.git
cd API---LIVRARIA
npm install
npm start        # ou: npm run dev (reinicia ao salvar)
npm test         # roda os testes automatizados
```

A API sobe em `http://localhost:3000`. Variáveis de ambiente opcionais:

| Variável     | Uso                                                              |
|--------------|------------------------------------------------------------------|
| `PORT`       | Porta do servidor (padrão `3000`)                                |
| `JWT_SECRET` | Segredo de assinatura dos tokens (sem ele, os logins expiram ao reiniciar) |

## Autenticação

1. Cadastre-se em `POST /auth/registrar` ou entre em `POST /auth/login`. A resposta traz um `token`.
2. Envie o token nas rotas protegidas:

```http
Authorization: Bearer <token>
```

## Endpoints

Legenda: 🌐 público · 🔑 usuário logado · 👑 somente admin

### Autenticação

| Método | Rota              | Acesso | Descrição                 |
|--------|-------------------|--------|---------------------------|
| POST   | `/auth/registrar` | 🌐     | Cria conta e retorna token |
| POST   | `/auth/login`     | 🌐     | Login e retorna token      |
| GET    | `/auth/eu`        | 🔑     | Dados do usuário logado    |

### Livros, autores e categorias

| Método       | Rota                                      | Acesso | Descrição                         |
|--------------|-------------------------------------------|--------|-----------------------------------|
| GET          | `/livros`                                 | 🌐     | Lista com filtros (`?busca=`, `?autor=`, `?genero=`, `?autorId=`, `?categoriaId=`) |
| GET          | `/livros/:id`                             | 🌐     | Detalhe de um livro               |
| POST         | `/livros`                                 | 👑     | Cadastra livro                    |
| PUT / PATCH  | `/livros/:id`                             | 👑     | Atualiza livro (total / parcial)  |
| DELETE       | `/livros/:id`                             | 👑     | Remove livro                      |
| GET          | `/autores` · `/categorias`                | 🌐     | Lista                             |
| GET          | `/autores/:id` · `/categorias/:id`        | 🌐     | Detalhe                           |
| POST         | `/autores` · `/categorias`                | 👑     | Cadastra                          |
| PUT / PATCH  | `/autores/:id` · `/categorias/:id`        | 👑     | Atualiza                          |
| DELETE       | `/autores/:id` · `/categorias/:id`        | 👑     | Remove (bloqueado se houver livros) |

### Pedidos

| Método | Rota                     | Acesso | Descrição                                        |
|--------|--------------------------|--------|--------------------------------------------------|
| POST   | `/pedidos`               | 🔑     | Cria pedido e dá baixa no estoque                |
| GET    | `/pedidos`               | 🔑     | Lista pedidos (cliente vê só os seus; admin vê todos) |
| GET    | `/pedidos/:id`           | 🔑     | Detalhe do pedido                                |
| POST   | `/pedidos/:id/cancelar`  | 🔑     | Cancela e devolve os itens ao estoque            |
| PATCH  | `/pedidos/:id/status`    | 👑     | Avança o status (`pago`, `enviado`, `entregue`)  |

### Exemplo – criar um pedido

```http
POST /pedidos
Authorization: Bearer <token>
Content-Type: application/json

{ "itens": [ { "livroId": 1, "quantidade": 2 } ] }
```

Resposta `201 Created`:

```json
{
  "id": 1,
  "usuarioId": 2,
  "itens": [{ "livroId": 1, "titulo": "Dom Casmurro", "precoUnitario": 30, "quantidade": 2 }],
  "total": 60,
  "status": "criado"
}
```

Sem estoque suficiente, a API responde `409 Conflict` informando a quantidade disponível.

## Estrutura

```
src/
├── server.js      # inicialização do servidor
├── app.js         # rotas e regras de negócio
├── auth.js        # hash de senha, geração/validação de token e middlewares
├── validacao.js   # validação dos dados de entrada
└── db.js          # persistência em arquivo JSON (data/livraria.json)
app.test.js        # teste de ponta a ponta (auth, permissões, livros e pedidos)
```

## Autora

**Stefani Fatima** – [LinkedIn](https://www.linkedin.com/in/stefani-fatima-288ba52a0) · [GitHub](https://github.com/stefanifatima94-sys)
