import React, { useEffect, useRef, useState } from 'react';

const BALL_COLORS = {
  0: { base: '#F8F8F8', shade: '#E0E0E0' },
  1: { base: '#FFD700', shade: '#DAA520' },
  2: { base: '#0047AB', shade: '#003380' },
  3: { base: '#DC143C', shade: '#B01030' },
  4: { base: '#9B30FF', shade: '#7B20D0' },
  5: { base: '#FF8C00', shade: '#D67300' },
  6: { base: '#228B22', shade: '#1A6B1A' },
  7: { base: '#8B0000', shade: '#6B0000' },
  8: { base: '#1C1C1C', shade: '#000000' },
  9: { base: '#FFD700', shade: '#DAA520' },
  10: { base: '#0047AB', shade: '#003380' },
  11: { base: '#DC143C', shade: '#B01030' },
  12: { base: '#9B30FF', shade: '#7B20D0' },
  13: { base: '#FF8C00', shade: '#D67300' },
  14: { base: '#228B22', shade: '#1A6B1A' },
  15: { base: '#8B0000', shade: '#6B0000' }
};

const PoolGame = () => {
  const canvasRef = useRef(null);
  const [gameMode, setGameMode] = useState(null); // null, 'pvp', 'pvc'
  const [gameState, setGameState] = useState({
    currentPlayer: 1,
    player1Balls: [],
    player2Balls: [],
    player1Type: null,
    player2Type: null,
    winner: null,
    message: 'Player 1: Break the rack!'
  });
  const [currentPower, setCurrentPower] = useState(0);

  useEffect(() => {
    if (!gameMode) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const TABLE_WIDTH = 1000;
    const TABLE_HEIGHT = 500;
    const BALL_RADIUS = 14;
    const POCKET_RADIUS = 35;
    const FRICTION = 0.988;
    const CUSHION_BOUNCE = 0.70;


    let balls = [];
    let pockets = [];
    let cueBall = null;
    let ballsMoving = false;
    let aimAngle = 0;
    let power = 0;
    let isDragging = false;
    let mouseX = 0;
    let mouseY = 0;
    let currentPlayerState = 1;
    let player1BallsState = [];
    let player2BallsState = [];
    let player1TypeState = null;
    let player2TypeState = null;
    let messageState = 'Player 1: Break the rack!';
    let shotTaken = false;
    let ballPocketed = false;
    let foul = false;
    let aiThinking = false;
    let aiThinkTimer = 0;
    let winnerState = null;

    const initPockets = () => {
      const cornerOffset = 35;
      const sideOffsetX = TABLE_WIDTH / 2;
      const sideOffsetY = 25;

      pockets = [
        { x: cornerOffset, y: cornerOffset },
        { x: sideOffsetX, y: sideOffsetY },
        { x: TABLE_WIDTH - cornerOffset, y: cornerOffset },
        { x: cornerOffset, y: TABLE_HEIGHT - cornerOffset },
        { x: sideOffsetX, y: TABLE_HEIGHT - sideOffsetY },
        { x: TABLE_WIDTH - cornerOffset, y: TABLE_HEIGHT - cornerOffset }
      ];
    };

    class Ball {
      constructor(x, y, number) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.number = number;
        this.pocketed = false;
        this.radius = BALL_RADIUS;
        this.pocketScale = 1;
      }

      update() {
        if (this.pocketed) {
          this.pocketScale *= 0.92;
          return;
        }

        // 1. Apply Movement first
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= FRICTION;
        this.vy *= FRICTION;

        if (Math.abs(this.vx) < 0.05) this.vx = 0;
        if (Math.abs(this.vy) < 0.05) this.vy = 0;

        // 2. Check for Pockets with updated position
        let isNearPocketArea = false;

        for (const pocket of pockets) {
          const dx = this.x - pocket.x;
          const dy = this.y - pocket.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // If ball hits the pocket center
          if (dist < POCKET_RADIUS) {
            this.pocketed = true;
            ballPocketed = true;

            if (this.number === 0) {
              winnerState = currentPlayerState === 1 ? 2 : 1;
              messageState = `GAME OVER! Cue ball pocketed. Player ${winnerState} wins!`;
              const snapWinner = winnerState;
              const snapMessage = messageState;
              setGameState(prev => ({ ...prev, winner: snapWinner, message: snapMessage }));
            } else if (this.number === 8) {
              handleEightBall();
            } else {
              handleBallPocketed(this.number);
            }
            return; // Stop processing this ball
          }

          // If ball is even slightly overlapping the pocket mouth visually
          if (dist < POCKET_RADIUS + 25) {
            isNearPocketArea = true;
          }
        }

        // 3. Cushion Collisions (Primary 45px bouncy margin)
        if (!isNearPocketArea) {
          const margin = 45;
          const bounce = -CUSHION_BOUNCE;

          if (this.x - this.radius < margin) {
            this.x = margin + this.radius;
            this.vx *= bounce;
          } else if (this.x + this.radius > TABLE_WIDTH - margin) {
            this.x = TABLE_WIDTH - margin - this.radius;
            this.vx *= bounce;
          }

          if (this.y - this.radius < margin) {
            this.y = margin + this.radius;
            this.vy *= bounce;
          } else if (this.y + this.radius > TABLE_HEIGHT - margin) {
            this.y = TABLE_HEIGHT - margin - this.radius;
            this.vy *= bounce;
          }
        } else {
          // 4. Hard Safety Boundary (35px cloth edge)
          // Even near pockets, balls should NEVER cross the cloth edge onto wood rails
          const hardMargin = 32;
          if (this.x - this.radius < hardMargin) { this.x = hardMargin + this.radius; this.vx *= -0.2; }
          if (this.x + this.radius > TABLE_WIDTH - hardMargin) { this.x = TABLE_WIDTH - hardMargin - this.radius; this.vx *= -0.2; }
          if (this.y - this.radius < hardMargin) { this.y = hardMargin + this.radius; this.vy *= -0.2; }
          if (this.y + this.radius > TABLE_HEIGHT - hardMargin) { this.y = TABLE_HEIGHT - hardMargin - this.radius; this.vy *= -0.2; }
        }
      }

      draw(ctx) {
        if (this.pocketed && this.pocketScale < 0.1) return;

        const scale = this.pocketed ? this.pocketScale : 1;
        const r = this.radius * scale;

        ctx.save();
        ctx.globalAlpha = 0.4 * scale;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(this.x + 4, this.y + 4, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const gradient = ctx.createRadialGradient(
          this.x - r * 0.3, this.y - r * 0.3, r * 0.1,
          this.x, this.y, r
        );

        const colors = BALL_COLORS[this.number];
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(0.3, colors.base);
        gradient.addColorStop(1, colors.shade);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fill();

        if (this.number > 8 && this.number !== 0) {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(this.x, this.y, r * 0.65, 0, Math.PI * 2);
          ctx.fill();
        }

        if (this.number !== 0) {
          ctx.fillStyle = (this.number > 8 || this.number === 8) ? '#000000' : '#FFFFFF';
          ctx.font = `bold ${Math.floor(r * 0.8)}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(this.number, this.x, this.y);
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(this.x - r * 0.35, this.y - r * 0.35, r * 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const handleBallPocketed = (ballNum) => {
      const isStripe = ballNum > 8;

      if (currentPlayerState === 1) {
        if (player1TypeState === null) {
          player1TypeState = isStripe ? 'stripe' : 'solid';
          player2TypeState = isStripe ? 'solid' : 'stripe';
        }
        if ((player1TypeState === 'stripe' && isStripe) || (player1TypeState === 'solid' && !isStripe)) {
          player1BallsState.push(ballNum);
        } else {
          player2BallsState.push(ballNum);
        }
      } else {
        if (player2TypeState === null) {
          player2TypeState = isStripe ? 'stripe' : 'solid';
          player1TypeState = isStripe ? 'solid' : 'stripe';
        }
        if ((player2TypeState === 'stripe' && isStripe) || (player2TypeState === 'solid' && !isStripe)) {
          player2BallsState.push(ballNum);
        } else {
          player1BallsState.push(ballNum);
        }
      }
    };

    const handleEightBall = () => {
      const currentBalls = currentPlayerState === 1 ? player1BallsState : player2BallsState;
      const requiredBalls = 7;

      if (currentBalls.length === requiredBalls) {
        winnerState = currentPlayerState;
        messageState = `GAME OVER! 8-Ball pocketed! Player ${winnerState} wins!`;
        setGameState(prev => ({ ...prev, winner: winnerState, message: messageState }));
      } else {
        winnerState = currentPlayerState === 1 ? 2 : 1;
        messageState = `GAME OVER! 8-Ball pocketed early. Player ${winnerState} wins!`;
        setGameState(prev => ({ ...prev, winner: winnerState, message: messageState }));
      }
    };

    const initBalls = () => {
      balls = [];

      cueBall = new Ball(TABLE_WIDTH / 4, TABLE_HEIGHT / 2, 0);
      balls.push(cueBall);

      const startX = TABLE_WIDTH * 0.72;
      const startY = TABLE_HEIGHT / 2;
      const spacing = BALL_RADIUS * 2 + 1;

      const rackOrder = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
      let ballIndex = 0;

      for (let row = 0; row < 5; row++) {
        for (let col = 0; col <= row; col++) {
          const x = startX + row * spacing * 0.866;
          const y = startY + (col - row / 2) * spacing;
          balls.push(new Ball(x, y, rackOrder[ballIndex++]));
        }
      }
    };

    const checkBallCollisions = () => {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const b1 = balls[i];
          const b2 = balls[j];

          if (b1.pocketed || b2.pocketed) continue;

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < b1.radius + b2.radius) {
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            const vx1 = b1.vx * cos + b1.vy * sin;
            const vy1 = b1.vy * cos - b1.vx * sin;
            const vx2 = b2.vx * cos + b2.vy * sin;
            const vy2 = b2.vy * cos - b2.vx * sin;

            const vx1Final = vx2;
            const vx2Final = vx1;

            b1.vx = vx1Final * cos - vy1 * sin;
            b1.vy = vy1 * cos + vx1Final * sin;
            b2.vx = vx2Final * cos - vy2 * sin;
            b2.vy = vy2 * cos + vx2Final * sin;

            const overlap = (b1.radius + b2.radius - dist) / 2;
            b1.x -= overlap * cos;
            b1.y -= overlap * sin;
            b2.x += overlap * cos;
            b2.y += overlap * sin;
          }
        }
      }
    };

    // AI Player Logic
    const aiTakeShot = () => {
      if (!cueBall || cueBall.pocketed) return;

      let bestAngle = 0;
      let bestScore = -1;
      const myType = player2TypeState;

      // Find target balls
      const targetBalls = balls.filter(b => {
        if (b.pocketed || b.number === 0) return false;
        if (!myType) return b.number !== 8;
        if (myType === 'solid') return b.number > 0 && b.number < 8;
        return b.number > 8;
      });

      // If no target balls, aim for 8-ball
      if (targetBalls.length === 0) {
        const eightBall = balls.find(b => b.number === 8 && !b.pocketed);
        if (eightBall) targetBalls.push(eightBall);
      }

      // Try different angles
      const currentCueBall = cueBall;
      const currentPockets = pockets;
      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2;
        let score = 0;

        targetBalls.forEach(ball => {
          const dx = ball.x - currentCueBall.x;
          const dy = ball.y - currentCueBall.y;
          const angleToBall = Math.atan2(dy, dx);
          const angleDiff = Math.abs(angleToBall - angle);

          if (angleDiff < 0.3) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            score += 100 / (dist + 1);

            // Bonus for closer to pockets
            currentPockets.forEach(pocket => {
              const pdx = ball.x - pocket.x;
              const pdy = ball.y - pocket.y;
              const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
              score += 50 / (pdist + 1);
            });
          }
        });

        if (score > bestScore) {
          bestScore = score;
          bestAngle = angle;
        }
      }

      aimAngle = bestAngle;
      const aiPower = 40 + Math.random() * 30;
      const speed = aiPower / 4;

      cueBall.vx = Math.cos(aimAngle) * speed;
      cueBall.vy = Math.sin(aimAngle) * speed;
      ballsMoving = true;
      shotTaken = true;
      aiThinking = false;
    };

    const drawTable = () => {
      // Main wood rail
      const railGradient = ctx.createLinearGradient(0, 0, 0, TABLE_HEIGHT);
      railGradient.addColorStop(0, '#5D2E1A');
      railGradient.addColorStop(0.5, '#7B3F24');
      railGradient.addColorStop(1, '#5D2E1A');
      ctx.fillStyle = railGradient;
      ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      // Blue Table Cloth
      ctx.fillStyle = '#21618C'; // Deep blue cloth
      ctx.fillRect(35, 35, TABLE_WIDTH - 70, TABLE_HEIGHT - 70);

      // Subtle texture for cloth
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * (TABLE_WIDTH - 70) + 35;
        const y = Math.random() * (TABLE_HEIGHT - 70) + 35;
        ctx.fillRect(x, y, 1, 1);
      }

      // Inner Rail Shadow
      ctx.strokeStyle = '#3E1F11';
      ctx.lineWidth = 14;
      ctx.strokeRect(42, 42, TABLE_WIDTH - 84, TABLE_HEIGHT - 84);

      // Rail markings (Dots)
      ctx.fillStyle = '#ECF0F1';
      for (let i = 1; i < 4; i++) {
        // Top dots
        ctx.beginPath(); ctx.arc(TABLE_WIDTH / 4 * i, 18, 3, 0, Math.PI * 2); ctx.fill();
        // Bottom dots
        ctx.beginPath(); ctx.arc(TABLE_WIDTH / 4 * i, TABLE_HEIGHT - 18, 3, 0, Math.PI * 2); ctx.fill();
      }

      pockets.forEach(pocket => {
        const pocketGradient = ctx.createRadialGradient(
          pocket.x, pocket.y, 0,
          pocket.x, pocket.y, POCKET_RADIUS
        );
        pocketGradient.addColorStop(0, '#000000');
        pocketGradient.addColorStop(0.8, '#1a1a1a');
        pocketGradient.addColorStop(1, '#333333');

        ctx.fillStyle = pocketGradient;
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#4a3010';
        ctx.lineWidth = 3;
        ctx.stroke();
      });

      // Baulk line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(TABLE_WIDTH / 4, 45);
      ctx.lineTo(TABLE_WIDTH / 4, TABLE_HEIGHT - 45);
      ctx.stroke();
    };

    const drawCue = () => {
      if (ballsMoving || !cueBall || cueBall.pocketed) return;
      if (gameMode === 'pvc' && currentPlayerState === 2) return;

      const cueLength = 350;
      const cueDistance = 50 + power * 1.5;

      const tipX = cueBall.x - Math.cos(aimAngle) * cueDistance;
      const tipY = cueBall.y - Math.sin(aimAngle) * cueDistance;
      const endX = tipX - Math.cos(aimAngle) * cueLength;
      const endY = tipY - Math.sin(aimAngle) * cueLength;

      ctx.save();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(endX + 3, endY + 3);
      ctx.lineTo(tipX + 3, tipY + 3);
      ctx.stroke();

      const cueGradient = ctx.createLinearGradient(endX, endY, tipX, tipY);
      cueGradient.addColorStop(0, '#8B4513');
      cueGradient.addColorStop(0.3, '#A0522D');
      cueGradient.addColorStop(0.7, '#D2691E');
      cueGradient.addColorStop(0.85, '#F5DEB3');
      cueGradient.addColorStop(1, '#FFFFFF');

      ctx.strokeStyle = cueGradient;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const offset = (i - 2) * 2;
        ctx.beginPath();
        ctx.moveTo(endX + offset, endY + offset);
        ctx.lineTo(tipX + offset, tipY + offset);
        ctx.stroke();
      }

      ctx.fillStyle = '#4169E1';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      if (power === 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 8]);
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 5;

        ctx.beginPath();
        ctx.moveTo(cueBall.x, cueBall.y);

        let lineEndX = cueBall.x;
        let lineEndY = cueBall.y;
        let hitBall = null;

        for (let i = 1; i < balls.length; i++) {
          const ball = balls[i];
          if (ball.pocketed) continue;

          const dx = ball.x - cueBall.x;
          const dy = ball.y - cueBall.y;
          const angle = Math.atan2(dy, dx);
          const angleDiff = Math.abs(angle - aimAngle);

          if (angleDiff < 0.2) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 300) {
              hitBall = ball;
              lineEndX = ball.x - Math.cos(aimAngle) * (BALL_RADIUS * 2);
              lineEndY = ball.y - Math.sin(aimAngle) * (BALL_RADIUS * 2);
              break;
            }
          }
        }

        if (!hitBall) {
          lineEndX = cueBall.x + Math.cos(aimAngle) * 250;
          lineEndY = cueBall.y + Math.sin(aimAngle) * 250;
        }

        ctx.lineTo(lineEndX, lineEndY);
        ctx.stroke();

        if (hitBall) {
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(hitBall.x, hitBall.y);
          ctx.lineTo(hitBall.x + Math.cos(aimAngle) * 150, hitBall.y + Math.sin(aimAngle) * 150);
          ctx.stroke();
        }

        ctx.restore();
      }
    };

    const drawPowerMeter = () => {
      if (ballsMoving || !cueBall || cueBall.pocketed) return;
      if (gameMode === 'pvc' && currentPlayerState === 2) return;

      const meterX = 10;
      const meterY = TABLE_HEIGHT / 2 - 120;
      const meterWidth = 12;
      const meterHeight = 240;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(meterX - 2, meterY - 2, meterWidth + 4, meterHeight + 4);

      ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
      ctx.fillRect(meterX, meterY, meterWidth, meterHeight);

      const powerHeight = (power / 100) * meterHeight;
      const gradient = ctx.createLinearGradient(meterX, meterY + meterHeight, meterX, meterY);
      gradient.addColorStop(0, '#00FF00');
      gradient.addColorStop(0.4, '#FFFF00');
      gradient.addColorStop(0.7, '#FFA500');
      gradient.addColorStop(1, '#FF0000');

      ctx.fillStyle = gradient;
      ctx.fillRect(meterX, meterY + meterHeight - powerHeight, meterWidth, powerHeight);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(meterX + 2, meterY + meterHeight - powerHeight, 3, powerHeight);

      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const y = meterY + (meterHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(meterX, y);
        ctx.lineTo(meterX + meterWidth, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 3;
      ctx.fillText('POWER', meterX + meterWidth / 2, meterY - 10);
      ctx.fillText(`${Math.floor(power)}%`, meterX + meterWidth / 2, meterY + meterHeight + 15);
      ctx.shadowBlur = 0;
    };

    const drawUI = () => {
      // Message box and scores are now handled in React for better positioning

      // AI thinking indicator remains on canvas as it's a temporary game state overlay
      if (aiThinking) {
        ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
        ctx.fillRect(TABLE_WIDTH / 2 - 100, TABLE_HEIGHT / 2 - 30, 200, 60);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.strokeRect(TABLE_WIDTH / 2 - 100, TABLE_HEIGHT / 2 - 30, 200, 60);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('AI Thinking...', TABLE_WIDTH / 2, TABLE_HEIGHT / 2);
      }
    };

    const gameLoop = () => {
      ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      drawTable();

      balls.forEach(ball => ball.update());
      checkBallCollisions();
      balls.forEach(ball => ball.draw(ctx));

      drawCue();
      drawPowerMeter();
      drawUI();

      ballsMoving = balls.some(ball => !ball.pocketed && (Math.abs(ball.vx) > 0.01 || Math.abs(ball.vy) > 0.01));

      if (!ballsMoving && shotTaken) {
        shotTaken = false;

        if (foul || !ballPocketed) {
          currentPlayerState = currentPlayerState === 1 ? 2 : 1;
          messageState = foul ? `Foul! Player ${currentPlayerState}'s turn` :
            (gameMode === 'pvc' && currentPlayerState === 2 ? "AI's turn" : `Player ${currentPlayerState}'s turn`);
        } else {
          messageState = gameMode === 'pvc' && currentPlayerState === 2 ?
            'Good shot! AI continues' : `Good shot! Player ${currentPlayerState} continues`;
        }

        foul = false;
        ballPocketed = false;

        setGameState({
          currentPlayer: currentPlayerState,
          player1Balls: [...player1BallsState],
          player2Balls: [...player2BallsState],
          player1Type: player1TypeState,
          player2Type: player2TypeState,
          winner: winnerState,
          message: messageState
        });

        // AI turn
        if (gameMode === 'pvc' && currentPlayerState === 2 && !winnerState) {
          aiThinking = true;
          aiThinkTimer = 0;
        }
      }

      // AI thinking delay
      if (aiThinking && !ballsMoving && !winnerState) {
        aiThinkTimer++;
        if (aiThinkTimer > 90) {
          aiTakeShot();
        }
      }

      requestAnimationFrame(gameLoop);
    };

    const getPointerPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      let clientX, clientY;
      if (e.touches && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const handleMove = (e) => {
      if (gameMode === 'pvc' && currentPlayerState === 2) return;
      if (e.type === 'touchmove') e.preventDefault();

      const pos = getPointerPos(e);
      mouseX = pos.x;
      mouseY = pos.y;

      if (!ballsMoving && cueBall && !cueBall.pocketed && !isDragging) {
        const dx = mouseX - cueBall.x;
        const dy = mouseY - cueBall.y;
        aimAngle = Math.atan2(dy, dx);
      }

      if (isDragging) {
        const dx = mouseX - cueBall.x;
        const dy = mouseY - cueBall.y;
        const angleToMouse = Math.atan2(dy, dx);
        const angleDiff = angleToMouse - aimAngle;

        const distAlongLine = Math.cos(angleDiff) * Math.sqrt(dx * dx + dy * dy);
        power = Math.min(100, Math.max(0, (150 - distAlongLine) / 1.5));
        setCurrentPower(power);
      }
    };

    const handleDown = (e) => {
      if (gameMode === 'pvc' && currentPlayerState === 2) return;

      const pos = getPointerPos(e);
      mouseX = pos.x;
      mouseY = pos.y;

      if (!ballsMoving && cueBall && !cueBall.pocketed) {
        const dx = mouseX - cueBall.x;
        const dy = mouseY - cueBall.y;
        aimAngle = Math.atan2(dy, dx);
        isDragging = true;
      }
    };

    const handleUp = () => {
      if (gameMode === 'pvc' && currentPlayerState === 2) return;

      if (isDragging && power > 5 && !ballsMoving && cueBall && !cueBall.pocketed) {
        const speed = power / 4;
        cueBall.vx = Math.cos(aimAngle) * speed;
        cueBall.vy = Math.sin(aimAngle) * speed;
        ballsMoving = true;
        shotTaken = true;
      }
      isDragging = false;
      power = 0;
      setCurrentPower(0);
    };

    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mousedown', handleDown);
    canvas.addEventListener('mouseup', handleUp);
    canvas.addEventListener('touchstart', handleDown, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleUp, { passive: false });

    initPockets();
    initBalls();
    gameLoop();

    return () => {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mousedown', handleDown);
      canvas.removeEventListener('mouseup', handleUp);
      canvas.removeEventListener('touchstart', handleDown);
      canvas.removeEventListener('touchmove', handleMove);
      canvas.removeEventListener('touchend', handleUp);
    };
  }, [gameMode]);
  if (!gameMode) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">

        {/* PREMIUM CSS BACKGROUND IMAGE EFFECT */}
        {/* CUSTOM NEON BACKGROUND IMAGE */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/background.png')",
            filter: 'brightness(0.4) contrast(1.1)'
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1a]/80 via-transparent to-[#0a0f1a]/90 z-0"></div>

        <div className="relative z-10 w-full max-w-4xl text-center space-y-12">

          <div className="space-y-4 animate-in slide-in-from-top duration-700">
            <div className="flex items-center justify-center gap-4 mb-2">
              <div className="w-16 h-1 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
              <span className="text-yellow-500 text-3xl">🎱</span>
              <div className="w-16 h-1 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
            </div>
            <h1 className="text-7xl font-black text-white tracking-tighter uppercase italic leading-none drop-shadow-2xl">
              POOL <span className="text-yellow-500">PRO</span>
            </h1>
            <p className="text-gray-400 text-lg font-bold tracking-[0.3em] uppercase opacity-70">Championship Series</p>
          </div>

          {/* MODE CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl mx-auto">

            <button
              onClick={() => setGameMode('pvp')}
              className="group relative bg-white/5 hover:bg-white/10 border border-white/10 rounded-[30px] p-10 transition-all duration-500 hover:scale-105 active:scale-95 shadow-2xl backdrop-blur-md overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="text-8xl">👥</span>
              </div>
              <div className="relative z-10 text-left">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl mb-6 group-hover:bg-yellow-500 transition-colors duration-300">👥</div>
                <h3 className="text-white text-3xl font-black mb-2">PVP MODE</h3>
                <p className="text-gray-400 font-medium">Challenge a friend on the same device.</p>
                <div className="mt-8 flex items-center gap-2 text-yellow-500 font-bold text-sm tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                  START GAME <span className="group-hover:translate-x-2 transition-transform">→</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => setGameMode('pvc')}
              className="group relative bg-white/5 hover:bg-white/10 border border-white/10 rounded-[30px] p-10 transition-all duration-500 hover:scale-105 active:scale-95 shadow-2xl backdrop-blur-md overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="text-8xl">🤖</span>
              </div>
              <div className="relative z-10 text-left">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl mb-6 group-hover:bg-yellow-500 transition-colors duration-300">🤖</div>
                <h3 className="text-white text-3xl font-black mb-2">PVC MODE</h3>
                <p className="text-gray-400 font-medium">Test your skills against the AI agent.</p>
                <div className="mt-8 flex items-center gap-2 text-yellow-500 font-bold text-sm tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                  START GAME <span className="group-hover:translate-x-2 transition-transform">→</span>
                </div>
              </div>
            </button>

          </div>

          {/* HELP CARD */}
          <div className="max-w-md mx-auto bg-black/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm animate-in fade-in duration-1000 slide-in-from-bottom-5">
            <h4 className="text-gray-400 font-black text-xs uppercase tracking-widest mb-4 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> How to Play
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs font-bold uppercase tracking-tight text-white/60">
              <div className="bg-white/5 p-2 rounded">🖱️ Move Mouse to Aim</div>
              <div className="bg-white/5 p-2 rounded">🖱️ Drag & Pull to Power</div>
              <div className="bg-white/5 p-2 rounded">✨ Release to Shoot</div>
              <div className="bg-white/5 p-2 rounded">🏆 Pocket all vs 8-Ball</div>
            </div>
          </div>

        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-[#070b14] p-0 font-sans select-none overflow-x-hidden text-white relative">

      {/* PROFESSIONAL BACKGROUND EFFECT */}
      {/* CUSTOM NEON BACKGROUND IMAGE */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-60"
        style={{
          backgroundImage: "url('/background.png')",
          filter: 'brightness(0.5)'
        }}
      ></div>
      <div className="absolute inset-0 bg-[#070b14]/40 z-0 pointer-events-none"></div>

      {/* PROFESSIONAL TOP BAR (Menu & Status) */}
      <div className="w-full bg-[#1e293b] border-b border-white/10 py-2 sm:py-3 px-4 sm:px-8 flex items-center justify-between shadow-lg z-30 shrink-0">
        <button
          onClick={() => setGameMode(null)}
          className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 font-bold px-3 sm:px-6 py-1 rounded-lg transition-all text-xs sm:text-base"
        >
          MENU
        </button>

        <div className="bg-black/40 px-3 sm:px-8 py-1 rounded-full border border-yellow-500/30 mx-2">
          <p className="text-yellow-400 font-black text-[10px] sm:text-sm uppercase tracking-[0.1em] sm:tracking-[0.2em] animate-pulse truncate max-w-[120px] sm:max-w-none">
            {gameState.message}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-bold text-gray-400">
          <span className="hidden xs:inline">POWER: {Math.floor(currentPower)}%</span>
          <div className="w-16 sm:w-24 h-1.5 sm:h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500 transition-all duration-100" style={{ width: `${currentPower}%` }}></div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row w-full items-center lg:items-center justify-center lg:justify-between px-4 sm:px-10 py-4 lg:py-0 gap-4 lg:gap-8 relative z-20">

        {/* PLAYER 1 INFO */}
        <div className="flex flex-row lg:flex-col items-center w-full lg:w-32 space-y-0 lg:space-y-6 space-x-4 lg:space-x-0 bg-white/5 lg:bg-transparent p-3 lg:p-0 rounded-2xl lg:rounded-none">
          <div className={`p-1 sm:p-1.5 rounded-[1rem] lg:rounded-[2rem] transition-all duration-300 ${gameState.currentPlayer === 1 ? 'bg-[#56e33e] shadow-[0_0_20px_rgba(86,227,62,0.4)] scale-105 lg:scale-110' : 'bg-gray-700/30 opacity-60'}`}>
            <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-24 lg:h-24 bg-[#1e293b] rounded-[0.8rem] lg:rounded-[1.8rem] flex items-center justify-center text-2xl sm:text-3xl lg:text-5xl overflow-hidden border border-black/20 shadow-inner">
              👤
            </div>
          </div>
          <div className="flex flex-col items-start lg:items-center flex-1 lg:flex-none">
            <p className={`font-black uppercase tracking-tight text-xs sm:text-sm lg:text-base ${gameState.currentPlayer === 1 ? 'text-[#56e33e]' : 'text-gray-500'}`}>Player 1</p>
            <div className="flex flex-row lg:flex-col gap-1.5 sm:gap-2 mt-2">
              {[...Array(7)].map((_, i) => {
                const ball = gameState.player1Balls[i];
                return (
                  <div key={i} className="w-6 h-6 sm:w-8 sm:h-8 lg:w-14 lg:h-14 rounded-full bg-[#131b2b] border lg:border-2 border-[#263347] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-hidden">
                    {ball && (
                      <div
                        className="w-5 h-5 sm:w-7 sm:h-7 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] lg:text-sm font-black shadow-2xl animate-in zoom-in-75 duration-500 relative"
                        style={{
                          backgroundColor: BALL_COLORS[ball].base,
                          background: `radial-gradient(circle at 35% 35%, ${BALL_COLORS[ball].base}, ${BALL_COLORS[ball].shade})`
                        }}
                      >
                        <div className="bg-white/90 w-3 h-3 sm:w-4 sm:h-4 lg:w-7 lg:h-7 rounded-full flex items-center justify-center text-black text-[6px] sm:text-[8px] lg:text-[10px] border border-black/10">
                          {ball}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CENTER TABLE AREA */}
        <div className="w-full max-w-[1000px] flex flex-col items-center justify-center py-2 lg:py-4">
          <div className="relative w-full p-0.5 sm:p-1 bg-amber-950/20 rounded-[20px] sm:rounded-[40px] lg:rounded-[50px] shadow-2xl border border-white/5 backdrop-blur-sm">
            <canvas
              ref={canvasRef}
              width={1000}
              height={500}
              className="w-full h-auto rounded-[18px] sm:rounded-[38px] lg:rounded-[48px] shadow-[0_20px_40px_-10px_rgba(0,0,0,1)] cursor-crosshair border-[6px] sm:border-[10px] lg:border-[12px] border-[#3E1F11] touch-none"
            />
            <div className="absolute -bottom-8 lg:-bottom-16 left-10 lg:left-20 right-10 lg:right-20 h-10 lg:h-20 bg-black/50 blur-[40px] lg:blur-[80px] rounded-full z-[-1]"></div>
          </div>
        </div>

        {/* PLAYER 2 INFO */}
        <div className="flex flex-row-reverse lg:flex-col items-center w-full lg:w-32 space-y-0 lg:space-y-6 space-x-reverse lg:space-x-0 bg-white/5 lg:bg-transparent p-3 lg:p-0 rounded-2xl lg:rounded-none">
          <div className={`p-1 sm:p-1.5 rounded-[1rem] lg:rounded-[2rem] transition-all duration-300 ${gameState.currentPlayer === 2 ? 'bg-[#56e33e] shadow-[0_0_20px_rgba(86,227,62,0.4)] scale-105 lg:scale-110' : 'bg-gray-700/30 opacity-60'}`}>
            <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-24 lg:h-24 bg-[#1e293b] rounded-[0.8rem] lg:rounded-[1.8rem] flex items-center justify-center text-2xl sm:text-3xl lg:text-5xl overflow-hidden border border-black/20 shadow-inner">
              {gameMode === 'pvc' ? '🤖' : '👤'}
            </div>
          </div>
          <div className="flex flex-col items-end lg:items-center flex-1 lg:flex-none">
            <p className={`font-black uppercase tracking-tight text-xs sm:text-sm lg:text-base ${gameState.currentPlayer === 2 ? 'text-[#56e33e]' : 'text-gray-500'}`}>
              {gameMode === 'pvc' ? 'AI Player' : 'Player 2'}
            </p>
            <div className="flex flex-row-reverse lg:flex-col gap-1.5 sm:gap-2 mt-2">
              {[...Array(7)].map((_, i) => {
                const ball = gameState.player2Balls[i];
                return (
                  <div key={i} className="w-6 h-6 sm:w-8 sm:h-8 lg:w-14 lg:h-14 rounded-full bg-[#131b2b] border lg:border-2 border-[#263347] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-hidden">
                    {ball && (
                      <div
                        className="w-5 h-5 sm:w-7 sm:h-7 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] lg:text-sm font-black shadow-2xl animate-in zoom-in-75 duration-500 relative"
                        style={{
                          backgroundColor: BALL_COLORS[ball].base,
                          background: `radial-gradient(circle at 35% 35%, ${BALL_COLORS[ball].base}, ${BALL_COLORS[ball].shade})`
                        }}
                      >
                        <div className="bg-white/90 w-3 h-3 sm:w-4 sm:h-4 lg:w-7 lg:h-7 rounded-full flex items-center justify-center text-black text-[6px] sm:text-[8px] lg:text-[10px] border border-black/10">
                          {ball}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* PREMIUM GAME OVER POPUP */}
      {gameState.winner && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[200] animate-in fade-in duration-700">
          <div className="max-w-md w-full bg-slate-900 border-[4px] border-yellow-500 rounded-[60px] p-16 text-center shadow-[0_0_150px_rgba(234,179,8,0.3)] transform animate-in zoom-in duration-500">
            <div className="text-9xl mb-8 drop-shadow-2xl">🏆</div>
            <h2 className="text-white text-6xl font-black mb-2 tracking-tighter italic uppercase leading-none">GAME OVER</h2>
            <div className="h-1.5 w-32 bg-yellow-500 mx-auto my-6 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.8)]"></div>

            <p className="text-white text-3xl font-black mb-10 tracking-tight uppercase">
              {gameState.winner === 1 ? 'PLAYER 1' : (gameMode === 'pvc' ? 'AI PLAYER' : 'PLAYER 2')} WINS!
            </p>

            <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 mb-12 shadow-inner">
              <p className="text-yellow-400 font-bold text-lg italic uppercase tracking-widest leading-relaxed">
                " {gameState.message} "
              </p>
            </div>

            <div className="flex flex-col gap-5">
              <button
                onClick={() => {
                  const current = gameMode;
                  setGameMode(null);
                  setGameState({
                    currentPlayer: 1,
                    player1Balls: [],
                    player2Balls: [],
                    player1Type: null,
                    player2Type: null,
                    winner: null,
                    message: 'Player 1: Break the rack!'
                  });
                  setTimeout(() => setGameMode(current), 50);
                }}
                className="bg-yellow-500 hover:bg-yellow-400 text-black text-3xl font-black py-6 rounded-full shadow-[0_8px_0_rgb(161,98,7)] transition-all hover:-translate-y-1 active:translate-y-1 active:shadow-none"
              >
                PLAY AGAIN
              </button>
              <button
                onClick={() => setGameMode(null)}
                className="text-white/30 hover:text-white font-bold transition-all text-xs uppercase tracking-[0.3em] pt-4"
              >
                Exit to

              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoolGame;
