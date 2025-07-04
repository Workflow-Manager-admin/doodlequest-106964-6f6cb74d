import React, { useState } from "react";
import "./GuessesPanel.css";

// PUBLIC_INTERFACE
export default function GuessesPanel({ guesses, onGuess, yourTurn, guessSubmitted, timeLeft }) {
  const [guessInput, setGuessInput] = useState("");

  // PUBLIC_INTERFACE
  const submitGuess = () => {
    if (guessInput.trim()) {
      onGuess(guessInput.trim());
      setGuessInput("");
    }
  };

  return (
    <div className="guesses-panel">
      <h3>Guesses</h3>
      {timeLeft > 0 && !yourTurn && !guessSubmitted && (
        <div className="guess-input-row">
          <input
            className="guess-input"
            maxLength={30}
            value={guessInput}
            onChange={e => setGuessInput(e.target.value)}
            placeholder="Guess what it is!"
            onKeyDown={e => e.key === "Enter" && submitGuess()}
            disabled={guessSubmitted}
          />
          <button
            className="guess-btn"
            onClick={submitGuess}
            disabled={guessSubmitted || !guessInput.trim()}
          >
            Submit
          </button>
        </div>
      )}
      <ol className="guesses-list">
        {guesses.map((g, idx) =>
          <li key={idx}><strong>{g.name}</strong>: {g.guess}</li>
        )}
      </ol>
      {guessSubmitted && <span className="already-guessed">You already guessed!</span>}
    </div>
  );
}
