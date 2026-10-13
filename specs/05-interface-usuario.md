# Spec: Interface do Usuário

## Visão Geral
Interface multi-modo (Popup, Side Panel, Dedicated Tab) com abas, sub-abas, modais, temas e acessibilidade.

## Modos de Abertura

| Modo | Trigger | Comportamento |
|------|---------|---------------|
| **Popup** | Ícone extensão | Compacto, apenas aba "Mapear", elementos generator ocultos |
| **Side Panel** | Botão ↗ Lateral | Persistente, navegação entre abas mantida |
| **Dedicated Tab** | Botão maximizar | Interface completa (Generator + Mapping) |

### Detecção de Modo
```javascript
chrome.windows.getCurrent((win) => {
  isPopup = win.type === "popup";
});
```
- Popup: `applyPopupMode(true)` → oculta Generator, Playground, botões extras
- Side Panel/Tab: Interface completa

## Estrutura de Abas

### Abas Principais
| Aba | ID | Conteúdo |
|-----|-----|----------|
| **Gerar Dados** | `generator-tab` | Pessoa/Veículo/Empresa, opções, resultado |
| **Mapear Campos** | `mapping-tab` | Automático + Playground |

### Sub-abas (Mapping)
| Sub-aba | ID | Conteúdo |
|---------|-----|----------|
| **Automático** | `automatic-mapping-tab` | Scan, lista campos, ações |
| **Playground** | `playground-mapping-tab` | CSS selector testing |

## Gerar Dados (Aba Generator)

### Tipos
- **Pessoa**: `data-type="person"` - Opções: CPF formatado, UF
- **Veículo**: `data-type="vehicle"` - Opções: UF, botão catálogo
- **Empresa**: `data-type="company"` - Opções: CNPJ formatado, alfanumérico

### Resultado
- Título dinâmico ("Pessoa gerada", "Veículo gerado", "Empresa gerada")
- Campos: Label + Valor + Botão copiar (📋)
- Botão "Copiar JSON" → clipboard com objeto completo

### Catálogo de Veículos (Modal)
- Trigger: Botão "Cadastrar Marca x Modelo" (só em Veículo)
- CRUD: Adicionar marca+modelo, Editar nome, Excluir marca/modelo
- Persistência: `chrome.storage.local` (`fakedata-vehicle-catalog`)
- Validação: Marca/modelo obrigatórios, case-insensitive dedup

## Mapear Campos (Aba Mapping)

### Automático
- **URL Base**: Dropdown agrupado por domínio base
- **Escanear**: `SCAN_FIELDS` → lista campos com tipo inferido
- **Linha de campo**: Label (editável), Tipo (select 29 opções), Seletor (editável), Fixed checkbox + value, Ações
- **Ações por linha**: Marcar/Desmarcar, Localizar (🔍), Capturar (🎯), Preencher (📥)
- **Ações em lote**: Marcar todos, Preencher todos, Salvar seletores
- **Botões flutuantes**: Toggle persiste em `localStorage` + `chrome.storage`

### Playground
- Input seletor CSS → contagem matches em tempo real
- 🎯 Capturar próximo clique
- Marcar/Desmarcar encontrados
- Validação seletor inválido (borda vermelha)
- Copiar JSON: `{locatorName: selector}`

## Perfis (Dropdown)
- Agrupados por `pageUrl` normalizada = URL ativa
- Seleção automática se apenas 1 perfil na URL
- Ações: Renomear (modal), Excluir (confirmação)

## Temas
- **Light/Dark**: Toggle ☀/☾ no header
- Persistência: `localStorage.fakedata-theme`
- CSS Custom Properties: `--fg`, `--bg`, `--accent`, `--border`, `--muted`
- Aplicado no `documentElement.dataset.theme`

## Acessibilidade
- ARIA labels em todos botões/icon-only
- `aria-selected` em tabs
- `tabIndex` management (ativo=0, inativo=-1)
- Focus management em modais (trap, restore)
- Escape para fechar modais
- Atalhos bloqueados em inputs/editáveis

## Atalhos de Teclado (`Alt+Shift+`)
| Tecla | Ação | Seletor |
|-------|------|---------|
| `S` | Escanear campos | `#scan-fields-button` |
| `P` | Preencher todos | `#fill-all-button` |
| `F` | Toggle flutuantes | `#floating-controls-toggle` |
| `L` | Salvar seletores | `#save-mappings-button` |
| `M` | Marcar todos | `#mark-all-button` |

## Estados de UI
- `hidden` attribute (não `display:none`)
- Loading: botão disabled + texto "Carregando..."
- Status messages: `#page-fields-status`, `#vehicle-catalog-status`
- Empty states: "Nenhum campo encontrado", "Nenhum veículo cadastrado"

## Arquivos Relacionados
- `src/popup.html` - Estrutura completa
- `src/styles/popup.css` - CSS custom properties, responsivo
- `src/scripts/app.js` - Toda lógica de UI, modais, tabs, eventos
- `src/privacy.html` + `src/styles/privacy.css` - Página privacidade