# Arena de Compiladores ⚔️🤖

> **Centro Universitário de Jaguariúna — UNIFAJ**  
> **Disciplina:** Compiladores  
> **Projeto Acadêmico:** Compilador e Máquina Virtual para Robôs Autônomos de Batalha em Arena 3D

---

## 📋 Sumário

1. [Visão Geral](#-visão-geral)
2. [Especificação da Linguagem TankScript](#-especificação-da-linguagem-tankscript)
3. [Arquitetura do Compilador](#-arquitetura-do-compilador)
4. [A Máquina Virtual (VM)](#-a-máquina-virtual-vm)
5. [Motor de Simulação & Arena 3D](#-motor-de-simulação--arena-3d)
6. [Exemplos Didáticos Disponíveis](#-exemplos-didáticos-disponíveis)
7. [Roteiro para Apresentação ao Professor](#-roteiro-para-apresentação-ao-professor)
8. [Como Executar o Projeto](#-como-executar-o-projeto)
9. [Suíte de Testes Automatizados](#-suíte-de-testes-automatizados)

---

## 🎯 Visão Geral

O **Arena de Compiladores** é um ambiente acadêmico completo para ensino e aplicação prática de **Teoria de Compiladores**. O projeto implementa:

- **Um compilador completo e funcional** para a linguagem proprietária **TankScript**, composto por todas as etapas canônicas: Análise Léxica, Análise Sintática (com construção de AST), Análise Semântica (tabela de símbolos e verificação de tipos), Geração de Código Intermediário (TAC), Otimização de Código e Geração de Bytecode.
- **Uma Máquina Virtual (VM) baseada em pilha**, executada por ticks determinísticos, isolada por robô e com limite de instruções (_gas limit_) para prevenir laços infinitos sem recorrer a `eval()` ou interpretadores nativos.
- **Uma Arena 3D Low-Poly em Three.js**, com terreno quadrado ($900 \times 900$), câmera isométrica dinâmica, simulação física de projéteis e barreiras perimetrais.
- **Um Inspetor de Compilação tipo DevTools**, permitindo visualizar interativamente cada representação intermediária do código gerado para cada robô.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PIPELINE DO COMPILADOR                          │
│                                                                        │
│   Código TankScript (.tank)                                            │
│              │                                                         │
│              ▼                                                         │
│   [1. Analisador Léxico]    ──> Fluxo de Tokens (linha, coluna)        │
│              │                                                         │
│              ▼                                                         │
│   [2. Analisador Sintático] ──> Árvore Sintática Abstrata (AST)        │
│              │                                                         │
│              ▼                                                         │
│   [3. Analisador Semântico] ──> Tabela de Símbolos & Checagem de Tipos │
│              │                                                         │
│              ▼                                                         │
│   [4. Gerador de IR (TAC)]  ──> Código de Três Endereços (Quádruplas)  │
│              │                                                         │
│              ▼                                                         │
│   [5. Otimizador de Código] ──> Dobra de Constantes, Simplificação, DCE│
│              │                                                         │
│              ▼                                                         │
│   [6. Gerador de Bytecode]  ──> Programa Objeto / Bytecode Customizado │
│              │                                                         │
│              ▼                                                         │
│   [7. Máquina Virtual (VM)] ──> Execução Determinística por Ticks      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📜 Especificação da Linguagem TankScript

A linguagem **TankScript** foi concebida especificamente para o controle autônomo de tanques na arena. É estaticamente tipada, estruturada em blocos e compilada diretamente para bytecode.

### 1. Gramática Formal (EBNF Simplificada)

```ebnf
Program        ::= "robot" Identifier "{" Declaration* Statement* "}"
Declaration    ::= Type Identifier ("=" Expression)? ";"
Type           ::= "int" | "bool"

Statement      ::= AssignmentStatement
                 | IfStatement
                 | WhileStatement
                 | ActionStatement ";"

AssignmentStatement ::= (Identifier | SensorField) "=" Expression ";"
IfStatement         ::= "if" "(" Expression ")" Block ("else" Block)?
WhileStatement      ::= "while" "(" Expression ")" Block
Block               ::= "{" Statement* "}" | Statement

ActionStatement     ::= "move" "(" Expression ")"
                      | "back" "(" Expression ")"
                      | "rotate" "(" Expression ")"
                      | "scan" "(" ")"
                      | "fire" "(" Expression ")"

Expression          ::= LogicalOrExpr
LogicalOrExpr       ::= LogicalAndExpr ( "||" LogicalAndExpr )*
LogicalAndExpr      ::= EqualityExpr ( "&&" EqualityExpr )*
EqualityExpr        ::= RelationalExpr ( ("==" | "!=") RelationalExpr )*
RelationalExpr      ::= AdditiveExpr ( ("<" | "<=" | ">" | ">=") AdditiveExpr )*
AdditiveExpr        ::= MultiplicativeExpr ( ("+" | "-") MultiplicativeExpr )*
MultiplicativeExpr  ::= UnaryExpr ( ("*" | "/") UnaryExpr )*
UnaryExpr           ::= ("!" | "-")? PrimaryExpr
PrimaryExpr         ::= NumberLiteral
                      | BooleanLiteral
                      | Identifier
                      | SensorField
                      | "(" Expression ")"

SensorField         ::= "position" "." ("x" | "y")
                      | "enemy" "." ("visible" | "distance" | "direction")
                      | "energy"
```

### 2. Comandos de Arena

| Comando       | Descrição                                                         | Restrições                                                        |
| :------------ | :---------------------------------------------------------------- | :---------------------------------------------------------------- |
| `move(dist)`  | Avança o tanque na direção atual em unidades de distância.        | `dist` deve ser numérico (`int`).                                 |
| `back(dist)`  | Recua o tanque em linha reta na direção oposta.                   | `dist` deve ser numérico (`int`).                                 |
| `rotate(deg)` | Gira o chassi e a torreta em graus (relativo à orientação atual). | `deg` positivo gira em sentido horário, negativo em anti-horário. |
| `scan()`      | Dispara o radar de bordo atualizando os sensores do inimigo.      | Não recebe argumentos.                                            |
| `fire(power)` | Dispara um projétil na direção da torreta.                        | `power` deve ser **1, 2 ou 3**. Consome energia proporcional.     |

### 3. Sensores Integrados (Somente Leitura)

| Sensor            | Tipo   | Descrição                                                             |
| :---------------- | :----- | :-------------------------------------------------------------------- |
| `energy`          | `int`  | Quantidade de energia/vida restante do tanque ($0$ a $100$).          |
| `position.x`      | `int`  | Coordenada $X$ atual na arena ($0$ a $900$).                          |
| `position.y`      | `int`  | Coordenada $Y$ atual na arena ($0$ a $900$).                          |
| `enemy.visible`   | `bool` | Indica se há um adversário detectado no último `scan()`.              |
| `enemy.distance`  | `int`  | Distância euclidiana em pixels até o inimigo detectado.               |
| `enemy.direction` | `int`  | Ângulo relativo em graus até o inimigo ($-180^\circ$ a $+180^\circ$). |

---

## ⚙️ Arquitetura do Compilador

O núcleo do compilador está modularizado em [`src/compiler/`](file:///c:/Users/joaov/Desktop/compiler-arena/src/compiler):

### 1. Análise Léxica (`src/compiler/lexer.ts`)

- Converte a sequência de caracteres em tokens categorizados (`KEYWORD`, `IDENTIFIER`, `NUMBER`, `BOOLEAN`, `OPERATOR`, `DELIMITER`, `SENSOR`).
- Registra rigorosamente a **linha** e **coluna** de cada token para geração de mensagens de erro claras.
- Trata identificadores de sensores compostos (`position.x`, `enemy.distance`).

### 2. Análise Sintática (`src/compiler/parser.ts`)

- Implementada via **Descendente Recursivo com Precedência de Operadores**.
- Produz uma **Árvore Sintática Abstrata (AST)** fortemente tipada contendo nós de declaração, atribuição, condicionais, repetições, expressões binárias/unárias e comandos de ação.
- Emite erros de sintaxe detalhados com localização e expectativa formal de gramática.

### 3. Análise Semântica (`src/compiler/semantic.ts`)

- **Tabela de Símbolos**: Gerencia escopos aninhados e armazena tipo, nome e escopo de cada símbolo.
- **Regras Verificadas**:
    - Detecção de variáveis não declaradas ou utilizadas antes de sua inicialização.
    - Prevenção de declaração duplicada no mesmo escopo.
    - Checagem estrita de tipos (`int` vs `bool`) em atribuições, operações aritméticas e expressões lógicas.
    - Verificação de parâmetros de comandos (ex: `fire(p)` exige $1 \le p \le 3$; `move(v)` exige tipo numérico).
    - Garantia de que sensores são **read-only** (rejeita atribuições como `energy = 50;`).

### 4. Geração de Código Intermediário (`src/compiler/ir.ts`)

- Transforma a AST em **Código de Três Endereços (Three-Address Code — TAC)**.
- Utiliza representação por quádruplas (`op`, `arg1`, `arg2`, `result`), alocação de variáveis temporárias sequenciais (`t0, t1, t2...`) e rótulos de controle de fluxo (`L0, L1...`).

### 5. Otimizador de Código (`src/compiler/optimizer.ts`)

Aplica múltiplas técnicas clássicas de otimização sobre a representação intermediária:

1. **Dobra de Constantes (_Constant Folding_)**: Expressões com operandos constantes são resolvidas em tempo de compilação (ex: `10 + 20 * 2` é dobrado diretamente para `50`).
2. **Simplificação Algébrica (_Algebraic Simplification_)**: Aplicação de identidades matemáticas:
    - $x \times 1 \to x$
    - $x + 0 \to x$
    - $x \times 0 \to 0$
3. **Eliminação de Código Morto (_Dead Code Elimination_)**: Remoção de instruções inalcançáveis após desvios incondicionais e blocos `if (false)`.

### 6. Geração de Bytecode (`src/compiler/bytecode.ts`)

- Converte as quádruplas otimizadas no conjunto de instruções da máquina virtual.
- Gera tabela de constantes (`constants`), pool de strings (`identifiers`) e o vetor de opcodes executáveis com resolução de endereços de salto (_backpatching_).

---

## 🕹️ A Máquina Virtual (VM)

Localizada em [`src/vm/virtualMachine.ts`](file:///c:/Users/joaov/Desktop/compiler-arena/src/vm/virtualMachine.ts):

- **Arquitetura de Pilha (_Stack Machine_)**: O interpretador consome operandos do topo de uma pilha de avaliação e armazena variáveis em um mapa de ambiente.
- **Execução por Ticks Determinísticos**: A cada tick da batalha, a VM de cada robô executa até encontrar uma instrução de ação de arena (`ACTION`) ou esgotar sua cota de instruções.
- **Proteção Contra Laços Infinitos (_Gas Limit_)**: Cada robô possui um teto de instruções por tick (`maxInstructionsPerTick = 100`). Robôs com laços `while(true)` não congelam a simulação nem travam o navegador.
- **Conjunto de Instruções**:
    - `PUSH`, `POP`, `LOAD`, `STORE`
    - `ADD`, `SUB`, `MUL`, `DIV`, `MOD`
    - `EQ`, `NEQ`, `LT`, `LTE`, `GT`, `GTE`
    - `AND`, `OR`, `NOT`
    - `JMP`, `JZ`, `JNZ`
    - `READ_SENSOR` (lê telemetria física real da simulação)
    - `ACTION` (emite ação física de `move`, `back`, `rotate`, `scan`, `fire`)
    - `HALT`

---

## 🛡️ Motor de Simulação & Arena 3D

Localizados em [`src/simulation/`](file:///c:/Users/joaov/Desktop/compiler-arena/src/simulation) e [`src/graphics/`](file:///c:/Users/joaov/Desktop/compiler-arena/src/graphics):

- **Simulação 100% Desacoplada**: A física da partida progride através de um motor puramente determinístico, permitindo testes unitários headless com execução ultra veloz.
- **Arena Quadrada ($900 \times 900$)**:
    - Piso modular low-poly em Three.js com acabamento fino e sem blocos de terra suspensos embaixo.
    - Barreiras perimetrais com pilares de acabamento proporcionais, impedindo que os tanques saiam do mapa.
- **Geração Aleatória Segura de Spawns**:
    - A cada nova partida ou revanche, posições completamente novas e imprevisíveis são calculadas para todos os robôs.
    - Distância mínima de segurança garantida ($\ge 200\text{ px}$ entre participantes) para evitar colisões no tick zero.
    - Orientação de mira inicial voltada para o interior da arena com jitter angular dinâmico.
- **Identificação Padronizada dos Robôs**:
    - Nomenclatura automática obrigatória: **"Robo 1"**, **"Robo 2"**, **"Robo 3"**, etc.
    - Cores de equipe do sistema atribuídas sequencialmente (Robo 1: Azul, Robo 2: Laranja, Robo 3: Verde, Robo 4: Púrpura).

---

## 📁 Exemplos Didáticos Disponíveis

Os arquivos de demonstração estão disponíveis na pasta [`examples/`](file:///c:/Users/joaov/Desktop/compiler-arena/examples) e integrados nos presets do editor:

1. **`01_hunter.tank`**: Caçador tático com varredura contínua de radar, perseguição e potência de tiro escalonada pela distância.
2. **`02_sniper.tank`**: Atirador de precisão que prioriza manter distância e recua caso o inimigo se aproxime.
3. **`03_striker.tank`**: Robô ofensivo agressivo com aproximação contínua e rajadas rápidas.
4. **`04_patrol.tank`**: Robô sentinela com movimentação tática defensiva pela arena.
5. **`05_optimization_demo.tank`**: Código construído para provar na prática as 3 técnicas de otimização (Dobra de Constantes, Simplificação Algébrica e Eliminação de Código Morto).
6. **`06_semantic_errors_demo.tank`**: Exemplo com erros semânticos planejados para demonstrar a precisão dos diagnósticos do compilador.

---

## 🎤 Roteiro para Apresentação ao Professor

Siga este roteiro estruturado para uma apresentação acadêmica de excelência:

### 1. Abertura e Apresentação do Conceito (2 min)

- Apresente o projeto: um compilador real para TankScript integrado a uma máquina virtual de pilha e visualização 3D em Three.js.
- Destaque o menu inicial: arena low-poly quadrada ($900 \times 900$) com câmera em órbita suave e painel compacto de configuração.

### 2. Demonstração do Compilador no Inspetor (5 min)

- Clique no botão **"Inspetor"** do **Robo 1** para abrir o modal de desenvolvimento:
    - **Aba Tokens**: Mostre a saída do Analisador Léxico, apontando o tipo de cada token, valor, linha e coluna.
    - **Aba AST**: Mostre a árvore sintática gerada pelo Parser recursivo descendente.
    - **Aba Símbolos**: Mostre a Tabela de Símbolos com escopos, tipos (`int`, `bool`) e inicialização.
    - **Aba TAC (IR)**: Mostre o Código de Três Endereços antes e depois da otimização.
    - **Aba Bytecode**: Mostre as instruções geradas para a máquina virtual de pilha (`PUSH`, `LOAD`, `ACTION`, etc.).

### 3. Prova das Otimizações de Código (3 min)

- No seletor de scripts do editor, carregue o preset **"Demo de Otimizações"** e abra o Inspetor na aba **TAC**:
    - Aponte a instrução `10 + 20 * 2` sendo dobrada para `50` (_Constant Folding_).
    - Aponte `constantFold * 1 + 0` sendo reduzida a `constantFold` (_Algebraic Simplification_).
    - Aponte o bloco `if (false)` sendo integralmente eliminado do código intermediário (_Dead Code Elimination_).

### 4. Demonstração de Erros Léxicos, Sintáticos e Semânticos (3 min)

- Carregue o preset **"Demo de Erros Sintáticos"**:
    - Mostre os alertas detalhados na interface com **linha e coluna exatas**.
    - Destaque erros semânticos detectados: modificação indevida de sensores read-only, tipos incompatíveis em operações e valores fora do intervalo permitido (`fire(10)`).

### 5. Combate na Arena 3D & Revanche (3 min)

- Inicie a batalha: a câmera transita suavemente para a visão tática isométrica.
- Observe a autonomia dos tanques: rotação da torreta com tracking suave, projéteis físicos com rastro de partículas e colisão nas barreiras perimetrais.
- Ao final, mostre o sobrevivente destacado com o farol de vitória.
- Clique em **"Revanche"**: demonstre que a partida reinicia instantaneamente, as malhas restauram seu estado íntegro e novas posições aleatórias são geradas.

### 6. Execução dos Testes Automatizados (1 min)

- No terminal, execute `pnpm test` e comprove a aprovação dos **80 testes unitários**.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos

- **Node.js** (versão 18 ou superior)
- **pnpm** (ou npm / yarn)

### Passo a Passo

```bash
# 1. Instalar as dependências
pnpm install

# 2. Iniciar o servidor de desenvolvimento
pnpm dev

# 3. Abrir no navegador
# Acesse: http://localhost:5173
```

### Comandos Disponíveis

| Comando          | Descrição                                                             |
| :--------------- | :-------------------------------------------------------------------- |
| `pnpm dev`       | Inicia o servidor Vite em modo de desenvolvimento com HMR.            |
| `pnpm test`      | Executa a suíte de testes com **Vitest**.                             |
| `pnpm run lint`  | Executa a análise estática com **Oxlint** (0 erros / 0 avisos).       |
| `pnpm run build` | Compila o TypeScript e empacota a aplicação para produção em `dist/`. |

---

## 🧪 Suíte de Testes Automatizados

O projeto conta com **80 testes automatizados** cobrindo todas as camadas do sistema:

```bash
$ vitest run

 ✓ src/test/lexer.test.ts (6 tests)
 ✓ src/test/parser.test.ts (5 tests)
 ✓ src/test/ir_and_optimizer.test.ts (5 tests)
 ✓ src/test/semantic.test.ts (12 tests)
 ✓ src/test/bytecode_and_vm.test.ts (4 tests)
 ✓ src/test/academic_and_edge_cases.test.ts (14 tests)
 ✓ src/test/simulation.test.ts (19 tests)
 ✓ src/test/presets_battle_dynamics.test.ts (6 tests)
 ✓ src/test/rematch_hud_and_open_arena.test.ts (9 tests)

 Test Files  9 passed (9)
      Tests  80 passed (80)
```

- **Léxico & Sintático**: Validação de palavras-chave, delimitadores, linha/coluna, precedência de operadores e árvore AST.
- **Semântico**: Detecção de variáveis não declaradas, duplicadas, tipos inválidos e violações de limites.
- **Otimizações & Bytecode**: Comprovação de dobra de constantes, simplificação algébrica e mapeamento de instruções.
- **Máquina Virtual**: Isolamento de memória, execução em pilha e corte de laços infinitos (_gas limit_).
- **Simulação Física**: Colisões, projéteis, rebotes em barreiras, danos e definição de vencedor.
- **Arena & Revanche**: Proporções $900 \times 900$, posições de spawn aleatórias e restauração visual completa de tanques destruídos.
