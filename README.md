# 🎮 USB Orchestra

**Comandos de consolas USB como instrumento musical eletrónico experimental** — direto no navegador, sem instalação, sem servidores e sem dados pessoais.

Liga comandos USB (DualShock 3, comandos Nintendo antigos, genéricos...) ao computador e transforma-os num instrumento coletivo: várias pessoas podem tocar simultaneamente, cada comando controlando uma parte diferente do som.

## Funcionalidades

### 🎹 Instrumento musical
- **Sintetizador com Web Audio API**: 4 formas de onda (sine, triangle, square, sawtooth), 4 buses independentes (lead, bass, chords, drums).
- **Filtros** (lowpass/highpass/bandpass/notch, com frequência, ressonância e envelope do filtro), **delay** (tempo, feedback, quantidade), **reverb** por convolução, **distorção** por waveshaping e **modulação** (detune).
- **Sequenciador rítmico de 16 passos** com várias pistas, mute por pista, BPM e swing.
- **Arpegiador** com padrões: subida, descida, sobe-desce, desce-sobe, aleatório, passeio aleatório, ordem premida; controlo de velocidade e oitavas.
- **Presets** de sons e padrões (Básico, Techno, Ambiente, Glitch, Trap).
- **Geração de variações aleatórias** por pista ou em todo o instrumento, com escalas musicais (pentatónicas, maior, menor, dórica, frígia, hirajoshi).

### 🎮 Comandos USB (Gamepad API)
- Até **4 comandos simultâneos**, cada um com função própria (lead, bass, chords, drums).
- **Deteção automática** de comandos, botões e eixos — adapta-se a comandos diferentes sem assumir layouts iguais.
- **Mapeamento predefinido** para começar a tocar imediatamente: eixo esquerdo toca notas quantizadas na escala, Start liga o sequenciador, ombres mudam de oitava, etc.
- **Modo "Aprender"**: escolhe uma ação e prime/mexe o controlo que a vai controlar. Suporta 23 ações (notas, arpejo, sequenciador, efeitos, transporte...).
- **Configurações guardadas localmente** (localStorage), para utilização futura.

### 🖥️ Interface
- Design moderno e escuro, pensado para workshops e performances ao vivo.
- Começar a produzir som em segundos: um clique para ativar o áudio, um preset, e premir botões.
- Mostra comandos ligados (com atividade em tempo real), controlos musicais e o estado do sequenciador passo a passo.

## Como usar

1. Abre a aplicação no navegador (ver [Publicação](#-publicação-no-github-pages) abaixo).
2. Liga os comandos USB ao computador.
3. Clica em **"▶ Ativar som e começar"** (os navegadores exigem uma interação antes de reproduzir áudio).
4. **Toca já**: prime os botões do comando — cada um é uma nota (estão em escala, tudo soa bem). O stick esquerdo faz pitch bend e abre/fecha o filtro.
5. Para um fundo rítmico, escolhe um **preset** no topo (ex.: Techno) e prime **▶ Tocar** no sequenciador.
6. Explora: muda padrões na grelha, ajusta o sintetizador por bus, ativa o arpegiador, ou abre **"Mapeamento dos comandos"** para atribuir funções com o modo Aprender.

### Mapeamento predefinido — modo performance (controlador MIDI)

O comando funciona como um **controlador MIDI**: cada botão é uma nota da escala, os sticks são expressão em tempo real. A aplicação **deteta automaticamente o tipo de controlador** (SNES/retro vs. moderno com sticks) e aplica o perfil adequado.

| Controlo | Ação (graus da escala menor natural em dó) |
|---|---|
| ✕ (botão 0) | Nota — fundamental (dó) |
| ○ (botão 1) | Nota — 3ª menor (mib) |
| □ (botão 2) | Nota — 4ª (fá) |
| △ (botão 3) | Nota — 5ª (sol) |
| D-pad ↑ ↓ ← → | Notas — graus altos da escala |
| R2 (botão 7) | Nota aguda adicional |
| L2 (botão 6) | **Sustain** — notas continuam enquanto premido |
| L1 / R1 | Oitava − / + (transpõe o comando inteiro) |
| Options (botão 9) | Ligar/desligar arpejo (as notas passam para o arpegiador) |
| Share (botão 8) | **Panic** — silencia tudo |
| Stick esq. X | **Pitch bend** (±2 semitons, aplica-se às notas held) |
| Stick esq. Y | Filtro: frequência (cutoff) |
| Stick dir. X | Filtro: ressonância |
| Stick dir. Y | Delay: quantidade |

Como os graus estão em escala, **qualquer combinação de botões soa bem** — podes premir vários ao mesmo tempo (polifonia). Cada comando pode ter uma função própria (lead, bass, chords, drums) para tocar em conjunto: muda a função no painel “Mapeamento dos comandos”.

**Sem comando USB?** As teclas `A S D F G H J K L` do teclado tocam as notas da escala (dó menor), a partir do momento em que ativas o som.

#### Comandos SNES / retro (sem sticks)

Adaptadores SNES USB (e comandos retro em geral) recebem um perfil próprio, detetado automaticamente pelo ID do dispositivo ou pela heurística (poucos botões, sem sticks):

| Controlo | Ação |
|---|---|
| A B X Y (face) | Notas — fundamental, 3ª, 4ª, 5ª |
| L / R | Oitava − / + |
| ZL / ZR (botões 6-7) | Sustain / Arpejo |
| Select | Panic |
| Start | Play / Stop do sequenciador |
| D-pad (se for eixos) | Pitch bend / Cutoff |

> Os índices de botões variam entre adaptadores e navegadores. Se um botão não fizer o esperado, usa o modo Aprender para o remapear — escolhe a ação “Nota (grau da escala)” e prime o botão; ele recebe automaticamente o próximo grau livre. Fica guardado no navegador.

## Publicação no GitHub Pages

A aplicação é 100% estática e usa apenas caminhos relativos, por isso funciona num subdiretório do GitHub Pages.

1. Cria um repositório no GitHub e faz push deste conteúdo para o ramo `main`.
2. Em **Settings → Pages**, escolhe **Source: GitHub Actions**.
3. O workflow incluído em `.github/workflows/pages.yml` publica automaticamente.
4. A app fica em `https://<utilizador>.github.io/<repositório>/`.

Para testar localmente, basta abrir `index.html` num navegador servido por HTTP (ex.: `python3 -m http.server`) — a Gamepad API requer contexto seguro (localhost serve).

## Testes

```bash
npm install   # jsdom, apenas para testes
npm test      # 89 testes de lógica + 28 testes de fumo (UI simulada com Web Audio e Gamepad API falsas)
```

Os testes cobrem: conversão de notas, limites de BPM, passos do sequenciador, escalas aleatórias, padrões do arpegiador, presets, mapeamentos (aprender, guardar, carregar), quantização de eixos e o fluxo completo da interface com um comando simulado.

### O que precisa de validação real em hardware

- A correspondência de índices de botões/eixos em comandos físicos (DualShock 3 em particular, cujo driver varia por sistema operativo: no Linux via hidraw/Steam, os eixos 0-3 correspondem aos analógicos; no macOS pode requerer o driver de HID).
- Detalhe dos gatilhos analógicos (PlayStation L2/R2) que podem surgir como eixos ou botões conforme o driver.
- Latência em sistemas com muitos dispositivos USB.
- Comportamento ao ligar/desligar comandos durante a performance (a aplicação já deteta e atualiza, mas convém testar com o hardware real).

## Arquitetura

```
index.html          — interface
css/style.css       — estilos
js/
  synth.js          — Web Audio API: osciladores, filtros, delay, reverb, distorção
  sequencer.js      — sequenciador de 16 passos com lookahead scheduling
  arpeggiator.js    — arpegiador com 7 padrões
  gamepads.js       — Gamepad API: até 4 comandos, deteção e leitura
  mapping.js        — ações, mapeamento predefinido, modo aprender, localStorage
  engine.js         — liga comandos a ações musicais (notas, efeitos, transporte)
  presets.js        — presets, escalas, geração aleatória
  app.js            — interface (DOM)
test/
  test-logic.js     — testes de lógica (Node puro)
  test-smoke.js     — testes de fumo com jsdom + Web Audio/Gamepad simulados
```

## Notas técnicas

- Áudio só é ativado após clique do utilizador (requisito dos navegadores).
- O sequenciador usa *lookahead scheduling* (agendamento à frente de 100 ms) para timing preciso sem bloquear a UI.
- Sem servidores, bases de dados, telemetria ou dados pessoais; as configurações vivem no `localStorage` do próprio navegador.
- Compatível com GitHub Pages em subdiretório (todos os recursos usam caminhos relativos).
