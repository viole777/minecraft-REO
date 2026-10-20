# Mundo de Blocos

[![Deploy to GitHub Pages](https://github.com/viole777/minecraft-REO/actions/workflows/pages.yml/badge.svg)](https://github.com/viole777/minecraft-REO/actions/workflows/pages.yml)

**Jogue online:** [Mundo de Blocos](https://viole777.github.io/minecraft-REO/)

Reconstrução **autorail** do gênero sandbox de voxels (inspirada no comportamento observável
do Minecraft, sem usar código, texturas ou assets de terceiros), feita para rodar
**no navegador, offline, no seu computador**.

Tudo é gerado por código: terreno procedural, texturas 16×16 pixeladas, sons sintetizados,
ícones isométricos e as ovelhas.

## Como jogar

Basta **dar duplo clique em `index.html`** — não precisa de servidor, internet nem instalação.

(Opcional, se o seu navegador bloquear algo em `file://`): `npx serve .` e abra o endereço indicado.)

### Controles

| Tecla / Botão | Ação |
|---|---|
| WASD / setas | Mover |
| Espaço | Pular / subir (voar e nadar) |
| Ctrl | Correr |
| Shift | Agachar / descer (voar) |
| Duplo Espaço | Ligar/desligar voo |
| Botão esquerdo | Quebrar bloco (segure para repetir) |
| Botão direito | Colocar bloco |
| Botão do meio | Copiar bloco mirado para o hotbar |
| Roda ou 1–9 | Trocar slot do hotbar |
| E | Inventário (com busca) |
| ESC | Pausa / voltar |
| F3 | Debug (FPS, coordenadas, chunks) |

## Estrutura

```
index.html        telas e HUD
css/style.css     interface estilo pixelado
lib/three.min.js  Three.js r128 (local)
js/noise.js       ruído Perlin (2D/3D + fbm) determinístico
js/blocks.js      registro de 22 blocos
js/textures.js    atlas de texturas desenhado em canvas (procedural)
js/world.js       chunks 16×16×80: planícies, lagos, praias, árvores, minérios, flores
js/mesher.js      malha por chunk: oclusão de faces + AO + sombreamento por face
js/player.js      física AABB, colisão, raycast DDA
js/mobs.js        ovelhas com IA de vagueio
js/sound.js       efeitos sonoros (WebAudio)
js/ui.js          menu, hotbar, inventário, pausa, opções
js/main.js        cena, streaming de chunks, entradas, laço principal, save
```

## Testes

```
node test/run.js      # 55 testes de lógica (ruído, mundo, malha, raycast, física)
node test/shots.js    # validação em navegador headless (requer Edge/Chromium)
node test/save.js     # persistência (save -> reload -> mesmo mundo)
```

## Recursos

- Mundo infinito por chunks com streaming e descarga por distância
- Save automático em `localStorage` (seed + edições, a cada 20s e ao sair)
- Opções: FOV, sensibilidade, distância de renderização, som
- Água com superfície rebaixada e visão submersa, nuvens em bloco, céu com gradiente, sol
- Partículas ao quebrar, balanço de câmera/mão, sons de passo/quebra/colocação

## Aviso

Projeto educacional autoral, **não afiliado à Mojang/Microsoft**. Não contém código,
texturas, nomes ou assets do Minecraft — apenas mecânicas de jogo (não protegidas por
copyright) reconstruídas por observação de comportamento.
