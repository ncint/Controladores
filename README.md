# 🎮 USB Orchestra

**Comandos de consolas USB como instrumento musical eletrónico experimental** — direto no navegador, sem instalação, sem servidores e sem dados pessoais.

Liga comandos USB (DualShock 3, comandos Nintendo antigos, genéricos...) ao computador e transforma-os num instrumento coletivo: várias pessoas podem tocar simultaneamente, cada comando controlando uma parte diferente do som.

## Funcionalidades

### 🎹 Instrumento musical (4 secções independentes)
- **LEAD**: osciladores combinados (mistura de ondas + spread), filtro ressonante com envelope, portamento, vibrato (LFO) e delay.
- **BASS**: suboscilador (-1 oitava), dois osciladores combinados, ataque definido, filtro ressonante e saturação (soft-clip tanh).
- **CHORDS**: polifónico para acordes e pads com chorus estéreo verdadeiro (2 vozes detunadas com LFO), envelopes longos e reverb por convolução (impulso sintetizado com cauda filtrada).
- **DRUMS**: amostras WAV geradas por síntese no próprio projeto (kick, snare, closed/open hi-hat, clap, 3 toms — kits 808/909), com fallback sintetizado enquanto carregam.
- **Master**: volume geral na barra do topo + limiter (compressor de segurança) contra clipping.
- Web Audio API pura (sem bibliotecas externas) — sem URLs externas, tudo no repositório.
- **Sons por comando**: cada carta de comando tem os sons da sua voz, escolhidos com um clique — listas distintas e profissionais por voz:
  - **lead**: Supersaw (JP-8000), Lead Minimoog, Acid 303, Porta-lead (SH-101), Sino FM (DX7), Pluck trance, Whistle 8-bit
  - **bass**: Baixo Moog, Sub baixo, Acid 303 grave, Baixo 808, Reese (DnB), FM slap
  - **chords**: Pad etéreo (Juno), Strings JP-8, E-piano DX7, Órgão (Hammond), Brass Prophet-5, Pad D-50, Flauta
  - **drums**: Kit 808, Kit 909, Kit acústico, Kit lo-fi (kick/snare/hat/clap sintetizados com carácter próprio por kit)
- **Sintetizador com Web Audio API** por baixo: 4 formas de onda, filtros, envelopes, delay, reverb, distorção e detune — configurados automaticamente pelo som escolhido.
- **Filtros** (lowpass/highpass/bandpass/notch, com frequência, ressonância e envelope do filtro), **delay** (tempo, feedback, quantidade), **reverb** por convolução, **distorção** por waveshaping e **modulação** (detune).

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

Adaptadores SNES USB (e comandos retro em geral) recebem um perfil próprio, detetado automaticamente pelo ID do dispositivo ou pela heurística (poucos botões, sem sticks). Neste perfil, **todos os botões tocam notas** — uma **oitava completa da escala** disposta como um instrumento:

| Ordem | Controlo | Grau | Nota (dó menor) |
|---|---|---|---|
| 1 | ← (cursor esquerda) | fundamental | dó |
| 2 | ↑ (cursor cima) | 2ª | ré |
| 3 | → (cursor direita) | 3ª menor | mib |
| 4 | ↓ (cursor baixo) | 4ª | fá |
| 5 | Y | 5ª | sol |
| 6 | X | 6ª menor | láb |
| 7 | botão 6 (ombro) | 7ª menor | sib |
| 8 | B | **oitava** | dó |

Os restantes botões (A, ombro 7, Select, Start…) continuam a escala nos graus seguintes. Se o adaptador reportar o cursor como **eixos** em vez de botões, esses eixos ficam para **pitch bend** (X) e **cutoff** do filtro (Y), e a oitava começa no Y.

Como os graus estão em escala, **qualquer combinação de botões soa bem** e podes premir vários ao mesmo tempo (polifonia).

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

## Os teus samples de bateria (TR-808)

Os teus samples TR-808 já estão mapeados com os nomes originais do pack:

| Ficheiro no repo | Peça |
|---|---|
| `samples/custom/TR808 BD Bass Drum Medium 02.wav` | Bombo |
| `samples/custom/TR808 BD Bass Drum Driven 02.wav` | Bombo com drive |
| `samples/custom/TR808 SD Snare Drum 048.wav` | Caixa |
| `samples/custom/TR808 CH Closed Hat 35.wav` | Hi-hat fechado |
| `samples/custom/TR808 OH Open Hat 01.wav` | Hi-hat aberto |
| `samples/custom/TR808 CP Hand Clap 04.wav` | Palmas |
| `samples/custom/TR808 CPSD Clap Snare Drum 5 Elixir.wav` | Clap+snare |
| `samples/custom/TR808 MT Mid Tom 22.wav` | Tom grave |
| `samples/custom/TR808 MT Mid Tom 18.wav` | Tom médio/agudo |
| `samples/custom/TR808 RS Rim Shot 02.wav` | Rim shot |
| `samples/custom/ALT Altered 08 MA Maraca Metal.wav` | Maraca |

Escolhe o som **"TR-808 (meus samples)"** na voz drums de um comando. Na voz drums, cada grau do comando toca uma peça (ordem): kick, snare, hat fechado, hat aberto, clap, tom grave, tom médio, tom agudo, rim, maraca, clap+snare, bombo driven…

## Amostras de bateria e licenças

As amostras em `samples/*.wav` (kick, snare, hi-hats, clap, toms — kits 808 e 909) foram **geradas por síntese pelo próprio projeto** com `scripts/make-samples.js` (Node.js puro, sem dependências). São originais, sem restrições de redistribuição. Para regenerar: `node scripts/make-samples.js`.

## Arquitetura

```
index.html          — interface
css/style.css       — estilos
samples/*.wav       — amostras de bateria (808/909)
scripts/make-samples.js — gerador de amostras (Node puro)
js/
  synth.js          — Web Audio API: osciladores, filtros, delay, reverb, distorção
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
