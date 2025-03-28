import React, { useState, useEffect, useRef } from "react";

const App = () => {
  const [board, setBoard] = useState(Array(9).fill(""));
  const [turn, setTurn] = useState("X");
  const [isConnected, setIsConnected] = useState(false);
  const [winner, setWinner] = useState(null);
  const [message, setMessage] = useState("Connecting to server...");
  const [gameStatus, setGameStatus] = useState("waiting");
  const [playerSymbol, setPlayerSymbol] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = new WebSocket("ws://localhost:3000");

    socketRef.current.onopen = () => {
      console.log("Connection established");
      setIsConnected(true);
      setMessage("Connected to server");
    };

    socketRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setBoard(data.board);
        setTurn(data.nextTurn);
        setWinner(data.winner);
        setMessage(data.message);
        setGameStatus(data.gameStatus);

        if (data.yourSymbol) {
          setPlayerSymbol(data.yourSymbol);
        }
      } catch (error) {
        console.error("Error:", error);
      }
    };

    socketRef.current.onerror = (error) => {
      console.error("Error:", error);
      setIsConnected(false);
      setMessage("Connection error");
    };

    socketRef.current.onclose = () => {
      console.log("Connection closed");
      setIsConnected(false);
      setMessage("Connection closed");
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const handleClick = (index) => {
    // clickable only if:
    // 2 connected
    // self's turn
    // square is empty
    // game is playing
    // is a player and not when spectator
    if (
      isConnected &&
      turn === playerSymbol &&
      !board[index] &&
      gameStatus === "playing" &&
      playerSymbol !== "spectator"
    ) {
      console.log(`Player: ${playerSymbol}, Position ${index}`);
      socketRef.current.send(
        JSON.stringify({
          action: "move",
          player: playerSymbol,
          positionToMark: index,
        })
      );
    }
  };

  const handleResetGame = () => {
    if (isConnected) {
      socketRef.current.send(
        JSON.stringify({
          action: "reset",
        })
      );
    }
  };

  const getStatusMessage = () => {
    if (!isConnected) {
      return "Disconnected ";
    }

    if (playerSymbol === "spectator") {
      return "You are a spectator";
    }

    if (gameStatus === "waiting") {
      return "Waiting for another player to join...";
    }

    if (winner) {
      return winner === playerSymbol ? "You won!" : `Player ${winner} won!`;
    }

    if (gameStatus === "finished" && !winner) {
      return "Game drawn!";
    }
    return turn === playerSymbol ? "Your turn" : `Waiting for player ${turn}`;
  };

  return (
    <div className="bg-gray-900 min-h-screen flex flex-col justify-center items-center p-6">
      <h1 className="text-4xl font-bold text-white mb-8">Tic Tac Toe</h1>

      <div className="mb-4">
        <span className="text-white text-xl mr-2">Socket Status:</span>
        <span
          className={`text-xl font-bold ${
            isConnected ? "text-green-400" : "text-red-400"
          }`}
        >
          {isConnected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="text-white text-2xl mb-4">{getStatusMessage()}</div>

      {playerSymbol && (
        <div className="text-white text-lg mb-4">
          You are:
          <span
            className={`font-bold ml-2 ${
              playerSymbol === "spectator"
                ? "text-gray-400"
                : playerSymbol === "X"
                ? "text-blue-400"
                : "text-red-400"
            }`}
          >
            {playerSymbol === "spectator"
              ? "Spectator"
              : `Player ${playerSymbol}`}
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-6">
        {board.map((square, index) => (
          <button
            key={index}
            className={`w-24 h-24 border-2 border-gray-700 text-4xl flex items-center justify-center 
              ${
                square === "X"
                  ? "text-blue-400"
                  : square === "O"
                  ? "text-red-400"
                  : "text-white"
              }
              ${
                turn === playerSymbol && !square && gameStatus === "playing"
                  ? "bg-gray-700 hover:bg-gray-600"
                  : "bg-gray-800"
              }
              focus:outline-none 
              ${
                turn === playerSymbol &&
                !square &&
                gameStatus === "playing" &&
                playerSymbol !== "spectator"
                  ? "cursor-pointer"
                  : "cursor-default"
              }`}
            onClick={() => handleClick(index)}
            disabled={
              winner !== null ||
              square !== "" ||
              gameStatus !== "playing" ||
              turn !== playerSymbol ||
              playerSymbol === "spectator"
            }
          >
            {square}
          </button>
        ))}
      </div>

      {message && message !== "continue with the game" && (
        <div className="text-white text-lg mb-4">{message}</div>
      )}

      {gameStatus === "finished" && (
        <button
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none"
          onClick={handleResetGame}
        >
          Play Again
        </button>
      )}
    </div>
  );
};

export default App;
