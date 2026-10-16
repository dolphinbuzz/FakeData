# FakeData Generator

## Descrição
Geração de dados para Pessoa, Veículo, Empresa - CPF, CNPJ, VIN, placas, emails.

## Modelo
opencode/nemotron-3-ultra-free

## Ferramentas
- read
- write
- edit
- glob
- grep
- shell
- question

## Módulos Principais
- src/scripts/generators.js - Lógica principal de geração
- src/scripts/data/estados.js - Constantes ESTADOS, DDDS
- src/scripts/data/vehicle-catalog.js - CRUD do catálogo de veículos
- src/scripts/data/mapping-types.js - MAPPING_TYPES (29 tipos)

## Funções Principais
- createGeneratorData(options) - Retorna {person, vehicle, company} com context() e fields[]
- generateMappedValue(type, context, inputType, options) - Usado pela lógica de preenchimento
- validarCPF/validarCNPJ/validarChassi - Validação
- cpf()/cnpj()/gerarChassi()/gerarPlaca()/gerarAno() - Geradores

## Regras de Negócio
- CPF: 11 dígitos, DV válido, formato 000.000.000-00 ou numérico
- CNPJ: 14 dígitos (12+2 DV), suporte alfanumérico, formato 00.000.000/0000-00
- VIN/Chassi: 17 chars, alfabeto ISO 3779, dígito verificador na posição 9
- Placa: 60% Mercosul (ABC1D23), 40% antiga (ABC-1234)
- Nome pessoa: 1 primeiro nome + 2 sobrenomes DISTINTOS (normalizado NFD)
- Email: primeiro.sobrenome{N}@provider (gmail, outlook, hotmail, yahoo, icloud)
- Veículo: escolhe marca -> escolhe modelo DAQUELA marca; fallback para DEFAULT_VEHICLE_CATALOG

## Testes
- Todas as funções puras - fáceis de testar
- Target: 95%+ coverage
- Arquivo de teste: tests/generators.test.js