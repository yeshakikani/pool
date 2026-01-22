import React, { useEffect, useRef, useState } from 'react';

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

  useEffect(() => {
    if (!gameMode) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const TABLE_WIDTH = 1000;
    const TABLE_HEIGHT = 500;
    const BALL_RADIUS = 14;
    const POCKET_RADIUS = 22;
    const FRICTION = 0.987;
    const CUSHION_BOUNCE = 0.75;
    
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
        
        this.x += this.vx;
        this.y += this.vy;
        
        this.vx *= FRICTION;
        this.vy *= FRICTION;
        
        if (Math.abs(this.vx) < 0.03) this.vx = 0;
        if (Math.abs(this.vy) < 0.03) this.vy = 0;
        
        const margin = 45;
        if (this.x - this.radius < margin) {
          this.x = margin + this.radius;
          this.vx *= -CUSHION_BOUNCE;
        }
        if (this.x + this.radius > TABLE_WIDTH - margin) {
          this.x = TABLE_WIDTH - margin - this.radius;
          this.vx *= -CUSHION_BOUNCE;
        }
        if (this.y - this.radius < margin) {
          this.y = margin + this.radius;
          this.vy *= -CUSHION_BOUNCE;
        }
        if (this.y + this.radius > TABLE_HEIGHT - margin) {
          this.y = TABLE_HEIGHT - margin - this.radius;
          this.vy *= -CUSHION_BOUNCE;
        }
        
        pockets.forEach(pocket => {
          const dx = this.x - pocket.x;
          const dy = this.y - pocket.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < POCKET_RADIUS - 2) {
            this.pocketed = true;
            ballPocketed = true;
            
            if (this.number === 0) {
              foul = true;
            } else if (this.number === 8) {
              handleEightBall();
            } else {
              handleBallPocketed(this.number);
            }
          }
        });
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
        messageState = `Player ${currentPlayerState} wins!`;
        setGameState(prev => ({ ...prev, winner: currentPlayerState, message: messageState }));
      } else {
        messageState = `Player ${currentPlayerState} loses! 8-ball pocketed early.`;
        setGameState(prev => ({ ...prev, winner: currentPlayerState === 1 ? 2 : 1, message: messageState }));
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
      for (let i = 0; i < 36; i++) {
        const angle = (i / 36) * Math.PI * 2;
        let score = 0;
        
        targetBalls.forEach(ball => {
          const dx = ball.x - cueBall.x;
          const dy = ball.y - cueBall.y;
          const angleToBall = Math.atan2(dy, dx);
          const angleDiff = Math.abs(angleToBall - angle);
          
          if (angleDiff < 0.3) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            score += 100 / (dist + 1);
            
            // Bonus for closer to pockets
            pockets.forEach(pocket => {
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
      const woodGradient = ctx.createLinearGradient(0, 0, 0, TABLE_HEIGHT);
      woodGradient.addColorStop(0, '#8B4513');
      woodGradient.addColorStop(0.5, '#A0522D');
      woodGradient.addColorStop(1, '#8B4513');
      ctx.fillStyle = woodGradient;
      ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
      
      ctx.fillStyle = '#0D5C3D';
      ctx.fillRect(35, 35, TABLE_WIDTH - 70, TABLE_HEIGHT - 70);
      
      ctx.fillStyle = 'rgba(13, 92, 61, 0.3)';
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * (TABLE_WIDTH - 70) + 35;
        const y = Math.random() * (TABLE_HEIGHT - 70) + 35;
        ctx.fillRect(x, y, 2, 2);
      }
      
      ctx.strokeStyle = '#654321';
      ctx.lineWidth = 10;
      ctx.strokeRect(40, 40, TABLE_WIDTH - 80, TABLE_HEIGHT - 80);
      
      ctx.strokeStyle = '#8B6914';
      ctx.lineWidth = 2;
      ctx.strokeRect(42, 42, TABLE_WIDTH - 84, TABLE_HEIGHT - 84);
      
      pockets.forEach(pocket => {
        const pocketGradient = ctx.createRadialGradient(
          pocket.x, pocket.y, 0,
          pocket.x, pocket.y, POCKET_RADIUS
        );
        pocketGradient.addColorStop(0, '#000000');
        pocketGradient.addColorStop(0.7, '#1a1a1a');
        pocketGradient.addColorStop(1, '#2a2a2a');
        
        ctx.fillStyle = pocketGradient;
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#4a3010';
        ctx.lineWidth = 4;
        ctx.stroke();
      });
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.moveTo(TABLE_WIDTH / 4, 45);
      ctx.lineTo(TABLE_WIDTH / 4, TABLE_HEIGHT - 45);
      ctx.stroke();
      ctx.setLineDash([]);
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
        ctx.lineWidth = 3;
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
      
      const meterX = 25;
      const meterY = TABLE_HEIGHT / 2 - 120;
      const meterWidth = 35;
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
      ctx.fillRect(meterX + 2, meterY + meterHeight - powerHeight, 8, powerHeight);
      
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
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
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 3;
      ctx.fillText('POWER', meterX + meterWidth / 2, meterY - 15);
      ctx.fillText(`${Math.floor(power)}%`, meterX + meterWidth / 2, meterY + meterHeight + 20);
      ctx.shadowBlur = 0;
    };
    
    const drawUI = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(TABLE_WIDTH / 2 - 220, 5, 440, 70);
      
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.strokeRect(TABLE_WIDTH / 2 - 220, 5, 440, 70);
      
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(messageState, TABLE_WIDTH / 2, 30);
      
      ctx.font = 'bold 16px Arial';
      const p1Text = `P1 ${player1TypeState ? '(' + player1TypeState + ')' : ''}: ${player1BallsState.length}/7`;
      const p2Text = gameMode === 'pvc' ? 
        `AI ${player2TypeState ? '(' + player2TypeState + ')' : ''}: ${player2BallsState.length}/7` :
        `P2 ${player2TypeState ? '(' + player2TypeState + ')' : ''}: ${player2BallsState.length}/7`;
      
      ctx.fillStyle = currentPlayerState === 1 ? '#00FF00' : '#FFFFFF';
      ctx.fillText(p1Text, TABLE_WIDTH / 2 - 110, 58);
      
      ctx.fillStyle = currentPlayerState === 2 ? '#00FF00' : '#FFFFFF';
      ctx.fillText(p2Text, TABLE_WIDTH / 2 + 110, 58);
      
      // AI thinking indicator
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
          winner: null,
          message: messageState
        });
        
        // AI turn
        if (gameMode === 'pvc' && currentPlayerState === 2 && !gameState.winner) {
          aiThinking = true;
          aiThinkTimer = 0;
        }
      }
      
      // AI thinking delay
      if (aiThinking && !ballsMoving) {
        aiThinkTimer++;
        if (aiThinkTimer > 90) {
          aiTakeShot();
        }
      }
      
      requestAnimationFrame(gameLoop);
    };
    
    const handleMouseMove = (e) => {
      if (gameMode === 'pvc' && currentPlayerState === 2) return;
      
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      
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
      }
    };
    
    const handleMouseDown = (e) => {
      if (gameMode === 'pvc' && currentPlayerState === 2) return;
      
      if (!ballsMoving && cueBall && !cueBall.pocketed) {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        
        const dx = mouseX - cueBall.x;
        const dy = mouseY - cueBall.y;
        aimAngle = Math.atan2(dy, dx);
        isDragging = true;
      }
    };
    
    const handleMouseUp = () => {
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
    };
    
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    
    initPockets();
    initBalls();
    gameLoop();
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameMode]);
if (!gameMode) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        padding: '20px'
      }}
    >
      <div style={{ maxWidth: '900px', width: '100%', textAlign: 'center' }}>

        <h1 style={{ fontSize: '48px', color: 'dark-yellow', marginBottom: '10px' }}>
          🎱 8-Ball Pool Championship
        </h1>

        <p style={{ color: '#ccc', marginBottom: '40px' }}>
          Choose your game mode to start playing!
        </p>

        {/* BUTTONS */}
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          
          <button
            onClick={() => setGameMode('pvp')}
            style={{
              width: '300px',
              padding: '30px',
              fontSize: '18px',
              cursor: 'pointer',
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
            }}
          >
            👥 Player vs Player
            <p>Player 1 vs Player 2</p>
          </button>

          <button
            onClick={() => setGameMode('pvc')}
            style={{
              width: '300px',
              padding: '30px',
              fontSize: '18px',
              cursor: 'pointer',
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
            }}
          >
            🤖 Player vs AI
            <p>You vs Computer</p>
          </button>

        </div>

        {/* HOW TO PLAY */}
        <div style={{ marginTop: '40px', color: 'black', textAlign: 'center', backgroundColor:'white' , padding: '20px', borderRadius: '10px', width:'300px', marginLeft:'auto', marginRight:'auto' }}>
          <h3>🎮 How to Play</h3>
          <ul>
            <li>Move mouse to aim</li>
            <li>Click & drag to power</li>
            <li>Release to shoot</li>
            <li>Pocket balls then 8-ball</li>
          </ul>
        </div>

      </div>
    </div>
  );
}


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="mb-4 text-center flex items-center gap-4">
        <button
          onClick={() => {
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
          }}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-all"
        >
          ← Back to Menu
        </button>
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-500">
          🎱 {gameMode === 'pvp' ? 'Player vs Player' : 'Player vs AI'}
        </h1>
      </div>
      
      <div className="bg-gradient-to-br from-amber-900 via-amber-800 to-amber-900 p-6 rounded-2xl shadow-2xl">
       
         <canvas
          ref={canvasRef}
          width={1000}
          height={500}
          className="border-8 border-amber-950 rounded-lg shadow-2xl cursor-crosshair"
        />
      
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 w-full max-w-3xl">
        <div className={`p-5 rounded-xl shadow-lg transition-all ${gameState.currentPlayer === 1 ? 'bg-gradient-to-br from-green-600 to-green-700 scale-105 border-4 border-yellow-400' : 'bg-gradient-to-br from-gray-700 to-gray-800'}`}>
          <h3 className="text-white font-bold text-xl mb-2">🎯 Player 1</h3>
          <p className="text-yellow-300 font-semibold">{gameState.player1Type ? gameState.player1Type.toUpperCase() : 'Waiting...'}</p>
          <p className="text-white text-lg">Balls: {gameState.player1Balls.length}/7</p>
        </div>
        
        <div className={`p-5 rounded-xl shadow-lg transition-all ${gameState.currentPlayer === 2 ? 'bg-gradient-to-br from-blue-600 to-blue-700 scale-105 border-4 border-yellow-400' : 'bg-gradient-to-br from-gray-700 to-gray-800'}`}>
          <h3 className="text-white font-bold text-xl mb-2">{gameMode === 'pvc' ? '🤖 AI Player' : '🎯 Player 2'}</h3>
          <p className="text-yellow-300 font-semibold">{gameState.player2Type ? gameState.player2Type.toUpperCase() : 'Waiting...'}</p>
          <p className="text-white text-lg">Balls: {gameState.player2Balls.length}/7</p>
        </div>
      </div>
      
      {gameState.winner && (
        <div className="mt-6 p-8 bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 rounded-2xl shadow-2xl animate-pulse">
          <h2 className="text-gray-900 text-3xl font-bold text-center">
            🏆 {gameState.winner === 1 ? 'Player 1' : (gameMode === 'pvc' ? 'AI' : 'Player 2')} Wins! 🏆
          </h2>
        </div>
      )}
      
      <div className="mt-6 p-6 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-xl max-w-3xl border-2 border-gray-700">
        <h3 className="text-yellow-400 font-bold text-lg mb-3">📖 Controls:</h3>
        <ul className="text-gray-300 space-y-2">
          <li className="flex items-start">
            <span className="text-green-400 mr-2">▸</span>
            <span><strong>Aim:</strong> Move mouse to rotate cue stick</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-400 mr-2">▸</span>
            <span><strong>Power:</strong> Click and pull back to charge</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-400 mr-2">▸</span>
            <span><strong>Shoot:</strong> Release to take shot</span>
          </li>
          {gameMode === 'pvc' && (
            <li className="flex items-start">
              <span className="text-purple-400 mr-2">🤖</span>
              <span>AI will automatically take its turn</span>
            </li>
          )}
        </ul>

      </div>
    </div>
  );
};

export default PoolGame;