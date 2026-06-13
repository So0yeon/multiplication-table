const SHOP_ITEMS = [
  { id: 'cube', name: '기본 큐브', type: 'cube', price: 0, emoji: null },
  { id: 'sphere', name: '알록달록 공', type: 'sphere', price: 20, emoji: '⚽' },
  { id: 'cone', name: '뾰족 지붕', type: 'cone', price: 30, emoji: null },
  { id: 'cylinder', name: '둥근 기둥', type: 'cylinder', price: 40, emoji: null },
  { id: 'tree', name: '귀여운 나무', type: 'cylinder', price: 50, emoji: '🌳' },
  { id: 'star_box', name: '별나라 상자', type: 'cube', price: 30, emoji: '⭐' },
  { id: 'toy_box', name: '장난감 상자', type: 'cube', price: 40, emoji: '🎁' },
  { id: 'kitty', name: '귀여운 고양이', type: 'cube', price: 80, emoji: '🐱' },
  { id: 'castle', name: '마법 성', type: 'cylinder', price: 120, emoji: '🏰' },
  { id: 'flower', name: '파릇한 꽃꽃이', type: 'cube', price: 25, emoji: '🌷' },
  { id: 'car', name: '빵빵 미니카', type: 'cube', price: 70, emoji: '🚗' },
  { id: 'chair', name: '의자 블록', type: 'cube', price: 35, emoji: '🪑' }
];

const PRESETS = [
  '#5ce1e6', // Cyan
  '#ff7ebb', // Pink
  '#ffde59', // Gold
  '#70e000', // Green
  '#ff5733', // Orange-red
  '#a29bfe'  // Lavender
];

class GameManager {
  constructor() {
    this.coins = 100; // start with some coins for playability
    this.unlockedItems = ['cube'];
    this.selectedItemId = 'cube';
    
    this.quiz = null;
    this.world = null;
    this.selectedColor = PRESETS[0];
  }

  init() {
    // 1. Setup Local Storage loading
    this.loadGame();

    // 2. Setup 3D World
    this.world = new BlockWorld('canvas-container', () => this.saveGame());
    this.world.setColor(this.selectedColor);
    
    const startingItem = SHOP_ITEMS.find(item => item.id === this.selectedItemId);
    this.world.setItem(startingItem);

    // Load saved blocks if any
    const savedBlocks = localStorage.getItem('gugudan_3d_blocks');
    if (savedBlocks) {
      try {
        const blocksList = JSON.parse(savedBlocks);
        this.world.loadBlocks(blocksList);
      } catch (e) {
        console.error("Error loading blocks", e);
      }
    }

    // 3. Setup Quiz Manager
    this.quiz = new MultiplicationQuiz(
      (reward, combo) => this.handleCorrectAnswer(reward, combo),
      () => this.handleWrongAnswer()
    );

    // 4. Setup HTML elements
    this.renderStats();
    this.renderShop();
    this.renderColors();
    this.nextQuestion();

    // 5. Event listener bindings
    this.bindEvents();
  }

  loadGame() {
    const savedCoins = localStorage.getItem('gugudan_coins');
    const savedUnlocked = localStorage.getItem('gugudan_unlocked');
    const savedSelected = localStorage.getItem('gugudan_selected_item');
    const savedColor = localStorage.getItem('gugudan_selected_color');

    if (savedCoins !== null) this.coins = parseInt(savedCoins);
    if (savedUnlocked !== null) this.unlockedItems = JSON.parse(savedUnlocked);
    if (savedSelected !== null) this.selectedItemId = savedSelected;
    if (savedColor !== null) this.selectedColor = savedColor;
  }

  saveGame() {
    localStorage.setItem('gugudan_coins', this.coins.toString());
    localStorage.setItem('gugudan_unlocked', JSON.stringify(this.unlockedItems));
    localStorage.setItem('gugudan_selected_item', this.selectedItemId);
    localStorage.setItem('gugudan_selected_color', this.selectedColor);
    if (this.world) {
      localStorage.setItem('gugudan_3d_blocks', JSON.stringify(this.world.getSaveData()));
    }
    this.renderStats();
  }

  renderStats() {
    const coinBadge = document.getElementById('coin-badge');
    const coinCount = document.getElementById('coin-count');
    if (coinCount) {
      coinCount.innerText = this.coins;
    }
    const blocksCount = document.getElementById('blocks-count');
    if (blocksCount && this.world) {
      blocksCount.innerText = this.world.blocks.length;
    }
  }

  renderColors() {
    const colorPicker = document.getElementById('color-picker');
    if (!colorPicker) return;
    colorPicker.innerHTML = '';

    PRESETS.forEach(color => {
      const dot = document.createElement('div');
      dot.className = `color-dot ${color === this.selectedColor ? 'active' : ''}`;
      dot.style.backgroundColor = color;
      dot.addEventListener('click', () => {
        // Toggle color
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        this.selectedColor = color;
        this.world.setColor(color);
        this.saveGame();
      });
      colorPicker.appendChild(dot);
    });
  }

  renderShop() {
    const shopGrid = document.getElementById('shop-grid');
    if (!shopGrid) return;
    shopGrid.innerHTML = '';

    SHOP_ITEMS.forEach(item => {
      const isUnlocked = this.unlockedItems.includes(item.id);
      const isSelected = item.id === this.selectedItemId;

      const card = document.createElement('div');
      card.className = `shop-item ${isUnlocked ? '' : 'locked'} ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="item-preview">${item.emoji || '🧱'}</div>
        <div class="item-name">${item.name}</div>
        <div class="item-price">
          ${isUnlocked ? '보유중' : `<i class="fas fa-coins"></i> ${item.price}`}
        </div>
      `;

      card.addEventListener('click', () => this.handleShopItemClick(item));
      shopGrid.appendChild(card);
    });
  }

  handleShopItemClick(item) {
    const isUnlocked = this.unlockedItems.includes(item.id);

    if (isUnlocked) {
      this.selectedItemId = item.id;
      this.world.setItem(item);
      this.renderShop();
      this.showToast(`${item.name} 선택 완료!`);
      // Auto switch to Build mode
      this.switchToolMode('build');
      this.saveGame();
    } else {
      // Try to buy
      if (this.coins >= item.price) {
        this.coins -= item.price;
        this.unlockedItems.push(item.id);
        this.selectedItemId = item.id;
        this.world.setItem(item);
        this.renderShop();
        this.showToast(`${item.name}을(를) 구매했습니다! 🎉`);
        this.bounceCoins();
        this.switchToolMode('build');
        this.saveGame();
        
        // Confetti burst for buying!
        if (window.confetti) {
          window.confetti({ particleCount: 60, spread: 40, origin: { y: 0.8 } });
        }
      } else {
        this.showToast('코인이 부족해요! 구구단을 풀어보세요! 💡');
      }
    }
  }

  nextQuestion() {
    const q = this.quiz.generateQuestion();
    const questionEl = document.getElementById('quiz-question');
    const optionsEl = document.getElementById('quiz-options');

    if (!questionEl || !optionsEl) return;

    questionEl.innerText = `${q.a} × ${q.b} = ?`;
    optionsEl.innerHTML = '';

    q.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerText = choice;
      btn.addEventListener('click', () => this.handleOptionClick(btn, choice));
      optionsEl.appendChild(btn);
    });
  }

  handleOptionClick(button, selectedVal) {
    // Disable other buttons during reaction
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach(b => b.setAttribute('disabled', 'true'));

    const isCorrect = this.quiz.checkAnswer(selectedVal);
    
    if (isCorrect) {
      button.classList.add('correct');
      // Confetti splash
      if (window.confetti) {
        window.confetti({
          particleCount: 50,
          spread: 60,
          origin: { x: 0.2, y: 0.4 } // Pop around the quiz card
        });
      }
    } else {
      button.classList.add('wrong');
      // Find and highlight correct answer
      buttons.forEach(b => {
        if (parseInt(b.innerText) === this.quiz.currentAnswer) {
          b.classList.add('correct');
        }
      });
    }

    setTimeout(() => {
      this.nextQuestion();
    }, 1200);
  }

  handleCorrectAnswer(reward, combo) {
    this.coins += reward;
    this.showToast(`딩동댕! +${reward} 코인 획득! 🪙`);
    this.bounceCoins();
    
    const comboEl = document.getElementById('combo-text');
    if (comboEl) {
      comboEl.innerText = combo > 1 ? `🔥 ${combo}연속 정답! 보너스 코인 지급!` : '';
    }

    this.saveGame();
  }

  handleWrongAnswer() {
    this.showToast(`틀렸어요! 정답은 ${this.quiz.currentAnswer} 입니다 😢`);
    const comboEl = document.getElementById('combo-text');
    if (comboEl) {
      comboEl.innerText = '';
    }
  }

  bounceCoins() {
    const badge = document.getElementById('coin-badge');
    if (badge) {
      badge.classList.add('bounce');
      setTimeout(() => badge.classList.remove('bounce'), 500);
    }
  }

  switchToolMode(mode) {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.mode === mode) btn.classList.add('active');
    });
    this.world.setMode(mode);
  }

  bindEvents() {
    // Mode switcher buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.switchToolMode(mode);
      });
    });

    // Save image button
    const saveImgBtn = document.getElementById('btn-save-img');
    if (saveImgBtn) {
      saveImgBtn.addEventListener('click', () => {
        this.world.saveAsImage();
        this.showToast('공간 이미지가 저장되었습니다! 📸');
      });
    }

    // Reset button
    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('꾸민 3D 블록을 모두 지우고 처음부터 다시 꾸밀까요?')) {
          this.world.clearAll();
          this.saveGame();
          this.showToast('모든 블록이 지워졌습니다.');
        }
      });
    }
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  const game = new GameManager();
  game.init();
});
