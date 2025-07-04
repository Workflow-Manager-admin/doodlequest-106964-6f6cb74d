import React, { useState } from "react";
import "./App.css";
import { auth, googleProvider, db } from "./firebase";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp
} from "firebase/firestore";

import SpinWheel from "./components/SpinWheel";
import DoodleCanvas from "./components/DoodleCanvas";
import GuessesPanel from "./components/GuessesPanel";
import VotePanel from "./components/VotePanel";

// PUBLIC_INTERFACE
function useFirebaseAuth() {
  const [user, setUser] = useState(null);
  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);
  return user;
}

function randomRoomCode() {
  // 5 char alpha string
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// PUBLIC_INTERFACE
const GamePhases = {
  LOBBY: "lobby",
  SPIN: "spin",
  DRAW: "draw",
  GUESS: "guess",
  VOTE: "vote",
  RESULTS: "results"
};

const DRAW_SECONDS = 30;

function App() {
  // Theme management for playful style
  const [theme, setTheme] = useState("light");
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme(t => (t === "light" ? "dark" : "light"));

  // Auth
  const user = useFirebaseAuth();
  const [displayName, setDisplayName] = useState("");
  const [room, setRoom] = useState("");
  const [phase, setPhase] = useState(GamePhases.LOBBY);
  const [players, setPlayers] = useState([]);
  const [myUid, setMyUid] = useState(null);
  const [loading, setLoading] = useState(true);

  // Game state
  const [word, setWord] = useState("");
  const [drawings, setDrawings] = useState({}); // {uid: url}
  const [guesses, setGuesses] = useState([]); // [{name, guess}]
  const [votes, setVotes] = useState({}); // {uid: voteCount}
  const [timer, setTimer] = useState(DRAW_SECONDS);
  const [drawComplete, setDrawComplete] = useState(false);
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const [roundInfo, setRoundInfo] = useState({});
  const [votingFinished, setVotingFinished] = useState(false);
  const [myVote, setMyVote] = useState(null);
  const [yourDrawingUrl, setYourDrawingUrl] = useState(null);

  // Utils
  const isRoomOwner = players.length > 0 && players[0].uid === myUid;

  // Firestore room/game subscription
  React.useEffect(() => {
    if (!room) return setLoading(false);
    const unsub = onSnapshot(doc(db, "rooms", room), (snap) => {
      if (!snap.exists()) return setLoading(false);
      const d = snap.data();
      setPlayers(d.players || []);
      setPhase(d.phase || GamePhases.LOBBY);
      setWord(d.word || "");
      setDrawings(d.drawings || {});
      setGuesses(d.guesses || []);
      setVotes(d.votes || {});
      setRoundInfo(d.roundInfo || {});
      setYourDrawingUrl(d.drawings ? d.drawings[myUid] : null);
      setVotingFinished(d.phase === GamePhases.RESULTS || (d.votes && Object.values(d.votes).length >= players.length - 1));
      setLoading(false);
    });
    return () => unsub();
    // eslint-disable-next-line
  }, [room, myUid]);

  React.useEffect(() => {
    if (!user) return;
    setMyUid(user.uid);
  }, [user]);

  // --- Timer logic ---
  React.useEffect(() => {
    let interval;
    if (phase === GamePhases.DRAW && timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    if (timer === 0 && phase === GamePhases.DRAW) {
      handleDrawingEnd();
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [phase, timer]);

  // ----- Auth UI -----
  const login = async () => {
    await signInWithPopup(auth, googleProvider);
  };
  const logout = async () => {
    await signOut(auth);
    setRoom("");
  };

  // ----- Room joining/creation -----
  const createRoom = async () => {
    if (!user || !displayName) return;
    const code = randomRoomCode();
    const playersArr = [{ name: displayName, uid: user.uid }];
    await setDoc(doc(db, "rooms", code), {
      players: playersArr,
      phase: GamePhases.LOBBY,
      created: serverTimestamp()
    });
    setRoom(code);
  };
  const joinRoom = async (code) => {
    setLoading(true);
    const ref = doc(db, "rooms", code.trim().toUpperCase());
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      if ((d.players || []).some(p => p.uid === user.uid)) {
        setRoom(code.trim().toUpperCase());
        setLoading(false);
        return;
      }
      await updateDoc(ref, {
        players: [...d.players, { name: displayName, uid: user.uid }]
      });
      setRoom(code.trim().toUpperCase());
    } else {
      alert("Room not found!");
      setLoading(false);
    }
  };

  // ----- LOBBY controls -----
  const startGame = async () => {
    await updateDoc(doc(db, "rooms", room), { phase: GamePhases.SPIN }); // move to spin
  };

  // --- Spin phase: assign word
  const onSpinResult = async (anim) => {
    await updateDoc(doc(db, "rooms", room), {
      word: anim,
      phase: GamePhases.DRAW,
      drawings: {},
      guesses: [],
      votes: {},
      roundInfo: {
        startTime: Date.now()
      }
    });
    setTimer(DRAW_SECONDS);
    setDrawComplete(false);
  };

  // --- Drawing controls ---
  const handleDrawingEnd = async (imgUrl) => {
    if (imgUrl) setYourDrawingUrl(imgUrl);
    if (!yourDrawingUrl && !imgUrl) return;
    await updateDoc(doc(db, "rooms", room), {
      [`drawings.${myUid}`]: imgUrl || yourDrawingUrl
    });
    setDrawComplete(true);
    // If all players done drawing, go to guessing phase
    let d = (await getDoc(doc(db, "rooms", room))).data();
    if (Object.keys(d.drawings || {}).length >= d.players.length) {
      await updateDoc(doc(db, "rooms", room), { phase: GamePhases.GUESS });
    }
  };

  // --- Guessing controls ---
  const handleSubmitGuess = async (guess) => {
    await updateDoc(doc(db, "rooms", room), {
      guesses: [...guesses, { name: players.find(p => p.uid === myUid).name, guess }]
    });
    setGuessSubmitted(true);
    // If all guesses submitted, move to voting
    let d = (await getDoc(doc(db, "rooms", room))).data();
    if ((d.guesses || []).length >= d.players.length - 1) {
      await updateDoc(doc(db, "rooms", room), { phase: GamePhases.VOTE });
    }
  };

  // --- Voting controls ---
  const handleVote = async (targetUid) => {
    if (targetUid === myUid) return;
    await updateDoc(doc(db, "rooms", room), {
      [`votes.${targetUid}`]: (votes[targetUid] || 0) + 1,
      [`votes.${myUid}`]: "VOTED"
    });
    setMyVote(targetUid);
  };

  // --- Render/UI Logic ---
  const renderLobby = () => (
    <div className="panel">
      <h1 className="title" style={{ color: "var(--primary)" }}>Doodle Finder 🎨</h1>
      <p className="subtitle" style={{ color: "var(--secondary)" }}>Real-time drawing & guessing game</p>
      {!user ? (
        <div className="login-box">
          <button className="spin-btn" onClick={login}>Sign in with Google</button>
        </div>
      ) : (
        <div>
          <div className="user-header">
            <span>Hello, <b>{user.displayName}</b>!</span>
            <button
              style={{ marginLeft: 12, fontSize: "1em", padding: "0.2em 0.9em" }}
              className="clear-btn"
              onClick={logout}
            >Sign out</button>
          </div>
          {!room ? (
            <div className="lobby-join">
              <input
                style={{ marginBottom: 8, fontSize: "1em", borderRadius: 8, border: "1.5px solid #e4b3b3", padding: 8, width: "68%" }}
                placeholder="Enter display name"
                maxLength={18}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
              <div style={{ margin: "12px 0" }}>
                <button className="spin-btn" onClick={createRoom} disabled={!displayName || loading}>Create Room</button>
              </div>
              <div style={{ marginTop: 8 }}>
                <input
                  style={{ padding: 7, fontSize: "0.95em", borderRadius: 7, border: "1.5px solid #e4b3b3", width: 104, marginRight: 9 }}
                  placeholder="Room code"
                  maxLength={5}
                  value={room}
                  onChange={e => setRoom(e.target.value.toUpperCase())}
                />
                <button className="spin-btn" onClick={() => joinRoom(room)} disabled={!room || loading}>Join</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ margin: "7px 0" }}>
                <strong>Room: <code>{room}</code></strong>
                <button style={{marginLeft: 9}} className="clear-btn" onClick={()=>setRoom("")}>Leave</button>
              </div>
              <div>Players: {players.map(p => <span key={p.uid} style={{ margin: "0 3px" }}>{p.name}</span>)}</div>
              {isRoomOwner && (
                <div style={{ marginTop: 16 }}>
                  <button className="spin-btn" onClick={startGame}>Start Game</button>
                </div>
              )}
              {!isRoomOwner && (
                <div style={{ marginTop: 14, color: "#aaa" }}>
                  Waiting for host to start the game...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderSpin = () => (
    <div className="panel">
      <h2>Spin for your drawing subject!</h2>
      <SpinWheel onResult={onSpinResult} spinning={phase !== GamePhases.SPIN} />
    </div>
  );

  const renderCanvas = () => (
    <div className="panel">
      <h2>Draw: <span style={{ color: "var(--primary)" }}>{word}</span></h2>
      <div style={{ marginBottom: 9, fontWeight: 600, fontSize: "1.12em" }}>Time left: <strong>{timer}s</strong></div>
      <DoodleCanvas
        drawingEnabled={!drawComplete && phase === GamePhases.DRAW}
        onDrawEnd={imgUrl => handleDrawingEnd(imgUrl)}
        yourTurn={true}
      />
      <div style={{ marginTop: 15, color: "#888" }}>
        Finish before time or <button className="clear-btn" style={{ fontSize: "1em" }} onClick={() => handleDrawingEnd(yourDrawingUrl)}>End Turn</button>
      </div>
    </div>
  );

  const renderWaiting = () => (
    <div className="panel">
      <h2>Waiting for others to finish...</h2>
      <div style={{ margin: "21px 0" }}>
        <div>Players finished drawing: {Object.keys(drawings).length}/{players.length}</div>
        <div style={{ marginTop: 10 }}>
          {players.map(p => (
            <span key={p.uid}
              style={{
                background: drawings[p.uid] ? "#f5a3af" : "#ddd",
                color: drawings[p.uid] ? "#fff" : "#720303",
                borderRadius: 7,
                padding: "2.5px 8px",
                marginRight: 6
              }}
            >{p.name}</span>
          ))}
        </div>
      </div>
    </div>
  );

  const renderGuess = () => (
    <div className="panel">
      <h2>Guess what it is!</h2>
      <div style={{ marginBottom: 8 }}>You cannot see your own doodle.</div>
      {players.filter(p => p.uid !== myUid).map(p => (
        <div className="guess-doodle" key={p.uid} style={{marginBottom: 10}}>
          <DoodleCanvas
            drawingEnabled={false}
            imageUrl={drawings[p.uid]}
            yourTurn={false}
          />
          <div style={{ fontWeight: 600, marginTop: 4 }}>{p.name}'s drawing</div>
        </div>
      ))}
      <GuessesPanel
        guesses={guesses}
        onGuess={handleSubmitGuess}
        yourTurn={false}
        guessSubmitted={guessSubmitted}
        timeLeft={timer}
      />
    </div>
  );

  const renderVote = () => (
    <div className="panel">
      <h2 style={{ color: "var(--secondary)" }}>Vote for the best drawing!</h2>
      <VotePanel
        players={players}
        drawings={drawings}
        votes={votes}
        myId={myUid}
        onVote={handleVote}
        votingFinished={votingFinished}
      />
    </div>
  );

  const renderResults = () => (
    <div className="panel" style={{paddingBottom: 30}}>
      <h2>Round Results</h2>
      <VotePanel
        players={players}
        drawings={drawings}
        votes={votes}
        myId={myUid}
        onVote={()=>{}}
        votingFinished={true}
      />
      <div style={{ marginTop: 12 }}>
        <button className="spin-btn" onClick={()=>window.location.reload()}>Play Again</button>
      </div>
    </div>
  );

  // -- MAIN UI --
  return (
    <div className="App">
      <header className="App-header" style={{paddingTop: 34, minHeight: "90vh"}}>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>
        <div style={{
          maxWidth: 420,
          minWidth: 260,
          margin: "auto",
          marginTop: "14px",
          background: "var(--accent, #fcfcfc)",
          borderRadius: 20,
          boxShadow: "0 4px 16px rgba(245,163,175,0.09)",
          padding: 12,
          alignSelf: "center"
        }}>
          {loading ? <div>Loading...</div>
            : phase === GamePhases.LOBBY ? renderLobby()
            : phase === GamePhases.SPIN ? renderSpin()
            : phase === GamePhases.DRAW ? (drawComplete ? renderWaiting() : renderCanvas())
            : phase === GamePhases.GUESS ? renderGuess()
            : phase === GamePhases.VOTE ? renderVote()
            : phase === GamePhases.RESULTS ? renderResults()
            : <div>...?</div>
          }
        </div>
        <footer style={{ fontSize: "0.93em", color: "#bbb", marginTop: 11 }}>
          Doodle Finder &copy; 2024 | A light & playful multiplayer game | <a href="https://firebase.google.com" target="_blank" rel="noopener noreferrer">Firebase</a>-powered
        </footer>
      </header>
    </div>
  );
}

// PUBLIC_INTERFACE
export default App;
