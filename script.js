// ---- 随机一言 ----
const quotes = [
  "Talk is cheap. Show me the code. — Linus Torvalds",
  "Stay hungry, stay foolish. — Steve Jobs",
  "The only way to do great work is to love what you do. — Steve Jobs",
  "Simplicity is the ultimate sophistication. — Leonardo da Vinci",
  "Any fool can write code that a computer can understand. Good programmers write code that humans can understand. — Martin Fowler",
  "First, solve the problem. Then, write the code. — John Johnson",
  "Make it work, make it right, make it fast. — Kent Beck",
  "Programs must be written for people to read, and only incidentally for machines to execute. — Harold Abelson",
  "Simplicity is prerequisite for reliability. — Edsger Dijkstra",
  "The purpose of computing is insight, not numbers. — Richard Hamming",
  "God does not play dice. — Albert Einstein",
  "I think, therefore I am. — René Descartes",
  "The unexamined life is not worth living. — Socrates",
  "Knowledge is power. — Francis Bacon"
];
(function() {
  const el = document.getElementById('heroQuote');
  if (el) {
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    el.textContent = q;
  }
})();
