import { WebSocketServer } from "ws";
import http from "http";

const httpServer = http.createServer((req, res) => {
  res.end("Server running1234");
});
const ws = new WebSocketServer({ server: httpServer });

let board = Array(9).fill("");
let counter = 0;
let currentPlayer = "X";
let winner = null;

let players = {
  X: null,
  O: null,
};
let gameStatus = "waiting"; // "playing finished"
const winningPatterns = [
  // horizontal
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // vertical
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  //diagonal
  [0, 4, 8],
  [2, 4, 6],
];

const checkGameStatus = () => {
  for (let i = 0; i < winningPatterns.length; i++) {
    const [a, b, c] = winningPatterns[i];

    if (board[a] === board[b] && board[b] === board[c] && board[a] !== "") {
      winner = board[a];
      gameStatus = "finished";
      return {
        board,
        nextTurn: null,
        winner,
        message: `Game is completed, ${winner} wins!`,
        gameStatus,
      };
    }
  }

  if (counter === 9) {
    gameStatus = "finished";
    return {
      board,
      nextTurn: null,
      winner: null,
      message: "Game is drawn, no winners",
      gameStatus,
    };
  }

  return {
    board,
    nextTurn: currentPlayer,
    winner: null,
    message: "continue with the game",
    gameStatus,
  };
};

const markOnBoard = (symbol, positionToMark) => {
  if (gameStatus === "finished" || counter === 9) {
    return {
      board,
      nextTurn: null,
      winner: winner || null,
      message: winner
        ? `Game is completed, ${winner} wins!`
        : "Game is drawn, no winners",
      gameStatus,
    };
  }

  if (positionToMark < 0 || positionToMark > 8 || board[positionToMark]) {
    return {
      board,
      nextTurn: currentPlayer,
      winner: null,
      message: "Invalid Move",
      gameStatus,
    };
  }

  board[positionToMark] = symbol;
  counter++;
  currentPlayer = currentPlayer === "X" ? "O" : "X";
  return checkGameStatus();
};

const handleMove = (symbol, positionToMark, socket) => {
  if (gameStatus !== "playing") {
    return {
      board,
      nextTurn: currentPlayer,
      winner: null,
      message: "Game is not in progress",
      gameStatus,
    };
  }

  if (symbol !== currentPlayer) {
    return {
      board,
      nextTurn: currentPlayer,
      winner: null,
      message: "Not your turn",
      gameStatus,
    };
  }

  if (players[symbol] !== socket) {
    return {
      board,
      nextTurn: currentPlayer,
      winner: null,
      message: "Unauthorized move",
      gameStatus,
    };
  }
  return markOnBoard(symbol, positionToMark);
};

const resetGame = () => {
  board = Array(9).fill("");
  counter = 0;
  currentPlayer = "X";
  winner = null;
  gameStatus = players.X && players.O ? "playing" : "waiting";

  return {
    board,
    nextTurn: currentPlayer,
    winner: null,
    message: gameStatus === "playing" ? "Game started" : "Waiting for players",
    gameStatus,
  };
};

const broadcast = (data) => {
  if (players.X && players.X.readyState === 1) {
    players.X.send(
      JSON.stringify({
        ...data,
        yourSymbol: "X",
      })
    );
  }

  if (players.O && players.O.readyState === 1) {
    players.O.send(
      JSON.stringify({
        ...data,
        yourSymbol: "O",
      })
    );
  }

  ws.clients.forEach((client) => {
    if (
      client !== players.X &&
      client !== players.O &&
      client.readyState === 1
    ) {
      console.log(client);
      client.send(
        JSON.stringify({
          ...data,
          yourSymbol: "spectator",
        })
      );
    }
  });
};

let connections = new Set();
ws.on("connection", (socket, request) => {
  connections.add(socket);
  console.log("Connection established, total connections:", connections.size);
  let assignedSymbol = "spectator";

  if (!players.X) {
    players.X = socket;
    assignedSymbol = "X";
  } else if (!players.O) {
    players.O = socket;
    assignedSymbol = "O";
    if (gameStatus === "waiting" && players.X) {
      gameStatus = "playing";
    }
  } else {
    console.log("Spectator joined");
  }
  if (players.X && players.O && gameStatus === "waiting") {
    gameStatus = "playing";
  }
  socket.send(
    JSON.stringify({
      board,
      nextTurn: currentPlayer,
      winner,
      message:
        gameStatus === "playing" ? "Game in progress" : "Waiting for players",
      gameStatus,
      yourSymbol: assignedSymbol,
    })
  );

  if (gameStatus === "playing" && players.X && players.O) {
    broadcast({
      board,
      nextTurn: currentPlayer,
      winner,
      message: "Game started! X goes first",
      gameStatus,
    });
  }

  socket.on("message", (data) => {
    try {
      const parsedData = JSON.parse(data);
      console.log("Received:", parsedData);
      if (parsedData.action === "reset") {
        const newState = resetGame();
        broadcast(newState);
        return;
      }

      if (parsedData.action === "move") {
        const result = handleMove(
          parsedData.player,
          parsedData.positionToMark,
          socket
        );
        console.log("Game result:", result);
        broadcast(result);
        return;
      }
    } catch (error) {
      console.error("Error processing message:", error);
      socket.send(
        JSON.stringify({
          error: "Invalid message format",
          board,
          nextTurn: currentPlayer,
          winner,
          message: "Error occurred",
          gameStatus,
        })
      );
    }
  });

  socket.on("close", () => {
    console.log("Connection closed");
    connections.delete(socket);

    if (players.X === socket) {
      console.log("Player X disconnected. You won");
      players.X = null;

      broadcast({
        board,
        nextTurn: null,
        winner: null,
        message: "Player X disconnected. You won",
        gameStatus: "finished",
      });

      gameStatus = "finished";
    } else if (players.O === socket) {
      console.log("Player O disconnected. You won");
      players.O = null;

      broadcast({
        board: Array(9).fill(""),
        nextTurn: null,
        winner: null,
        message: "Player O disconnected. You won",
        gameStatus: "finished",
      });
      gameStatus = "finished";
    }
  });

  socket.on("error", (err) => {
    console.log("Error: ", err);
    connections.delete(socket);
  });
});

const port = 3000;
httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
