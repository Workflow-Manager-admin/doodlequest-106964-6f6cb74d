import React, { useState } from "react";
import "./VotePanel.css";

// PUBLIC_INTERFACE
export default function VotePanel({ players, drawings, votes, myId, onVote, votingFinished }) {
  const [selected, setSelected] = useState(null);

  // PUBLIC_INTERFACE
  const handleVote = (pid) => {
    setSelected(pid);
    onVote(pid);
  };

  // Prevent self voting and only one vote per user
  return (
    <div className="vote-panel">
      <h3>{votingFinished ? "Results" : "Vote for your favorite!"}</h3>
      <div className="vote-grid">
        {players.map(p =>
          <div key={p.uid} className={`vote-card${votingFinished && votes[p.uid] ? " voted" : ""}`}>
            <img
              className="vote-doodle"
              src={drawings[p.uid]}
              alt={`Drawing by ${p.name}`}
              width={72}
              height={72}
            />
            <div className="vote-name">{p.name}{p.uid === myId ? " (You)" : ""}</div>
            {votingFinished
              ? <div className="vote-result">{votes[p.uid] || 0} votes</div>
              : (p.uid === myId
                ? <span style={{ color: "#888", fontSize: "0.85rem" }}>You can't vote for yourself</span>
                : (
                  <button
                    className={`vote-btn${selected === p.uid ? " selected" : ""}`}
                    onClick={() => handleVote(p.uid)}
                    disabled={!!votes[myId] || selected || p.uid === myId}
                  >Vote</button>
                )
              )
            }
          </div>
        )}
      </div>
      {votingFinished && (
        <div className="winner-row">
          <strong>
            🏆 Winner:&nbsp;
            {getWinner(players, votes)}
          </strong>
        </div>
      )}
    </div>
  );
}

// PUBLIC_INTERFACE
function getWinner(players, votes) {
  // Returns the display name(s) with highest vote count.
  const counts = {};
  players.forEach(p => counts[p.uid] = votes[p.uid] || 0);
  const max = Math.max(...Object.values(counts));
  const winners = players.filter(p => counts[p.uid] === max);
  if (winners.length === 1) return winners[0].name;
  if (winners.length > 1) return winners.map(w => w.name).join(" & ");
  return "No votes!";
}
