class MultiplicationQuiz {
  constructor(onCorrectCallback, onWrongCallback) {
    this.onCorrect = onCorrectCallback;
    this.onWrong = onWrongCallback;
    this.currentQuestion = null;
    this.currentAnswer = null;
    this.combo = 0;
  }

  // Generate a random question for primary 2nd grade (2x1 to 9x9)
  generateQuestion() {
    const a = Math.floor(Math.random() * 8) + 2; // 2 to 9
    const b = Math.floor(Math.random() * 9) + 1; // 1 to 9
    const answer = a * b;

    this.currentQuestion = { a, b };
    this.currentAnswer = answer;

    // Generate 4 unique choices
    const choices = new Set();
    choices.add(answer);

    // Keep adding choices until we have 4
    while (choices.size < 4) {
      const offset = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 5) + 1);
      const fakeAnswer = answer + offset;
      if (fakeAnswer > 0 && fakeAnswer <= 81 && fakeAnswer !== answer) {
        choices.add(fakeAnswer);
      }
    }

    return {
      a,
      b,
      choices: Array.from(choices).sort(() => Math.random() - 0.5),
      answer
    };
  }

  checkAnswer(userAnswer) {
    const isCorrect = parseInt(userAnswer) === this.currentAnswer;
    if (isCorrect) {
      this.combo++;
      // Base reward is 10 coins, + combo bonus (max 10 extra coins)
      const bonus = Math.min(Math.floor(this.combo / 3), 10);
      const reward = 10 + bonus;
      this.onCorrect(reward, this.combo);
    } else {
      this.combo = 0;
      this.onWrong();
    }
    return isCorrect;
  }
}
window.MultiplicationQuiz = MultiplicationQuiz;
