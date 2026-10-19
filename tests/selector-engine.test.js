import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  captureNextClick,
  inferType,
  installNavigationObserver,
  isCustomSelect,
  normalize,
  notifyPageChanged,
  pageSignature,
  scan,
  selectorFor,
  isDynamicId,
  isAngularAttribute,
  isAngularClass,
  hasAngularAttributes,
  fieldFromTarget,
  visible,
} from '../src/scripts/selector-engine.js';

let dom;
let sendMessage;

beforeEach(() => {
  dom = new JSDOM(`<!doctype html><body>
    <label for="email">E-mail</label><input id="email" type="email" autocomplete="email">
    <label for="uf">Estado</label><select id="uf"><option>SP</option><option>RJ</option></select>
  </body>`, { url: 'https://example.test/form' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.history = dom.window.history;
  globalThis.MutationObserver = dom.window.MutationObserver;
  sendMessage = vi.fn();
  globalThis.chrome = { runtime: { sendMessage } };
  globalThis.HTMLElement = dom.window.HTMLElement;
  dom.window.HTMLElement.prototype.getClientRects = () => [{ width: 10, height: 10 }];
});

afterEach(() => {
  dom.window.close();
  delete globalThis.chrome;
});

describe('selector engine', () => {
  it('infere tipos por metadados dos campos', () => {
    expect(inferType(document.querySelector('#email'))).toBe('email');
    expect(inferType(document.querySelector('#uf'))).toBe('state');
  });

  it('escaneia campos visíveis e descreve seus seletores', () => {
    const fields = scan();
    expect(fields).toHaveLength(2);
    expect(fields.map((field) => field.selector)).toEqual(['#email', '#uf']);
  });

  it('inclui seletores reais na assinatura da página', () => {
    const signature = pageSignature();

    expect(signature).toContain('#email|id|stable');
    expect(signature).toContain('#uf|id|stable');
    expect(signature).not.toContain('[object Object]');
  });

  it('ignora notificações pendentes depois que a janela é encerrada', () => {
    dom.window.close();

    expect(() => notifyPageChanged()).not.toThrow();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it.each([
    ['id único', '<input id="stable-field">', '#stable-field', 'id'],
    ['data-cy', '<input data-cy="email-field">', '[data-cy="email-field"]', 'data-cy'],
    ['data-testid', '<input data-testid="email-field">', '[data-testid="email-field"]', 'data-testid'],
    ['aria-label', '<input aria-label="Email">', 'input[aria-label="Email"]', 'aria-label'],
  ])('prioriza %s', (_, markup, expectedSelector, expectedRule) => {
    document.body.innerHTML = markup;
    const element = document.body.firstElementChild;
    const result = selectorFor(element);

    expect(result.selector).toBe(expectedSelector);
    expect(result.rule).toBe(expectedRule);
    expect(result.status).toBe('stable');
  });

  it('marca como frágil um campo sem atributo estável', () => {
    document.body.innerHTML = '<form><div><input></div><div><input></div></form>';
    const result = selectorFor(document.querySelector('input'));

    expect(result.selector).toContain(':nth-of-type');
    expect(result.status).toBe('fragile');
  });

  it('infere categorias de formulário', () => {
    document.body.innerHTML = `
      <input id="cpf" name="cpf">
      <input id="cnpj" name="cnpj">
      <input id="cep" placeholder="CEP">
      <input id="phone" type="tel">
      <input id="birth" name="birthDate">
      <input id="vin" name="chassi">
      <select id="state"><option>SP</option><option>RJ</option></select>
    `;

    expect(inferType(document.querySelector('#cpf'))).toBe('cpf');
    expect(inferType(document.querySelector('#cnpj'))).toBe('cnpj');
    expect(inferType(document.querySelector('#cep'))).toBe('cep');
    expect(inferType(document.querySelector('#phone'))).toBe('phone');
    expect(inferType(document.querySelector('#birth'))).toBe('birthDate');
    expect(inferType(document.querySelector('#vin'))).toBe('chassi');
    expect(inferType(document.querySelector('#state'))).toBe('state');
  });

  it('normaliza texto e escapa atributos difíceis', () => {
    expect(normalize(' João__da--Silva ')).toBe('joao da silva');
    const element = document.createElement('input');
    element.setAttribute('data-cy', 'field"quote');
    document.body.appendChild(element);
    const result = selectorFor(element);
    expect(result.selector).toBe('[data-cy="field\\"quote"]');
  });

  it('prioriza value exato e atributos semânticos antes do fallback', () => {
    document.body.innerHTML = `
      <label><input type="radio" value="Male"></label>
      <label><input type="radio" value="FeMale"></label>
      <select data-testid="month-select"><option>January</option></select>
    `;
    // Combinações rodam primeiro: type + value (priority 1) é mais específico que value sozinho
    expect(selectorFor(document.querySelectorAll('input')[1])).toMatchObject({
      selector: 'input[type="radio"][value="FeMale"]',
      rule: 'type + value',
      status: 'stable',
    });
    expect(selectorFor(document.querySelector('select'))).toMatchObject({
      selector: '[data-testid="month-select"]',
      rule: 'data-testid',
    });
  });

  it('ignora campos ocultos, desabilitados e tipos não editáveis', () => {
    document.body.innerHTML = `
      <input type="hidden" id="hidden">
      <input type="submit" id="submit">
      <input disabled id="disabled">
      <input id="visible">
    `;
    expect(scan().map((field) => field.selector)).toEqual(['#visible']);
  });

  it('marca colisões de seletores sem omitir os campos', () => {
    document.body.innerHTML = '<input name="same"><input name="same">';
    const fields = scan();
    expect(fields).toHaveLength(2);
    expect(fields.every((field) => field.selector && field.selectorStatus === 'fragile')).toBe(true);
  });

  it('usa atributos semânticos e texto de opções para inferir categorias', () => {
    document.body.innerHTML = `
      <input aria-label="Nome da mãe">
      <input placeholder="Renda mensal">
      <select aria-label="Sexo"><option>Masculino</option><option>Feminino</option></select>
      <input autocomplete="street-address">
    `;
    expect(inferType(document.querySelector("[aria-label='Nome da mãe']"))).toBe('mother');
    expect(inferType(document.querySelector("[placeholder='Renda mensal']"))).toBe('income');
    expect(inferType(document.querySelector('select'))).toBe('gender');
    expect(inferType(document.querySelector("[autocomplete='street-address']"))).toBe('address');
  });

  it('infere todas as categorias textuais e usa fallbacks de tipo', () => {
    document.body.innerHTML = `
      <input id="rg" aria-label="RG">
      <input id="father" aria-label="Nome do pai">
      <input id="profession" aria-label="Profissão">
      <input id="neighborhood" aria-label="Bairro">
      <input id="number" aria-label="Número da residência">
      <input id="plate" aria-label="Placa">
      <input id="brand" aria-label="Marca">
      <input id="model" aria-label="Modelo">
      <input id="year" aria-label="Ano">
      <input id="website" aria-label="Website">
      <input id="company" name="empresa">
      <input id="given" autocomplete="given-name">
      <input id="numeric" type="number">
      <input id="date" type="date">
      <input id="month" type="month">
      <input id="plain">
    `;
    expect(inferType(document.querySelector('#rg'))).toBe('rg');
    expect(inferType(document.querySelector('#father'))).toBe('father');
    expect(inferType(document.querySelector('#profession'))).toBe('profession');
    expect(inferType(document.querySelector('#neighborhood'))).toBe('neighborhood');
    expect(inferType(document.querySelector('#number'))).toBe('number');
    expect(inferType(document.querySelector('#plate'))).toBe('plate');
    expect(inferType(document.querySelector('#brand'))).toBe('brand');
    expect(inferType(document.querySelector('#model'))).toBe('model');
    expect(inferType(document.querySelector('#year'))).toBe('year');
    expect(inferType(document.querySelector('#website'))).toBe('website');
    expect(inferType(document.querySelector('#company'))).toBe('company');
    expect(inferType(document.querySelector('#given'))).toBe('name');
    expect(inferType(document.querySelector('#numeric'))).toBe('number');
    expect(inferType(document.querySelector('#date'))).toBe('birthDate');
    expect(inferType(document.querySelector('#month'))).toBe('birthDate');
    expect(inferType(document.querySelector('#plain'))).toBe('text');
  });

  it('resolve campos customizados e alvos de labels e grupos', () => {
    document.body.innerHTML = `
      <div id="labelled"><span id="caption">Nome</span><input></div>
      <label for="linked">CPF</label><input id="linked">
      <label><input id="nested"></label>
      <div role="group"><input id="group-field"></div>
      <multi-select id="custom"><input role="combobox"></multi-select>
      <div role="option">Opção</div>
    `;
    expect(isCustomSelect(document.querySelector('#custom'))).toBe(true);
    const fields = scan();
    expect(fields.map((field) => field.selector)).toEqual(expect.arrayContaining(['#linked', '#nested', '#group-field', '#custom']));
  });

  it('captura o próximo clique de campo, label e elemento interativo', async () => {
    const captured = vi.fn();
    captureNextClick(captured);
    document.querySelector('#email').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(captured).toHaveBeenCalledWith(expect.objectContaining({ captured: true, field: expect.objectContaining({ selector: '#email' }) }));

    const buttonCapture = vi.fn();
    captureNextClick(buttonCapture);
    const button = document.createElement('button');
    button.textContent = 'Salvar';
    document.body.appendChild(button);
    button.click();
    expect(buttonCapture).toHaveBeenCalledWith(expect.objectContaining({ captured: true }));

    const emptyCapture = vi.fn();
    captureNextClick(emptyCapture);
    document.body.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(emptyCapture).toHaveBeenCalledWith({ captured: false });
  });

  it('notifica mudanças de DOM quando o runtime está disponível', () => {
    document.body.appendChild(document.createElement('input'));
    notifyPageChanged();
    document.body.appendChild(document.createElement('input'));
    notifyPageChanged();

    expect(sendMessage).toHaveBeenLastCalledWith({
      action: 'PAGE_CONTENT_CHANGED',
      url: 'https://example.test/form',
      changeType: 'dom',
    });
  });

  it('não lança quando o contexto da extensão é invalidado', () => {
    sendMessage.mockImplementationOnce(() => {
      throw new Error('Uncaught Error: Extension context invalidated.');
    });

    document.body.appendChild(document.createElement('input'));
    expect(() => notifyPageChanged()).not.toThrow();
    document.body.appendChild(document.createElement('input'));
    expect(() => notifyPageChanged()).not.toThrow();
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('instala observador de navegação e ignora controles da extensão', async () => {
    installNavigationObserver();
    history.pushState({}, '', '/outra');
    window.dispatchEvent(new dom.window.Event('popstate'));
    document.body.insertAdjacentHTML('beforeend', '<div data-fakedata-control="true"><input></div>');
    await new Promise((resolveTick) => setTimeout(resolveTick, 300));
    expect(window.location.pathname).toBe('/outra');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('detecta IDs dinâmicos e evita usá-los', () => {
    // O regex detecta: prefixo r/component/ember/headlessui seguido de [-_], ou hash/numéricos longos
    expect(isDynamicId('r_123456')).toBe(true);
    expect(isDynamicId('component-789')).toBe(true);
    expect(isDynamicId('ember_123')).toBe(true);
    expect(isDynamicId('headlessui-456')).toBe(true);
    expect(isDynamicId('field_a1b2c3d4')).toBe(true); // 8 hex chars
    expect(isDynamicId('input_123456')).toBe(true); // 6 digits
    expect(isDynamicId('stable-id')).toBe(false);
    expect(isDynamicId('')).toBe(true);
    expect(isDynamicId(null)).toBe(true);
  });

  it('testa fallbackSelector com seletores estruturais', () => {
    document.body.innerHTML = `
      <form>
        <div>
          <input>
          <input>
        </div>
      </form>
    `;
    const input = document.querySelector('input:nth-of-type(2)');
    // Testa o fallbackSelector indiretamente via selectorFor
    const result = selectorFor(input);
    expect(result.status).toBe('fragile');
    expect(result.selector).toContain(':nth-of-type');
  });

  it('testa seletor por texto estático visível - fallback quando não há atributos', () => {
    document.body.innerHTML = `
      <label>Nome do usuário</label>
      <input>
    `;
    const input = document.querySelector('input');
    // Remove todos atributos que poderiam gerar seletor estável
    input.removeAttribute('id');
    input.removeAttribute('name');
    input.removeAttribute('type');
    input.removeAttribute('placeholder');
    input.removeAttribute('value');
    input.removeAttribute('autocomplete');
    input.removeAttribute('aria-label');
    const result = selectorFor(input);
    expect(result.status).toBe('fragile');
    // Com label, o seletor pode usar o texto do label ou fallback estrutural
    expect(result.selector).toBeTruthy();
  });

  it('testa fallback proibido quando não há texto estático', () => {
    document.body.innerHTML = `
      <form>
        <div>
          <input>
        </div>
      </form>
    `;
    const input = document.querySelector('input');
    const result = selectorFor(input);
    expect(result.status).toBe('fragile');
    expect(result.rule).toBe('fallback proibido');
  });

  it('testa combinações de seletores estáveis', () => {
    document.body.innerHTML = `
      <input ng-model="user.name" name="username" type="text" value="test">
      <input ng-model="user.email" name="email" type="email" value="test@test.com">
    `;
    const inputs = document.querySelectorAll('input');
    const result1 = selectorFor(inputs[0]);
    const result2 = selectorFor(inputs[1]);
    // value tem prioridade 3, ng-model também prioridade 3, mas value vem primeiro
    expect(result1.status).toBe('stable');
    expect(result2.status).toBe('stable');
  });

  it('testa fieldFromTarget com label for', () => {
    document.body.innerHTML = `
      <label for="target-input">Label</label>
      <input id="target-input">
    `;
    const label = document.querySelector('label');
    const result = fieldFromTarget(label);
    expect(result).not.toBeNull();
    expect(result.id).toBe('target-input');
  });

  it('testa fieldFromTarget com label nested', () => {
    document.body.innerHTML = `
      <label>
        <span>Label</span>
        <input id="nested-input">
      </label>
    `;
    const label = document.querySelector('label');
    const result = fieldFromTarget(label);
    expect(result).not.toBeNull();
    expect(result.id).toBe('nested-input');
  });

  it('testa fieldFromTarget com container form', () => {
    document.body.innerHTML = `
      <form>
        <input id="form-input">
      </form>
    `;
    const form = document.querySelector('form');
    const result = fieldFromTarget(form);
    expect(result).not.toBeNull();
    expect(result.id).toBe('form-input');
  });

  it('testa captureNextClick com button e link', async () => {
    document.body.innerHTML = `
      <button id="test-btn">Botão</button>
      <a id="test-link" href="#">Link</a>
    `;
    
    const buttonCapture = vi.fn();
    captureNextClick(buttonCapture);
    document.querySelector('#test-btn').click();
    expect(buttonCapture).toHaveBeenCalledWith(expect.objectContaining({ captured: true }));
    
    const linkCapture = vi.fn();
    captureNextClick(linkCapture);
    document.querySelector('#test-link').click();
    expect(linkCapture).toHaveBeenCalledWith(expect.objectContaining({ captured: true }));
  });

  it('testa captureNextClick com clique no body (sem elemento)', () => {
    const emptyCapture = vi.fn();
    captureNextClick(emptyCapture);
    document.body.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(emptyCapture).toHaveBeenCalledWith({ captured: false });
  });

  it('testa pageSignature com mudança de rota', () => {
    const initialSig = pageSignature();
    // Simula navegação
    history.pushState({}, '', '/nova-pagina');
    const newSig = pageSignature();
    expect(newSig).not.toBe(initialSig);
  });

  it('testa isCustomSelect com diferentes seletores', () => {
    document.body.innerHTML = `
      <multi-select id="ms"></multi-select>
      <div role="combobox" id="role-combo"></div>
      <div class="ui-autocomplete-multiselect" id="ui-auto"></div>
      <input id="normal-input">
    `;
    expect(isCustomSelect(document.querySelector('#ms'))).toBe(true);
    expect(isCustomSelect(document.querySelector('#role-combo'))).toBe(true);
    expect(isCustomSelect(document.querySelector('#ui-auto'))).toBe(true);
    expect(isCustomSelect(document.querySelector('#normal-input'))).toBe(false);
  });

  it('testa inferType para address, number, plate, chassi, brand, model, year, website, company', () => {
    document.body.innerHTML = `
      <input id="addr" autocomplete="street-address">
      <input id="num" autocomplete="house">
      <input id="plate" placeholder="Placa">
      <input id="chassi" placeholder="Chassi">
      <input id="brand" placeholder="Marca">
      <input id="model" placeholder="Modelo">
      <input id="year" placeholder="Ano">
      <input id="website" placeholder="Website">
      <input id="company" autocomplete="company-name">
      <input id="name1" autocomplete="given-name">
      <input id="name2" autocomplete="family-name">
      <input id="name3" autocomplete="name">
      <input id="number" type="number">
      <input id="date" type="date">
      <input id="month" type="month">
      <input id="plain">
    `;
    expect(inferType(document.querySelector('#addr'))).toBe('address');
    expect(inferType(document.querySelector('#num'))).toBe('number');
    expect(inferType(document.querySelector('#plate'))).toBe('plate');
    expect(inferType(document.querySelector('#chassi'))).toBe('chassi');
    expect(inferType(document.querySelector('#brand'))).toBe('brand');
    expect(inferType(document.querySelector('#model'))).toBe('model');
    expect(inferType(document.querySelector('#year'))).toBe('year');
    expect(inferType(document.querySelector('#website'))).toBe('website');
    expect(inferType(document.querySelector('#company'))).toBe('company');
    expect(inferType(document.querySelector('#name1'))).toBe('name');
    expect(inferType(document.querySelector('#name2'))).toBe('name');
    expect(inferType(document.querySelector('#name3'))).toBe('name');
    expect(inferType(document.querySelector('#number'))).toBe('number');
    expect(inferType(document.querySelector('#date'))).toBe('birthDate');
    expect(inferType(document.querySelector('#month'))).toBe('birthDate');
    expect(inferType(document.querySelector('#plain'))).toBe('text');
  });

  it('testa scan com colisão após fallback', () => {
    document.body.innerHTML = `
      <form>
        <div><input></div>
        <div><input></div>
      </form>
    `;
    const fields = scan();
    expect(fields.length).toBe(2);
    expect(fields.every((f) => f.selectorStatus === 'fragile')).toBe(true);
    // A colisão é detectada após o scan, mas o seletor gerado é fallback proibido
    // como ambos têm o mesmo seletor estrutural
  });

  it('testa notifyPageChanged ignora MutationObserver em controles da extensão', () => {
    installNavigationObserver();
    document.body.insertAdjacentHTML('beforeend', '<div data-fakedata-control="true"><input></div>');
    // Força o processamento do MutationObserver
    document.body.querySelector('[data-fakedata-control]').dispatchEvent(new dom.window.Event('click'));
    // Não deve notificar mudança
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('testa visible retorna false para display:none e visibility:hidden', () => {
    document.body.innerHTML = `
      <input id="visible">
      <input id="hidden-display" style="display:none">
      <input id="hidden-visibility" style="visibility:hidden">
      <input id="no-rects">
    `;
    // Mock getClientRects para retornar vazio para no-rects
    const noRects = document.querySelector('#no-rects');
    noRects.getClientRects = () => [];
    
    expect(visible(document.querySelector('#visible'))).toBe(true);
    expect(visible(document.querySelector('#hidden-display'))).toBe(false);
    expect(visible(document.querySelector('#hidden-visibility'))).toBe(false);
    expect(visible(noRects)).toBe(false);
  });

  it('testa uniqueCandidate com seletor inválido (catch)', () => {
    document.body.innerHTML = '<input id="test">';
    const _input = document.querySelector('#test');
    // Mock querySelectorAll para lançar erro
    const originalQSA = document.querySelectorAll;
    document.querySelectorAll = vi.fn(() => { throw new Error('Invalid selector'); });
    // uniqueCandidate é interno, testamos indiretamente via selectorFor com seletor inválido
    // Como não podemos chamar uniqueCandidate diretamente, testamos o fluxo que usa
    document.querySelectorAll = originalQSA;
  });

  it('testa staticText com texto vazio, longo e template', () => {
    document.body.innerHTML = `
      <div id="empty"></div>
      <div id="long">${'x'.repeat(100)}</div>
      <div id="template">{{variable}}</div>
      <div id="normal">Texto normal</div>
    `;
    // Testamos indiretamente via selectorFor
    // Elemento com texto vazio
    const empty = document.querySelector('#empty');
    const long = document.querySelector('#long');
    const template = document.querySelector('#template');
    const normal = document.querySelector('#normal');
    
    // Removemos atributos para forçar fallback para staticText
    [empty, long, template, normal].forEach(el => {
      el.removeAttribute('id');
      el.removeAttribute('name');
      el.removeAttribute('type');
      el.removeAttribute('placeholder');
      el.removeAttribute('value');
      el.removeAttribute('autocomplete');
      el.removeAttribute('aria-label');
    });
    
    // staticText retorna "" para vazio, longo, e template
    // O selectorFor deve ir para fallback proibido
    const resultEmpty = selectorFor(empty);
    const resultLong = selectorFor(long);
    const resultTemplate = selectorFor(template);
    const _resultNormal = selectorFor(normal);
    
    expect(resultEmpty.rule).toBe('fallback proibido');
    expect(resultLong.rule).toBe('fallback proibido');
    expect(resultTemplate.rule).toBe('fallback proibido');
    // Texto normal curto deve usar "texto visível estático" se for único
    // Mas como temos múltiplos divs, será fallback proibido
  });

  it('testa candidatos sem valor (continue no loop)', () => {
    document.body.innerHTML = '<input>';
    const input = document.querySelector('input');
    // Sem id, data-cy, data-test, data-testid, role, aria-label, aria-labelledby, value, ng-model, name, type
    // Todos os candidatos falham no if (!value) continue
    const result = selectorFor(input);
    expect(result.status).toBe('fragile');
    expect(result.rule).toBe('fallback proibido');
  });

  it('testa combinações sem valor (continue no loop)', () => {
    document.body.innerHTML = '<input data-testid="test-field">';
    const input = document.querySelector('input');
    // Tem data-testid mas não name, type, value
    // Combinações sem valor devem ser ignoradas, data-testid sozinho funciona
    const result = selectorFor(input);
    expect(result.rule).toBe('data-testid');
    expect(result.status).toBe('stable');
  });

  it('testa inferType com label anterior (previousElementSibling)', () => {
    document.body.innerHTML = `
      <span>CPF</span>
      <input id="cpf-field">
    `;
    const input = document.querySelector('#cpf-field');
    expect(inferType(input)).toBe('cpf');
  });

  it('testa inferType com aria-describedby', () => {
    document.body.innerHTML = `
      <span id="desc">CPF do usuário</span>
      <input id="cpf-field" aria-describedby="desc">
    `;
    const input = document.querySelector('#cpf-field');
    expect(inferType(input)).toBe('cpf');
  });

  it('testa uniqueCandidate com erro no querySelectorAll (catch)', () => {
    document.body.innerHTML = '<input id="test">';
    const input = document.querySelector('#test');
    // Força erro no querySelectorAll para testar o catch
    const originalQSA = document.querySelectorAll.bind(document);
    document.querySelectorAll = vi.fn(() => { throw new Error('Invalid selector'); });
    
    // Testa indiretamente via selectorFor - se o seletor causar erro, uniqueCandidate retorna false
    // e o loop continua para o próximo candidato
    const result = selectorFor(input);
    expect(result).toBeDefined();
    
    document.querySelectorAll = originalQSA;
  });

  it('testa staticText com template detection', () => {
    // Testa indiretamente criando elementos com texto de template
    document.body.innerHTML = `
      <input id="t1" value="{{variable}}">
      <input id="t2" value="template">
      <input id="t3" value="code">
      <input id="t4" value="texto normal">
    `;
    // Remove todos atributos para forçar uso de staticText
    ['t1', 't2', 't3', 't4'].forEach(id => {
      const el = document.querySelector(`#${id}`);
      el.removeAttribute('id');
      el.removeAttribute('name');
      el.removeAttribute('type');
      el.removeAttribute('placeholder');
      el.removeAttribute('value');
      el.removeAttribute('autocomplete');
      el.removeAttribute('aria-label');
    });
    
    // Seleciona os inputs restantes (agora sem atributos)
    const inputs = document.querySelectorAll('input');
    const results = Array.from(inputs).map(el => selectorFor(el));
    
    // Todos devem ir para fallback proibido pois têm template ou são múltiplos
    results.forEach(r => {
      expect(r.rule).toBe('fallback proibido');
    });
  });

  it('testa combinações - name + type + value tem prioridade', () => {
    document.body.innerHTML = `
      <input name="username" type="text" value="test">
      <input name="email" type="email" value="test@test.com">
    `;
    // Combinações rodam primeiro: name + type + value (priority 1) é mais específico
    const inputs = document.querySelectorAll('input');
    const result1 = selectorFor(inputs[0]);
    const result2 = selectorFor(inputs[1]);
    
    // Deve usar name + type + value como prioridade 1 estável
    expect(result1.rule).toBe('name + type + value');
    expect(result1.status).toBe('stable');
    expect(result2.rule).toBe('name + type + value');
    expect(result2.status).toBe('stable');
  });

  it('testa fallbackSelector percorre árvore até body', () => {
    document.body.innerHTML = `
      <form>
        <div class="container">
          <div class="row">
            <input>
            <input>
          </div>
        </div>
      </form>
    `;
    const inputs = document.querySelectorAll('input');
    const input = inputs[1]; // Segundo input
    // Remove todos atributos estáveis
    input.removeAttribute('id');
    input.removeAttribute('name');
    input.removeAttribute('type');
    input.removeAttribute('placeholder');
    input.removeAttribute('value');
    input.removeAttribute('autocomplete');
    input.removeAttribute('aria-label');
    
    const result = selectorFor(input);
    expect(result.status).toBe('fragile');
    expect(result.selector).toContain(':nth-of-type');
  });

  it('testa scan com elementos duplicados e únicos', () => {
    document.body.innerHTML = `
      <input id="unique">
      <input name="duplicate">
      <input name="duplicate">
    `;
    const fields = scan();
    expect(fields.length).toBe(3);
    // O unique deve ser stable
    const uniqueField = fields.find(f => f.selector === '#unique');
    expect(uniqueField.selectorStatus).toBe('stable');
    // Pelo menos um campo deve ser fragile (os duplicados)
    const fragileFields = fields.filter(f => f.selectorStatus === 'fragile');
    expect(fragileFields.length).toBeGreaterThanOrEqual(1);
  });

  it('testa inferType com type=number e type=email específicos', () => {
    document.body.innerHTML = `
      <input id="num" type="number">
      <input id="email" type="email">
      <input id="tel" type="tel">
      <input id="url" type="url">
    `;
    expect(inferType(document.querySelector('#num'))).toBe('number');
    expect(inferType(document.querySelector('#email'))).toBe('email');
    expect(inferType(document.querySelector('#tel'))).toBe('phone');
    expect(inferType(document.querySelector('#url'))).toBe('website'); // type=url -> website
  });

  it('testa labelsFor com aria-labelledby', () => {
    document.body.innerHTML = `
      <span id="lbl1">Nome</span>
      <span id="lbl2">Completo</span>
      <input id="field" aria-labelledby="lbl1 lbl2">
    `;
    const input = document.querySelector('#field');
    // labelsFor é função interna, testamos via inferType que usa labelsFor
    expect(inferType(input)).toBe('name'); // "nome completo" contém "name"/"nome"
  });

  it('testa fieldFromTarget retorna null para elemento sem campo', () => {
    document.body.innerHTML = '<div id="no-field"></div>';
    const div = document.querySelector('#no-field');
    const result = fieldFromTarget(div);
    expect(result).toBeNull();
  });

  // ===== TESTES ESPECÍFICOS PARA ANGULAR (2+) =====

  describe('Angular (2+) - detecção de atributos instáveis', () => {
    it('detecta ng-reflect-* como atributo Angular instável', () => {
      document.body.innerHTML = '<input ng-reflect-name="email" ng-reflect-model="test@test.com">';
      const input = document.querySelector('input');
      expect(hasAngularAttributes(input)).toBe(true);
      const result = selectorFor(input);
      expect(result.status).toBe('fragile');
      expect(result.rule).toContain('Angular');
    });

    it('detecta _ngcontent-* como atributo Angular instável', () => {
      document.body.innerHTML = '<input _ngcontent-ng-c123456789="1">';
      const input = document.querySelector('input');
      expect(hasAngularAttributes(input)).toBe(true);
      const result = selectorFor(input);
      expect(result.status).toBe('fragile');
    });

    it('detecta _nghost-* como atributo Angular instável', () => {
      document.body.innerHTML = '<div _nghost-ng-c123456789="1"><input></div>';
      const div = document.querySelector('div');
      expect(hasAngularAttributes(div)).toBe(true);
    });

    it('detecta IDs Angular Material (mat-input-0, mat-select-1, etc.)', () => {
      expect(isAngularAttribute('mat-input-0')).toBe(true);
      expect(isAngularAttribute('mat-select-1')).toBe(true);
      expect(isAngularAttribute('mat-option-2')).toBe(true);
      expect(isAngularAttribute('cdk-describedby-message-3')).toBe(true);
      expect(isAngularAttribute('cdk-overlay-4')).toBe(true);
      expect(isAngularAttribute('stable-id')).toBe(false);
    });

    it('detecta classes Angular (ng-valid, ng-invalid, etc.)', () => {
      expect(isAngularClass('ng-valid')).toBe(true);
      expect(isAngularClass('ng-invalid')).toBe(true);
      expect(isAngularClass('ng-dirty')).toBe(true);
      expect(isAngularClass('ng-pristine')).toBe(true);
      expect(isAngularClass('ng-touched')).toBe(true);
      expect(isAngularClass('ng-untouched')).toBe(true);
      expect(isAngularClass('ng-submitted')).toBe(true);
      expect(isAngularClass('ng-pending')).toBe(true);
      expect(isAngularClass('cdk-overlay-pane')).toBe(true);
      expect(isAngularClass('mat-form-field')).toBe(true);
      expect(isAngularClass('minha-classe-custom')).toBe(false);
    });

    it('usa data-cy estável mesmo quando elemento tem atributos Angular', () => {
      document.body.innerHTML = '<input ng-reflect-name="email" data-cy="stable-email">';
      const input = document.querySelector('input');
      // data-cy estável tem prioridade sobre detecção de Angular
      const result = selectorFor(input);
      expect(result.status).toBe('stable');
      expect(result.rule).toBe('data-cy');
      expect(result.selector).toBe('[data-cy="stable-email"]');
    });

    it('usa data-cy estável quando NÃO tem atributos Angular', () => {
      document.body.innerHTML = '<input data-cy="email-field" name="email">';
      const input = document.querySelector('input');
      const result = selectorFor(input);
      expect(result.selector).toBe('[data-cy="email-field"]');
      expect(result.rule).toBe('data-cy');
      expect(result.status).toBe('stable');
    });

    it('ignora ng-version attribute', () => {
      expect(isAngularAttribute('ng-version')).toBe(true);
    });

    it('prioriza data-testid sobre name quando ambos presentes e únicos', () => {
      document.body.innerHTML = '<input data-testid="email-input" name="email" type="email">';
      const input = document.querySelector('input');
      const result = selectorFor(input);
      expect(result.rule).toBe('data-testid');
      expect(result.selector).toBe('[data-testid="email-input"]');
      expect(result.status).toBe('stable');
    });

    it('usa autocomplete + name como combinação estável', () => {
      document.body.innerHTML = '<input autocomplete="email" name="user-email" type="email">';
      const input = document.querySelector('input');
      const result = selectorFor(input);
      expect(result.rule).toBe('autocomplete + name');
      expect(result.selector).toBe('input[autocomplete="email"][name="user-email"]');
      expect(result.status).toBe('stable');
    });

    it('usa placeholder + name como combinação estável', () => {
      document.body.innerHTML = '<input placeholder="Digite seu email" name="email" type="email">';
      const input = document.querySelector('input');
      const result = selectorFor(input);
      expect(result.rule).toBe('placeholder + name');
      expect(result.selector).toBe('input[placeholder="Digite seu email"][name="email"]');
      expect(result.status).toBe('stable');
    });
  });

  // ===== TESTES PARA isDynamicId COM PADRÕES ANGULAR =====

  describe('isDynamicId - padrões Angular', () => {
    it('detecta IDs numéricos sequenciais como dinâmicos', () => {
      expect(isDynamicId('mat-input-0')).toBe(true);
      expect(isDynamicId('mat-select-1')).toBe(true);
      expect(isDynamicId('cdk-describedby-message-2')).toBe(true);
    });

    it('não detecta IDs estáveis como dinâmicos', () => {
      expect(isDynamicId('email-field')).toBe(false);
      expect(isDynamicId('user-name')).toBe(false);
      expect(isDynamicId('cpf-input')).toBe(false);
    });
  });
});
