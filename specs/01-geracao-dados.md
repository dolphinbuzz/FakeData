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
- **Padrão**: 13 marcas com 1 modelo cada
- **Customizável**: CRUD via modal (Adicionar/Editar/Excluir marca/modelo)
- **Persistência**: `chrome.storage.local` (`fakedata-vehicle-catalog`)
- **Fallback**: Usa catálogo padrão se custom vazio

## Configurações do Usuário
- **UF**: 27 opções + "ALL" (persiste em `localStorage.fakedata-uf`)
- **CPF formatado**: Checkbox (persiste via callback)
- **CNPJ formatado**: Checkbox
- **CNPJ alfanumérico**: Checkbox

## API Interna
```javascript
createGeneratorData({
  getState: () => Estado,
  ddds: string[],
  getCpfFormatted: () => boolean,
  getCnpjFormatted: () => boolean,
  getCnpjAlphanumeric: () => boolean,
  getVehicleCatalog: () => VehicleCatalogEntry[]
})
```

## Arquivos Relacionados
- `src/scripts/generators.js` - Lógica principal
- `src/scripts/data/estados.js` - UFs, cidades, DDDs
- `src/scripts/data/vehicle-catalog.js` - CRUD catálogo
- `src/scripts/data/mapping-types.js` - 29 tipos de mapeamento