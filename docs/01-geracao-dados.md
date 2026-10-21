# Spec: Geração de Dados

## Visão Geral
Módulo responsável pela geração de dados fictícios realistas para testes de QA. Suporta 3 tipos principais: Pessoa, Veículo e Empresa.

## Tipos de Dados

### Pessoa
| Campo | Descrição | Formato/Validação |
|-------|-----------|-------------------|
| Nome | Nome completo (1 primeiro + 2 sobrenomes distintos) | Normalização NFD, sem duplicatas |
| CPF | 11 dígitos com dígitos verificadores | `000.000.000-00` ou numérico |
| RG | Registro Geral | `00.000.000-0` |
| Sexo | Feminino/Masculino | Enum |
| E-mail | pessoa.sobrenome{N}@provider | Providers: gmail, outlook, hotmail, yahoo, icloud |
| Telefone | Celular com DDD | `(DD) 9XXXX-XXXX` |
| Data Nasc. | Entre 1970-2003 | `DD/MM/AAAA` |
| Mãe/Pai | Nomes compostos | 2 sobrenomes distintos |
| CEP | Formato brasileiro | `00000-000` |
| Endereço | Rua/Avenida + número + bairro | Seleção aleatória |
| Cidade/Estado | Baseado em UF selecionada | 27 UFs com cidades reais |
| Profissão | Lista pré-definida | 15 opções |
| Renda | Valor monetário | `R$ X.XXX,00` |

### Veículo
| Campo | Descrição | Formato/Validação |
|-------|-----------|-------------------|
| Marca | Do catálogo (padrão ou custom) | Seleção aleatória |
| Modelo | Vinculado à marca | Seleção aleatória por marca |
| Placa | Mercosul (60%) ou antiga (40%) | `ABC1D23` ou `ABC-1234` |
| Chassi/VIN | 17 chars ISO 3779 | Check digit posição 9 válido |
| Ano | Fabricação 2015-2026 | `AAAA/AAAA` |
| Cor | Lista pré-definida | 7 opções |
| UF | Estado | 27 UFs |

### Empresa
| Campo | Descrição | Formato/Validação |
|-------|-----------|-------------------|
| Razão Social | Nome + sufixo + tipo | `Nome Sufixo Tipo` |
| CNPJ | 14 dígitos (numérico/alfanumérico) | `00.000.000/0000-00` |
| Inscrição Estadual | Formato padrão | `000.000.000-00` |
| Data Abertura | 1980-2025 | `DD/MM/AAAA` |
| E-mail | contato{N}@provider | Providers padrão |
| Site | URL baseada no nome | `https://www.nome{N}.com.br` |
| Telefone | Fixo com DDD | `(DD) XXXX-XXXX` |
| Segmento | Lista pré-definida | 10 opções |
| Endereço completo | CEP, rua, número, bairro, cidade, estado | Igual pessoa |

## Catálogo de Veículos
- **Padrão**: 12 marcas com 1 modelo cada (Toyota Corolla, Volkswagen T-Cross, Chevrolet Onix, Honda Civic, Fiat Argo, Hyundai HB20, Nissan Kicks, Renault Kwid, Ford Ranger, Jeep Compass, Kia Sportage, BYD Dolphin)
- **Customizável**: CRUD via modal (Adicionar/Editar/Excluir marca/modelo)
- **Persistência**: `chrome.storage.local` (`fakedata-vehicle-catalog`)
- **Fallback**: Usa catálogo padrão se custom vazio
- **Normalização**: Case-insensitive dedup de marcas e modelos (`normalizeVehicleCatalog`)

## Configurações do Usuário
- **UF**: 27 opções + "ALL" (persiste em `localStorage.fakedata-uf`)
- **CPF formatado**: Checkbox (persiste via callback `getCpfFormatted`)
- **CNPJ formatado**: Checkbox (`getCnpjFormatted`)
- **CNPJ alfanumérico**: Checkbox (`getCnpjAlphanumeric`)
- **Renavam formatado**: Checkbox (`getRenavamFormatted`)

## API Interna
```javascript
createGeneratorData({
  getState: () => Estado,
  ddds: string[],
  getCpfFormatted: () => boolean,
  getCnpjFormatted: () => boolean,
  getCnpjAlphanumeric: () => boolean,
  getRenavamFormatted: () => boolean,
  getVehicleCatalog: () => VehicleCatalogEntry[]
})
```

Retorna objeto com `person`, `vehicle`, `company`, cada um com `context()` e `fields[]`.

```javascript
generateMappedValue(type, context, inputType, options)
// Para preenchimento de campos mapeados (content script)
```

## Arquivos Relacionados
- `src/scripts/generators.js` - Lógica principal (funções puras exportadas)
- `src/scripts/data/estados.js` - UFs, cidades, DDDs (27 estados)
- `src/scripts/data/vehicle-catalog.js` - CRUD catálogo (puro, sem side effects)
- `src/scripts/data/mapping-types.js` - 29 tipos de mapeamento (MAPPING_TYPES)