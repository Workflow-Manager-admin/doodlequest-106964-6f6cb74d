import React, { useState } from "react";
import "./SpinWheel.css";

const ANIMALS = [
  "Cat", "Dog", "Lion", "Elephant", "Owl", "Dolphin", "Giraffe",
  "Penguin", "Rabbit", "Horse", "Monkey", "Tiger", "Swan", "Bear", "Parrot"
];

// PUBLIC_INTERFACE
export default function SpinWheel({ onResult, spinning }) {
  const [currentAnimal, setCurrentAnimal] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);

  // PUBLIC_INTERFACE
  const spin = () => {
    if (isSpinning || spinning) return;
    setIsSpinning(true);
    let count = 0;
    const spinDur = 36 + Math.floor(Math.random() * 18);
    let id = setInterval(() => {
      setCurrentAnimal(ANIMALS[(count + Math.floor(Math.random() * ANIMALS.length)) % ANIMALS.length]);
      if (count++ > spinDur) {
        clearInterval(id);
        const result = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
        setCurrentAnimal(result);
        setIsSpinning(false);
        onResult(result);
      }
    }, 80);
  };

  return (
    <div className="spinwheel-container">
      <div className="spinwheel">
        <div className="animal-label">{currentAnimal || "🎡 Spin for Animal/Bird"}</div>
        <button
          className="spin-btn"
          onClick={spin}
          disabled={isSpinning || spinning}
        >
          {isSpinning ? "Spinning..." : "Spin"}
        </button>
      </div>
    </div>
  );
}
