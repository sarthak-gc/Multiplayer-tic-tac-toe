import { WebSocketServer } from "ws";
import http from "http";

const httpServer = http.createServer((req, res) => {
  res.end("Server running");
});
const ws = new WebSocketServer({ server: httpServer });

let board = Array(9).fill("");
let counter = 0;

let currentPlayer = "X";
let winner = null;
const winningPatterns = [
  // horizontal
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],

  // vertical
  [0, 3, 6],
  [0, 4, 8],
  [1, 4, 7],

  //diagonal
  [2, 5, 8],
  [2, 4, 6],
];
const checkGameStatus = () => {
  for (let i = 0; i < winningPatterns.length; i++) {
    const [a, b, c] = winningPatterns[i];

    if (board[a] === board[b] && board[b] === board[c] && board[a] !== "") {
      winner = board[a];
      return { winner };
    }
  }

  if (counter === 9) {
    return "Draw";
  }
  return "Continue";
};

const markOnBoard = (symbol, positionToMark) => {
  if (position < 0 || position > 8 || board[position]) {
    return "Invalid Move";
  }

  board[positionToMark] = symbol;
  counter++;
  return checkGameStatus();
};

const handleMove = (symbol, positionToMark) => {
  let result = markOnBoard(symbol, positionToMark);
  if (result === "Continue") {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    return { nextTurn: currentPlayer, winner: "none" };
  } else if (result === "Draw") {
    return { nextTurn: "none", winner: "none" };
  } else if (result === "Invalid Move") {
    return {
      nextTurn: currentPlayer,
      winner: "none",
      message: "Invalid move. Try again!",
    };
  } else {
    return { nextTurn: "none", winner: result.winner };
  }
};
ws.on("connection", (socket, request) => {
  console.log("Connection established");
  const sendResponse = (nextTurn, winner, message) => {
    socket.send(
      JSON.stringify({
        nextTurn,
        winner,
        message,
      })
    );
  };

  socket.on("message", (data) => {
    data = JSON.parse(data);
    let result = handleMove(data.player, data.positionToMark);

    if (result === "Invalid Move") {
      sendResponse(data.player, "none", "Invalid move. Try again!");
      return;
    }

    const { winner } = result === "Draw" ? { winner: "none" } : result;

    if (result === "Draw") {
      sendResponse("none", "none", "Game Is Draw");
    } else {
      const nextPlayer = data.player === "X" ? "O" : "X";
      sendResponse(nextPlayer, winner, `Player ${data.player} won The game`);
    }
  });

  socket.on("close", () => {
    console.log("Connection closed");
  });

  socket.on("error", (err) => {
    console.log("Error: ", err);
  });
});

const port = 3000;
httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
