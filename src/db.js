const fs = require('node:fs');
const path = require('node:path');

// Banco simples em arquivo JSON: { seq: {colecao: proximoId}, dados: {colecao: [...]} }
class Banco {
  constructor(arquivo) {
    this.arquivo = arquivo;
    this.estado = { seq: {}, dados: {} };
    if (arquivo && fs.existsSync(arquivo)) this.estado = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  }

  salvar() {
    if (!this.arquivo) return;
    fs.mkdirSync(path.dirname(this.arquivo), { recursive: true });
    fs.writeFileSync(this.arquivo, JSON.stringify(this.estado, null, 2));
  }

  colecao(nome) {
    this.estado.dados[nome] ??= [];
    this.estado.seq[nome] ??= 1;
    return new Colecao(this, nome);
  }
}

class Colecao {
  constructor(banco, nome) {
    this.banco = banco;
    this.nome = nome;
  }

  get itens() {
    return this.banco.estado.dados[this.nome];
  }

  listar(filtro = () => true) {
    return this.itens.filter(filtro);
  }

  buscar(id) {
    return this.itens.find((i) => i.id === id);
  }

  criar(dados) {
    const item = { id: this.banco.estado.seq[this.nome]++, ...dados, criadoEm: new Date().toISOString() };
    this.itens.push(item);
    this.banco.salvar();
    return item;
  }

  atualizar(id, dados) {
    const item = this.buscar(id);
    if (!item) return undefined;
    Object.assign(item, dados, { atualizadoEm: new Date().toISOString() });
    this.banco.salvar();
    return item;
  }

  remover(id) {
    const i = this.itens.findIndex((x) => x.id === id);
    if (i === -1) return false;
    this.itens.splice(i, 1);
    this.banco.salvar();
    return true;
  }
}

module.exports = { Banco };
