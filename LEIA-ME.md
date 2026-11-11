# Sueca entre amigos

Jogo de Sueca online e fechado: só entra quem tem o código da sala (4 letras). Os lugares vazios são preenchidos por bots, e um amigo pode entrar no meio da partida no lugar de um bot.

## Regras implementadas
- Baralho de 40 cartas (sem 8, 9 e 10). Força: A, 7, K, J, Q, 6, 5, 4, 3, 2.
- Pontos: A=11, 7=10, K=4, J=3, Q=2 (total 120).
- Duplas: lugares 1 e 3 contra 2 e 4.
- O trunfo é a última carta do dador, que fica na mão dele.
- **Renúncia liberada, igual na mesa:** o app deixa jogar qualquer carta. Quem tem o naipe puxado e joga outro está "roubando".
  - O adversário pode tocar em **🚨 Renúncia!** durante a mão ou logo no fim dela.
  - Se a acusação estiver certa, a dupla que acusou ganha 4 jogos e a mão acaba.
  - Se estiver errada, a outra dupla ganha 1 jogo. Cada dupla só pode errar uma acusação por mão.
  - Os bots nunca roubam. Mas, quando um ladrão joga depois o naipe que tinha negado, os bots adversários às vezes percebem e acusam.
- 61 a 90 = 1 ponto; 91 a 119 (o adversário não livra os 30) = 2 pontos; Bandeira (120) = 4 pontos; 60 a 60 = empate, e a próxima mão vale dobrado (1 vira 2, 2 vira 4; se empatar de novo, dobra de novo).
- Os pontos são marcados em cruz, com uma bolinha em cada canto. Quem fecha a cruz (4 pontos) ganha a partida, e o placar geral de partidas fica embaixo. Partida fechada 4 a 0 é Gato.
- Se alguém cair, o bot joga por ele depois de 15 segundos. Ao reabrir o app, a pessoa volta para o mesmo lugar.

## Truco Paulista e Mineiro
- Escolha o jogo na tela inicial antes de criar a sala.
- Paulista: mão vale 1; Truco 3, Seis 6, Nove 9, Doze 12. A manilha é a carta seguinte à vira (ordem dos naipes: ♦ < ♠ < ♥ < ♣). Mão de onze: a dupla vê as cartas do parceiro e decide jogar (vale 3) ou correr.
- Mineiro: mão vale 2; Truco 4, Seis 6, Dez 10, Doze 12. Manilhas fixas: 4♣ > 7♥ > A♠ > 7♦. Mão de dez igual à mão de onze.
- Cangou (empate na vaza): vale a regra comum, quem ganhou a primeira leva; se a primeira cangou, a seguinte decide.

## Pife (2 a 4 jogadores)
- Dois baralhos, 9 cartas. Na vez: toque no Monte ou no Lixo para comprar, depois toque numa carta para descartar.
- Quando der para fechar as 9 cartas em jogos (trincas de naipes diferentes ou sequências do mesmo naipe; Ás vale A-2-3 ou Q-K-A), aparece o botão **🏆 Bater!**.

## Burro (2 a 4 jogadores)
- 5 cartas para cada um. Quem começa joga qualquer carta; os outros seguem o naipe.
- Quem não tem o naipe toca em **Comprar do monte** até conseguir. A maior do naipe leva e começa a próxima.
- Quem fica sem cartas sai; o último com cartas é o **burro** 🫏.

## Câmera e voz
- Toque em 📷 para ligar a câmera e o microfone. A sua imagem aparece no canto de baixo e a dos amigos aparece perto dos nomes deles.
- 🎤 liga e desliga o microfone. 🚫📷 desliga tudo.
- O vídeo vai direto de um celular para o outro, sem passar pelo servidor.
- Em algumas redes de 4G a conexão direta é bloqueada e o vídeo não aparece. Se isso acontecer, dá para adicionar um servidor TURN; me peça que eu configuro.

## Espectadores
- Na tela inicial, toque em **👀 Só assistir** para entrar como espectador. Quem tentar entrar com a mesa cheia vira espectador automaticamente.
- O espectador vê a mesa e a câmera dos jogadores, mas não vê as cartas de ninguém.
- Ele fala só por áudio: o botão **🎤 Falar** liga o microfone, sem câmera.
- Se houver um bot na mesa, o botão **🪑 Jogar** coloca o espectador no lugar dele.

## Passo 1: subir o servidor (grátis, no Render)
1. Crie uma conta no GitHub e um repositório novo. Envie todos os arquivos desta pasta (inclusive a pasta `.github`).
2. Crie uma conta em render.com e escolha **New > Web Service**, ligado a esse repositório.
3. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plano: Free
4. Quando terminar, o Render mostra um endereço como `https://sueca-xyz.onrender.com`.

Nesse ponto o jogo já funciona: abra esse endereço no navegador do celular e teste.

Observação: no plano grátis o servidor "dorme" depois de 15 minutos sem uso. A primeira pessoa a abrir espera uns 50 segundos; depois disso fica rápido.

## Passo 2: gerar o APK (sem instalar nada no PC)
1. No GitHub, edite o arquivo `capacitor.config.json` e troque `https://TROQUE-AQUI.onrender.com` pelo seu endereço do Render.
2. Vá na aba **Actions**, escolha **Gerar APK** e clique em **Run workflow**.
3. Depois de uns 5 minutos, abra a execução concluída e baixe o artefato `sueca-apk` (vem em .zip, com o `app-debug.apk` dentro).
4. Mande o APK para os amigos. No Android, é preciso permitir "instalar apps de fontes desconhecidas".

O APK só abre o seu servidor. Então, se você mudar o jogo no futuro, basta atualizar o servidor; não precisa gerar outro APK.

## Testar no computador
```
npm install
npm start
```
Depois abra http://localhost:3000 em várias abas.
