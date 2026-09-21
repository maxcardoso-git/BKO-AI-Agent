import { PromptBuilderService } from './prompt-builder.service';
import { MandatoryFieldExtractorAgent } from './mandatory-field-extractor.agent';

/**
 * A NOTA DO OPERADOR É A PROVA DE QUE A PRESTADORA AGIU — e estava sendo perdida duas vezes.
 *
 * 1. A extração dos campos obrigatórios lia só a reclamação do CONSUMIDOR. Tentativa de contato
 *    com data e telefone, e-mail de posicionamento, protocolo e providência adotada só existem
 *    na NOTA: os campos voltavam vazios porque a fonte nem era lida.
 * 2. O prompt do redator só proibia INVENTAR. Nada obrigava a não OMITIR — e a resposta saía
 *    sem os contatos e sem o envio do e-mail, que é o que a Anatel avalia.
 *
 * Estes testes olham o CONTRATO (o que é mandado ao modelo e de onde), não a saída do LLM.
 */

const NOTA_REAL = [
  'Não identificamos protocolo de atendimento anterior para a reclamação em tela.',
  'Realizamos 3 tentativas de contato com a Sra. Silvana através do telefone (11) 98765-4321,',
  '08/01/2026 às 09:57, 14/01/2026 às 15:40 e 15/01/2026 às 12:23, porém sem sucesso.',
  'Enviamos o posicionamento através do e-mail usuario215@empresaexemplo.com.br em 15/01/2026.',
].join(' ');

jest.mock('ai', () => ({
  // Intercepta a chamada ao modelo e guarda o que teria sido enviado.
  generateObject: jest.fn(async ({ system, prompt }: any) => {
    (globalThis as any).__ultimoEnvio = { system, prompt };
    return { object: {}, usage: { inputTokens: 0, outputTokens: 0 } };
  }),
  generateText: jest.fn(),
}));

describe('a nota do operador entra na extração', () => {
  const regras = [
    { fieldName: 'providencia_adotada', fieldLabel: 'Providência Adotada', fieldDescription: null },
  ];

  function agente() {
    const modelSelector: any = {
      callWithFallback: jest.fn(async (_tipo: string, fn: any) =>
        fn({ model: {}, config: { maxOutputTokens: 1024, provider: 'test', modelId: 'test' } }),
      ),
    };
    return new MandatoryFieldExtractorAgent(modelSelector);
  }

  const envio = () => (globalThis as any).__ultimoEnvio as { system: string; prompt: string };

  beforeEach(() => { (globalThis as any).__ultimoEnvio = undefined; });

  it('manda a NOTA junto com a reclamação — era a fonte que faltava', async () => {
    await agente().extract('Estou sem internet desde 05/01.', regras, NOTA_REAL);

    expect(envio().prompt).toContain('Nota do operador');
    // Os fatos que a Anatel avalia chegam ao extrator:
    expect(envio().prompt).toContain('(11) 98765-4321');
    expect(envio().prompt).toContain('usuario215@empresaexemplo.com.br');
    expect(envio().prompt).toContain('08/01/2026 às 09:57');
    // E a reclamação continua lá.
    expect(envio().prompt).toContain('Estou sem internet desde 05/01.');
  });

  it('sem nota registrada, diz isso em vez de fingir que a fonte existe', async () => {
    await agente().extract('Estou sem internet.', regras, null);

    expect(envio().prompt).toContain('(sem nota registrada)');
  });

  it('a nota manda sobre o que a PRESTADORA fez, e o que está nela não volta vazio', async () => {
    await agente().extract('Estou sem internet.', regras, NOTA_REAL);

    expect(envio().system).toMatch(/NOTA DO OPERADOR e a apuracao da PRESTADORA/i);
    expect(envio().system).toMatch(/Nao devolva vazio um\s+campo cuja resposta esta na nota/i);
    expect(envio().system).toMatch(/tentativas de contato/i);
    expect(envio().system).toMatch(/envio de posicionamento/i);
  });
});

describe('o prompt do redator proíbe OMITIR, não só inventar', () => {
  const builder = new PromptBuilderService();

  function system(): string {
    const { system } = builder.buildDraftResponsePrompt({
      complaintText: 'Sem internet desde 05/01.',
      operatorNote: NOTA_REAL,
    } as any);
    return system;
  }

  it('manda relatar as tentativas de contato com data, horário e telefone', () => {
    const s = system();
    expect(s).toMatch(/TENTATIVAS DE CONTATO/i);
    expect(s).toMatch(/DATA/);
    expect(s).toMatch(/NÚMERO de telefone/i);
    // Tentativa sem sucesso também conta: é ação da prestadora.
    expect(s).toMatch(/sem sucesso|sem êxito/i);
  });

  it('manda dizer o canal, o endereço e a data do posicionamento enviado', () => {
    const s = system();
    expect(s).toMatch(/ENVIO DE POSICIONAMENTO/i);
    expect(s).toMatch(/e-mail, carta, SMS ou WhatsApp/i);
  });

  it('NÃO afrouxa a proibição de inventar', () => {
    const s = system();
    expect(s).toMatch(/NUNCA invente/);
    // A regra nova diz explicitamente que continua proibido citar o que não está na nota.
    expect(s).toMatch(/continua proibido citar telefone, canal ou data que não/i);
  });

  it('a nota do operador continua chegando ao modelo como contexto prioritário', () => {
    const s = system();
    expect(s).toContain('NOTA DO OPERADOR');
    expect(s).toContain('(11) 98765-4321');
    expect(s).toContain('usuario215@empresaexemplo.com.br');
  });
});
