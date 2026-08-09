(() => {
    const suits = ['C', 'D', 'H', 'S'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const cardBacks = ['blue_back.png', 'gray_back.png', 'green_back.png', 'purple_back.png', 'red_back.png', 'yellow_back.png'];

    let deck = [];
    let playerHands = [[]]; // Array of hands to support splitting
    let currentHandIndex = 0;
    let dealerHand = [];
    let currentBackImage = '';
    let gameActive = false;
    let gameResolutions = [];
    
    let audioCtx = null;
    let isSoundEnabled = true;
    let globalVolume = 0.3;

    // Fun Mode State
    let playerWins = 0;
    let computerWins = 0;

    let playMode = 'fun';
    let balance = 1000;
    let pendingBetAmount = 100;
    let initialBetAmount = 0;
    let currentBets = [];
    let hasSeenRules = false;

    // DOM Elements
    const dealerHandEl = document.getElementById('dealer-hand');
    const playerHandsWrapper = document.getElementById('player-hands-wrapper');
    const dealerScoreEl = document.getElementById('dealer-score');
    const playerScoreEl = document.getElementById('player-score');
    const gameMessageEl = document.getElementById('game-message');
    const deckImageEl = document.getElementById('deck-image');
    const btnSoundToggle = document.getElementById('btn-sound-toggle');
    const volumeSlider = document.getElementById('sound-volume');

    const btnDeal = document.getElementById('btn-deal');
    const btnHit = document.getElementById('btn-hit');
    const btnStand = document.getElementById('btn-stand');
    const btnDouble = document.getElementById('btn-double');
    const btnSplit = document.getElementById('btn-split');
    const btnNext = document.getElementById('btn-next');

    // Modals & Scoreboard DOM
    const startupModal = document.getElementById('startup-modal');
    const btnPlayFun = document.getElementById('btn-play-fun');
    const btnPlayMoney = document.getElementById('btn-play-money');
    const scoreWins = document.getElementById('score-wins');
    const scoreMoney = document.getElementById('score-money');

    const bettingModal = document.getElementById('betting-modal');
    const bettingRules = document.getElementById('betting-rules');
    const bettingBalanceEl = document.getElementById('betting-balance');
    const betAmountEl = document.getElementById('bet-amount');
    const btnBetMinus = document.getElementById('btn-bet-minus');
    const btnBetPlus = document.getElementById('btn-bet-plus');
    const btnPlaceBet = document.getElementById('btn-place-bet');

    const playerBalanceEl = document.getElementById('player-balance');
    const currentBetEl = document.getElementById('current-bet');

    // Initialize Game Session
    function initSession() {
        let savedBalance = localStorage.getItem('blackjack_balance');
        if (savedBalance) {
            balance = parseInt(savedBalance);
        }
        
        currentBackImage = cardBacks[Math.floor(Math.random() * cardBacks.length)];
        deckImageEl.src = `images/${currentBackImage}`;
    }
    
    function saveBalance() {
        if (playMode === 'money') {
            localStorage.setItem('blackjack_balance', balance);
        }
    }

    // Mode Selection
    btnPlayFun.addEventListener('click', () => {
        initAudio();
        playMode = 'fun';
        startupModal.style.display = 'none';
        scoreWins.style.display = 'flex';
        startGame();
    });

    btnPlayMoney.addEventListener('click', () => {
        initAudio();
        playMode = 'money';
        startupModal.style.display = 'none';
        scoreMoney.style.display = 'flex';
        startBettingPhase();
    });
    
    function initAudio() {
        if (!isSoundEnabled) return;
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function playCardSound() {
        if (!isSoundEnabled || !audioCtx) return;
        
        const bufferSize = audioCtx.sampleRate * 0.15; // 0.15s
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000; // Softer frequency

        const gain = audioCtx.createGain();
        const peakVolume = globalVolume * 0.5; // Scale volume down slightly
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(peakVolume, audioCtx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        noise.start();
    }

    // Betting Phase
    function startBettingPhase() {
        if (!hasSeenRules) {
            bettingRules.style.display = 'block';
            hasSeenRules = true;
        } else {
            bettingRules.style.display = 'none';
        }
        
        // Ensure bet isn't higher than balance if balance dropped
        if (pendingBetAmount > balance && balance >= 100) pendingBetAmount = balance;
        if (balance < 100) pendingBetAmount = balance; // can't bet if 0, but we handle game over elsewhere

        bettingBalanceEl.innerText = balance;
        betAmountEl.innerText = '$' + pendingBetAmount;
        bettingModal.style.display = 'flex';
        
        // Handle bankrupt state
        if(balance < 100) {
            btnPlaceBet.innerText = "Bankrupt! Claim $1000";
            btnPlaceBet.style.backgroundColor = "var(--danger)";
        } else {
            btnPlaceBet.innerText = "Deal Cards";
            btnPlaceBet.style.backgroundColor = "var(--primary)";
        }
    }

    btnBetMinus.addEventListener('click', () => {
        if (pendingBetAmount > 100) {
            pendingBetAmount -= 100;
            betAmountEl.innerText = '$' + pendingBetAmount;
        }
    });

    btnBetPlus.addEventListener('click', () => {
        if (pendingBetAmount + 100 <= balance) {
            pendingBetAmount += 100;
            betAmountEl.innerText = '$' + pendingBetAmount;
        }
    });

    btnPlaceBet.addEventListener('click', () => {
        // If bankrupt, clicking the button resets balance
        if (balance < 100) {
            balance = 1000;
            saveBalance();
            pendingBetAmount = 100;
            startBettingPhase(); // Refresh modal
            return;
        }

        if (balance >= pendingBetAmount && pendingBetAmount > 0) {
            balance -= pendingBetAmount;
            saveBalance();
            initialBetAmount = pendingBetAmount;
            currentBets = [pendingBetAmount];
            
            playerBalanceEl.innerText = balance;
            currentBetEl.innerText = currentBets[0];
            
            bettingModal.style.display = 'none';
            startGame();
        }
    });

    function buildDeck() {
        deck = [];
        for (let i = 0; i < suits.length; i++) {
            for (let j = 0; j < values.length; j++) {
                deck.push({
                    value: values[j],
                    suit: suits[i],
                    image: `${values[j]}${suits[i]}.png`
                });
            }
        }
    }

    function shuffleDeck() {
        for (let i = 0; i < deck.length; i++) {
            let j = Math.floor(Math.random() * deck.length);
            let temp = deck[i];
            deck[i] = deck[j];
            deck[j] = temp;
        }
    }

    function startGame() {
        gameActive = true;
        playerHands = [[]];
        currentHandIndex = 0;
        dealerHand = [];
        gameResolutions = [];
        buildDeck();
        shuffleDeck();

        dealerHandEl.innerHTML = '';
        playerHandsWrapper.innerHTML = `<div class="hand-area active-hand" id="player-hand-0"></div>`;
        
        gameMessageEl.innerText = "Good Luck!";
        btnDeal.style.display = 'none';
        btnNext.style.display = 'none';
        btnSplit.style.display = 'none';
        btnDouble.style.display = 'none';
        btnHit.disabled = false;
        btnStand.disabled = false;

        // Deal initial cards
        setTimeout(() => { hit(playerHands[0], document.getElementById('player-hand-0'), 'player'); }, 200);
        setTimeout(() => { hit(dealerHand, dealerHandEl, 'dealer', true); }, 700);
        setTimeout(() => { hit(playerHands[0], document.getElementById('player-hand-0'), 'player'); }, 1200);
        setTimeout(() => { hit(dealerHand, dealerHandEl, 'dealer'); }, 1700);

        setTimeout(() => {
            checkSplitPossibility();
            checkDoublePossibility();
            checkBlackjack();
        }, 2200);
    }

    function hit(hand, el, type, hidden = false) {
        playCardSound();
        let card = deck.pop();
        card.hidden = hidden;
        hand.push(card);

        let img = document.createElement('img');
        img.src = hidden ? `images/${currentBackImage}` : `images/${card.image}`;
        img.className = `card-img`;
        if(hidden) img.id = "hidden-card";
        
        el.appendChild(img);
        
        // Animate from deck
        const deckRect = deckImageEl.getBoundingClientRect();
        const targetRect = img.getBoundingClientRect();
        
        const dx = deckRect.left - targetRect.left;
        const dy = deckRect.top - targetRect.top;
        
        img.animate([
            { transform: `translate(${dx}px, ${dy}px) rotate(180deg)` },
            { transform: `translate(0px, 0px) rotate(0deg)` }
        ], {
            duration: 400,
            easing: 'ease-out'
        });

        updateScores();
    }

    function updateScores() {
        if (playerHands.length > 0) {
            playerScoreEl.innerText = calculateScore(playerHands[currentHandIndex] || playerHands[0]);
        }

        if (gameActive) {
            let visibleDealerCards = dealerHand.filter(c => !c.hidden);
            dealerScoreEl.innerText = calculateScore(visibleDealerCards);
        } else {
            dealerScoreEl.innerText = calculateScore(dealerHand);
        }
        
        if (playMode === 'money') {
            playerBalanceEl.innerText = balance;
            currentBetEl.innerText = currentBets.reduce((a, b) => a + b, 0);
        }
    }

    function calculateScore(hand) {
        if (!hand) return 0;
        let score = 0;
        let hasAce = false;

        for (let i = 0; i < hand.length; i++) {
            let cardValue = hand[i].value;
            if (cardValue === 'A') {
                score += 11;
                hasAce = true;
            } else if (['J', 'Q', 'K'].includes(cardValue)) {
                score += 10;
            } else {
                score += parseInt(cardValue);
            }
        }

        let aces = hand.filter(c => c.value === 'A').length;
        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }
        return score;
    }

    function checkSplitPossibility() {
        if (playerHands[0].length === 2 && playerHands[0][0].value === playerHands[0][1].value) {
            if (playMode === 'money') {
                if (balance >= currentBets[0]) {
                    btnSplit.style.display = 'inline-block';
                }
            } else {
                btnSplit.style.display = 'inline-block';
            }
        }
    }
    
    function checkDoublePossibility() {
        if (playerHands[currentHandIndex].length === 2) {
            if (playMode === 'money') {
                if (balance >= currentBets[currentHandIndex]) {
                    btnDouble.style.display = 'inline-block';
                }
            } else {
                btnDouble.style.display = 'inline-block';
            }
        }
    }

    function splitHand() {
        btnSplit.style.display = 'none';
        btnDouble.style.display = 'none';
        
        if (playMode === 'money') {
            balance -= currentBets[0];
            currentBets.push(currentBets[0]);
            saveBalance();
            updateScores();
        }
        
        let splitCard = playerHands[0].pop();
        playerHands.push([splitCard]);
        
        let el0 = document.getElementById('player-hand-0');
        el0.removeChild(el0.lastChild); 
        
        let el1 = document.createElement('div');
        el1.className = "hand-area";
        el1.id = "player-hand-1";
        playerHandsWrapper.appendChild(el1);
        
        let img = document.createElement('img');
        img.src = `images/${splitCard.image}`;
        img.className = `card-img`;
        el1.appendChild(img);
        
        setTimeout(() => { hit(playerHands[0], el0, 'player'); }, 300);
        setTimeout(() => { hit(playerHands[1], el1, 'player'); }, 800);
        
        setTimeout(() => {
            checkDoublePossibility();
        }, 1300);
    }

    function checkBlackjack() {
        let pScore = calculateScore(playerHands[0]);
        let dScore = calculateScore(dealerHand);

        if (pScore === 21 && dScore === 21) {
            processPayout('push', 0, true);
            endGame("It's a Tie! Both have Blackjack.", 'tie');
        } else if (pScore === 21) {
            processPayout('blackjack', 0, true);
            endGame("Blackjack! You Win 3:2!", 'player');
        } else if (dScore === 21) {
            processPayout('lose', 0, true);
            endGame("Dealer has Blackjack! You Lose.", 'computer');
        }
    }

    function playerHit() {
        if (!gameActive) return;
        btnSplit.style.display = 'none';
        btnDouble.style.display = 'none';
        
        let currentEl = document.getElementById(`player-hand-${currentHandIndex}`);
        hit(playerHands[currentHandIndex], currentEl, 'player');
        
        let pScore = calculateScore(playerHands[currentHandIndex]);
        if (pScore > 21) {
            gameResolutions[currentHandIndex] = "Bust";
            advanceHand();
        }
    }

    function playerStand() {
        if (!gameActive) return;
        btnSplit.style.display = 'none';
        btnDouble.style.display = 'none';
        gameResolutions[currentHandIndex] = "Stand";
        advanceHand();
    }
    
    function playerDoubleDown() {
        if (!gameActive) return;
        btnSplit.style.display = 'none';
        btnDouble.style.display = 'none';
        
        if (playMode === 'money') {
            balance -= currentBets[currentHandIndex];
            currentBets[currentHandIndex] *= 2;
            saveBalance();
            updateScores();
        }
        
        let currentEl = document.getElementById(`player-hand-${currentHandIndex}`);
        hit(playerHands[currentHandIndex], currentEl, 'player');
        
        let pScore = calculateScore(playerHands[currentHandIndex]);
        if (pScore > 21) {
            gameResolutions[currentHandIndex] = "Bust";
        } else {
            gameResolutions[currentHandIndex] = "Stand";
        }
        
        // Wait a tiny bit for animation before advancing hand
        setTimeout(advanceHand, 600);
    }

    function advanceHand() {
        let currentEl = document.getElementById(`player-hand-${currentHandIndex}`);
        currentEl.classList.remove('active-hand');
        
        currentHandIndex++;
        
        if (currentHandIndex < playerHands.length) {
            let nextEl = document.getElementById(`player-hand-${currentHandIndex}`);
            nextEl.classList.add('active-hand');
            updateScores();
            checkDoublePossibility();
        } else {
            gameActive = false;
            btnHit.disabled = true;
            btnStand.disabled = true;

            dealerHand[0].hidden = false;
            let hiddenImg = document.getElementById("hidden-card");
            if(hiddenImg) hiddenImg.src = `images/${dealerHand[0].image}`;
            
            dealerTurn();
        }
    }

    function dealerTurn() {
        let dScore = calculateScore(dealerHand);
        updateScores();

        let allBusted = gameResolutions.every(res => res === "Bust");
        
        if (dScore < 17 && !allBusted) {
            setTimeout(() => {
                hit(dealerHand, dealerHandEl, 'dealer');
                dealerTurn();
            }, 1000);
        } else {
            setTimeout(evaluateWinner, 500);
        }
    }

    function processPayout(result, handIndex, isBlackjack = false) {
        if (playMode !== 'money') return;
        
        let bet = currentBets[handIndex];
        if (result === 'win') {
            balance += bet * 2;
        } else if (result === 'blackjack') {
            balance += bet + (bet * 1.5);
        } else if (result === 'push') {
            balance += bet;
        }
        saveBalance();
    }

    function evaluateWinner() {
        let dScore = calculateScore(dealerHand);
        let messages = [];
        let turnWins = 0;
        let turnLosses = 0;

        for (let i = 0; i < playerHands.length; i++) {
            let pScore = calculateScore(playerHands[i]);
            let resultMsg = "";
            let handName = playerHands.length > 1 ? `Hand ${i+1}: ` : "";

            if (gameResolutions[i] === "Bust") {
                resultMsg = handName + "Bust!";
                processPayout('lose', i);
                turnLosses++;
            } else if (dScore > 21) {
                resultMsg = handName + "Win! (Dealer Bust)";
                processPayout('win', i);
                turnWins++;
            } else if (pScore > dScore) {
                resultMsg = handName + "Win!";
                processPayout('win', i);
                turnWins++;
            } else if (pScore < dScore) {
                resultMsg = handName + "Lose.";
                processPayout('lose', i);
                turnLosses++;
            } else {
                resultMsg = handName + "Push.";
                processPayout('push', i);
            }
            messages.push(resultMsg);
        }

        if (turnWins > turnLosses) {
            endGame(messages.join(" | "), 'player');
        } else if (turnLosses > turnWins) {
            endGame(messages.join(" | "), 'computer');
        } else {
            endGame(messages.join(" | "), 'tie');
        }
    }

    function endGame(message, winner) {
        gameActive = false;
        btnHit.disabled = true;
        btnStand.disabled = true;
        btnSplit.style.display = 'none';
        btnDouble.style.display = 'none';
        btnNext.style.display = 'block';
        gameMessageEl.innerText = message;

        if (dealerHand.length > 0 && dealerHand[0].hidden) {
            dealerHand[0].hidden = false;
            let hiddenImg = document.getElementById("hidden-card");
            if(hiddenImg) hiddenImg.src = `images/${dealerHand[0].image}`;
        }
        
        updateScores();

        if (playMode === 'fun') {
            if (winner === 'player') {
                playerWins++;
                document.getElementById('player-wins').innerText = playerWins;
            } else if (winner === 'computer') {
                computerWins++;
                document.getElementById('computer-wins').innerText = computerWins;
            }
        }
    }

    function showToast(message) {
        const toast = document.getElementById('toast-notification');
        if (!toast) return;
        toast.innerText = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    // Event Listeners
    btnDeal.addEventListener('click', startGame);
    btnHit.addEventListener('click', playerHit);
    btnStand.addEventListener('click', playerStand);
    btnSplit.addEventListener('click', splitHand);
    btnDouble.addEventListener('click', playerDoubleDown);

    volumeSlider.addEventListener('input', (e) => {
        globalVolume = parseFloat(e.target.value);
        if (globalVolume === 0) {
            isSoundEnabled = false;
            btnSoundToggle.innerText = '🔇';
        } else {
            isSoundEnabled = true;
            btnSoundToggle.innerText = '🔊';
            initAudio();
        }
    });

    btnSoundToggle.addEventListener('click', () => {
        isSoundEnabled = !isSoundEnabled;
        btnSoundToggle.innerText = isSoundEnabled ? '🔊' : '🔇';
        if (isSoundEnabled) {
            if (globalVolume === 0) {
                globalVolume = 0.3;
                volumeSlider.value = 0.3;
            }
            initAudio();
        } else {
            volumeSlider.value = 0;
            globalVolume = 0;
        }
    });

    // Next Round Handler
    btnNext.addEventListener('click', () => {
        if (playMode === 'money') {
            if (initialBetAmount > 0 && balance > 0) {
                // Automatically place the same bet
                let betToPlace = initialBetAmount;
                if (balance < betToPlace) {
                    betToPlace = balance; // Bet remaining balance if they don't have enough
                    initialBetAmount = betToPlace;
                    showToast(`Low balance! Bet automatically reduced to $${betToPlace}`);
                }
                
                balance -= betToPlace;
                saveBalance();
                currentBets = [betToPlace];
                playerBalanceEl.innerText = balance;
                currentBetEl.innerText = currentBets[0];
                startGame();
            } else {
                startBettingPhase();
            }
        } else {
            startGame();
        }
    });

    // Init
    window.onload = initSession;
})();
