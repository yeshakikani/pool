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
    pocketedBalls: [],
    player1Type: null,
    player2Type: null,
    winner: null,
    message: 'Player 1: Break the rack!'
  });
  const [currentPower, setCurrentPower] = useState(0);
  const [turnTimeLeft, setTurnTimeLeft] = useState(30);
  const [timerActive, setTimerActive] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const forceSkipTurnRef = useRef(false);

  // Turner Timer Effect
  useEffect(() => {
    let interval;
    if (timerActive && turnTimeLeft > 0) {
      interval = setInterval(() => {
        setTurnTimeLeft(prev => {
          if (prev <= 1) {
            forceSkipTurnRef.current = true;
            return 0;
          }
          return prev - 1;
        });
      }, 3000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive, turnTimeLeft]);

  // Orientation Check Effect
  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth;
      const smallScreen = window.innerWidth < 1024;
      setIsPortrait(portrait && smallScreen);
      // Mobile landscape: landscape + small phone screen (height < 500px)
      const mobileLandscape = !portrait && window.innerHeight < 500 && window.innerWidth < 1024;
      setIsMobileLandscape(mobileLandscape);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  useEffect(() => {
    if (!gameMode) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let isMounted = true;

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
    let turnTimerExpired = false;
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
    let pocketedBallsState = [];
    let aiThinking = false;
    let aiThinkTimer = 0;
    let aiPhase = 'aim'; // 'aim' | 'pullback' | 'fire'
    let aiPullback = 0;   // 0-100, current pullback amount
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
              // Cue ball pocketed = scratch/foul, NOT game over
              foul = true;
              // Respawn cue ball after a short delay
              setTimeout(() => {
                this.pocketed = false;
                this.pocketScale = 1;
                this.x = TABLE_WIDTH / 4;
                this.y = TABLE_HEIGHT / 2;
                this.vx = 0;
                this.vy = 0;
              }, 500);
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

        if (this.number !== 0) {
          // 1. WHITE DISK FOR NUMBER (Provides maximum contrast for all balls)
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(this.x, this.y, r * 0.55, 0, Math.PI * 2);
          ctx.fill();

          // 2. SHARP BLACK NUMBER
          ctx.fillStyle = '#000000';
          ctx.font = `bold ${Math.floor(r * 0.85)}px Arial`;
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

      // Track this ball as pocketed for scoreboard highlight
      if (!pocketedBallsState.includes(ballNum)) {
        pocketedBallsState.push(ballNum);
      }

      if (currentPlayerState === 1) {
        if (player1TypeState === null) {
          player1TypeState = isStripe ? 'stripe' : 'solid';
          player2TypeState = isStripe ? 'solid' : 'stripe';
        }
        if ((player1TypeState === 'stripe' && isStripe) || (player1TypeState === 'solid' && !isStripe)) {
          player1BallsState.push(ballNum);
        } else {
          player2BallsState.push(ballNum);
          foul = true; // Pocketed opponent's ball — turn switches
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
          foul = true; // Pocketed opponent's ball — turn switches
        }
      }
    };

    const handleEightBall = () => {
      const currentBalls = currentPlayerState === 1 ? player1BallsState : player2BallsState;
      const requiredBalls = 7;

      if (currentBalls.length === requiredBalls) {
        winnerState = currentPlayerState;
        messageState = `GAME OVER! 8-Ball pocketed! Player ${winnerState} wins!`;
      } else {
        winnerState = currentPlayerState === 1 ? 2 : 1;
        messageState = `GAME OVER! 8-Ball pocketed early. Player ${winnerState} wins!`;
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
    const aiComputeAngle = () => {
      if (!cueBall || cueBall.pocketed) return 0;

      let bestAngle = 0;
      let bestScore = -1;
      const myType = player2TypeState;

      const targetBalls = balls.filter(b => {
        if (b.pocketed || b.number === 0) return false;
        if (!myType) return b.number !== 8;
        if (myType === 'solid') return b.number > 0 && b.number < 8;
        return b.number > 8;
      });

      if (targetBalls.length === 0) {
        const eightBall = balls.find(b => b.number === 8 && !b.pocketed);
        if (eightBall) targetBalls.push(eightBall);
      }

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
      return bestAngle;
    };

    const aiTakeShot = () => {
      if (!cueBall || cueBall.pocketed) return;

      const aiPower = 40 + Math.random() * 30;
      const speed = aiPower / 4;

      cueBall.vx = Math.cos(aimAngle) * speed;
      cueBall.vy = Math.sin(aimAngle) * speed;
      ballsMoving = true;
      shotTaken = true;
      aiThinking = false;
      aiPhase = 'aim';
      aiPullback = 0;
    };

    const drawTable = () => {
      const railWidth = 35;

      // 1. CHARCOAL SLATE RAILS (High contrast against blue background)
      const railGradient = ctx.createLinearGradient(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
      railGradient.addColorStop(0, '#1e1e1e');
      railGradient.addColorStop(0.5, '#2d2d2d');
      railGradient.addColorStop(1, '#1e1e1e');
      ctx.fillStyle = railGradient;
      ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

      // Subtle Metallic Sheen on rails
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(2, 2, TABLE_WIDTH - 4, TABLE_HEIGHT - 4);

      // 2. LUXURY EMERALD CLOTH (Contrast with background)
      const clothGradient = ctx.createRadialGradient(
        TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 0,
        TABLE_WIDTH / 2, TABLE_HEIGHT / 2, TABLE_WIDTH / 2
      );
      clothGradient.addColorStop(0, '#10b981'); // Vibrant Emerald Center
      clothGradient.addColorStop(1, '#064e3b'); // Deep Forest Edge
      ctx.fillStyle = clothGradient;
      ctx.fillRect(railWidth, railWidth, TABLE_WIDTH - railWidth * 2, TABLE_HEIGHT - railWidth * 2);

      // 3. MINimalist SILVER DOTS
      ctx.fillStyle = '#e2e8f0';
      for (let i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.arc(TABLE_WIDTH / 4 * i, railWidth / 2, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(TABLE_WIDTH / 4 * i, TABLE_HEIGHT - railWidth / 2, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      // 4. POCKETS (Deep Shadow)
      pockets.forEach(pocket => {
        const pocketGradient = ctx.createRadialGradient(pocket.x, pocket.y, 0, pocket.x, pocket.y, POCKET_RADIUS);
        pocketGradient.addColorStop(0, '#000000');
        pocketGradient.addColorStop(1, '#0f172a');
        ctx.fillStyle = pocketGradient;
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // Polished Rim
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
      });

      // No Baulk line as requested
    };

    const drawCue = () => {
      if (ballsMoving || !cueBall || cueBall.pocketed) return;
      if (gameMode === 'pvc' && currentPlayerState === 2 && !aiThinking) return;

      const cueLength = 360;
      const effectivePower = (gameMode === 'pvc' && currentPlayerState === 2) ? aiPullback : power;
      const cueDistance = 45 + effectivePower * 1.5;

      const tipX = cueBall.x - Math.cos(aimAngle) * cueDistance;
      const tipY = cueBall.y - Math.sin(aimAngle) * cueDistance;
      const endX = tipX - Math.cos(aimAngle) * cueLength;
      const endY = tipY - Math.sin(aimAngle) * cueLength;

      ctx.save();

      // CUE BODY (Polished Modern look)
      const cueGradient = ctx.createLinearGradient(endX, endY, tipX, tipY);
      cueGradient.addColorStop(0, '#0f172a');
      cueGradient.addColorStop(0.4, '#1e293b');
      cueGradient.addColorStop(0.8, '#f8fafc'); // White shaft
      cueGradient.addColorStop(1, '#3b82f6');   // Blue Tip

      ctx.strokeStyle = cueGradient;
      ctx.lineWidth = 10;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.restore();

      // Show aim line
      const isAiAiming = gameMode === 'pvc' && currentPlayerState === 2 && aiThinking && aiPhase === 'aim';
      const isHumanTurn = (currentPlayerState === 1) || (gameMode === 'pvp' && currentPlayerState === 2);
      if (power === 0 && (isHumanTurn || isAiAiming)) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 5]);

        const rayDx = Math.cos(aimAngle);
        const rayDy = Math.sin(aimAngle);

        let hitBall = null;
        let hitDist = Infinity;
        const collisionRadius = BALL_RADIUS * 2;

        for (let i = 1; i < balls.length; i++) {
          const ball = balls[i];
          if (ball.pocketed) continue;
          const ocx = ball.x - cueBall.x;
          const ocy = ball.y - cueBall.y;
          const projLen = ocx * rayDx + ocy * rayDy;
          if (projLen < 0) continue;
          const perpX = ocx - projLen * rayDx;
          const perpY = ocy - projLen * rayDy;
          const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
          if (perpDist < collisionRadius) {
            const halfChord = Math.sqrt(collisionRadius * collisionRadius - perpDist * perpDist);
            const hitT = projLen - halfChord;
            if (hitT > 0 && hitT < hitDist) {
              hitDist = hitT;
              hitBall = ball;
            }
          }
        }

        let lineEndX, lineEndY;
        if (hitBall) {
          lineEndX = cueBall.x + rayDx * hitDist;
          lineEndY = cueBall.y + rayDy * hitDist;
        } else {
          lineEndX = cueBall.x + rayDx * 300;
          lineEndY = cueBall.y + rayDy * 300;
        }

        // Draw the main aim line
        ctx.beginPath();
        ctx.moveTo(cueBall.x, cueBall.y);
        ctx.lineTo(lineEndX, lineEndY);
        ctx.stroke();

        if (hitBall) {
          // 1. GHOST BALL (Where the cue ball will be at impact)
          ctx.setLineDash([]); // Solid line for ghost ball
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(lineEndX, lineEndY, BALL_RADIUS, 0, Math.PI * 2);
          ctx.stroke();

          // 2. TARGET BALL PATH (Trajectory of the ball being hit)
          const targetPathDx = hitBall.x - lineEndX;
          const targetPathDy = hitBall.y - lineEndY;
          const targetPathLen = Math.sqrt(targetPathDx * targetPathDx + targetPathDy * targetPathDy);
          const targetUnitX = targetPathDx / targetPathLen;
          const targetUnitY = targetPathDy / targetPathLen;

          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.beginPath();
          ctx.moveTo(hitBall.x, hitBall.y);
          ctx.lineTo(hitBall.x + targetUnitX * 120, hitBall.y + targetUnitY * 120);
          ctx.stroke();

          // 3. CUE BALL DEFLECTION (90 degrees to the target path)
          // The cue ball deflects along the tangent line
          const deflectionX = -targetUnitY;
          const deflectionY = targetUnitX;

          // Determine which side to deflect based on the original ray direction
          const dotProduct = rayDx * deflectionX + rayDy * deflectionY;
          const side = dotProduct > 0 ? 1 : -1;

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.moveTo(lineEndX, lineEndY);
          ctx.lineTo(lineEndX + deflectionX * side * 80, lineEndY + deflectionY * side * 80);
          ctx.stroke();
        }

        ctx.restore();
      }
    };

    const drawPowerMeter = () => {
      if (ballsMoving || !cueBall || cueBall.pocketed) return;
      // Show for player when they drag, OR for AI during pullback phase
      const isAiPullingBack = gameMode === 'pvc' && currentPlayerState === 2 && aiThinking && aiPhase === 'pullback';
      if (gameMode === 'pvc' && currentPlayerState === 2 && !isAiPullingBack) return;

      const meterX = 10;
      const meterY = TABLE_HEIGHT / 2 - 120;
      const meterWidth = 12;
      const meterHeight = 240;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(meterX - 2, meterY - 2, meterWidth + 4, meterHeight + 4);

      ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
      ctx.fillRect(meterX, meterY, meterWidth, meterHeight);

      // Use aiPullback when it's AI's turn, otherwise player's power
      const displayPower = (gameMode === 'pvc' && currentPlayerState === 2) ? aiPullback : power;
      const powerHeight = (displayPower / 100) * meterHeight;
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
      ctx.fillText((gameMode === 'pvc' && currentPlayerState === 2) ? 'AI PWR' : 'POWER', meterX + meterWidth / 2, meterY - 10);
      ctx.fillText(`${Math.floor(displayPower)}%`, meterX + meterWidth / 2, meterY + meterHeight + 15);
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

      // Handle timer expiry from React state via ref
      if (forceSkipTurnRef.current) {
        forceSkipTurnRef.current = false;
        turnTimerExpired = true;
      }

      if ((!ballsMoving && shotTaken) || (!ballsMoving && !shotTaken && turnTimerExpired)) {
        const isTimerSkip = !shotTaken && turnTimerExpired;
        turnTimerExpired = false;
        shotTaken = false;

        if (isTimerSkip || foul || !ballPocketed) {
          currentPlayerState = currentPlayerState === 1 ? 2 : 1;
          if (isTimerSkip) {
            messageState = `Time's up! Player ${currentPlayerState}'s turn`;
          } else {
            messageState = foul ? `Foul! Player ${currentPlayerState}'s turn` :
              (gameMode === 'pvc' && currentPlayerState === 2 ? "AI's turn" : `Player ${currentPlayerState}'s turn`);
          }
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
          pocketedBalls: [...pocketedBallsState],
          player1Type: player1TypeState,
          player2Type: player2TypeState,
          winner: winnerState,
          message: messageState
        });

        // Reset timer for next player (only if not AI)
        const isAiTurn = gameMode === 'pvc' && currentPlayerState === 2;
        if (!winnerState && !isAiTurn) {
          setTimerActive(true);
          setTurnTimeLeft(30);
        } else {
          setTimerActive(false);
          setTurnTimeLeft(30);
        }

        // AI turn
        if (gameMode === 'pvc' && currentPlayerState === 2 && !winnerState) {
          aiThinking = true;
          aiThinkTimer = 0;
        }
      }

      // AI thinking / cue animation sequence
      if (aiThinking && !ballsMoving && !winnerState) {
        aiThinkTimer++;

        if (aiPhase === 'aim') {
          // Phase 1 (0-40 frames): compute angle once, show cue aiming at target
          if (aiThinkTimer === 1) {
            aimAngle = aiComputeAngle();
          }
          if (aiThinkTimer > 40) {
            aiPhase = 'pullback';
          }
        } else if (aiPhase === 'pullback') {
          // Phase 2 (40-100 frames): animate cue pulling back
          aiPullback = Math.min(100, aiPullback + 2.5);
          if (aiPullback >= 100) {
            aiPhase = 'fire';
          }
        } else if (aiPhase === 'fire') {
          // Phase 3: fire!
          aiTakeShot();
        }
      }

      if (isMounted) {
        animationFrameId = requestAnimationFrame(gameLoop);
      }
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

    // Touch aim: tracks the starting touch position for angle, then drag for power
    let touchAimX = 0;
    let touchAimY = 0;
    let touchStarted = false;

    const handleMove = (e) => {
      if (gameMode === 'pvc' && currentPlayerState === 2) return;
      if (e.type === 'touchmove') e.preventDefault();

      const pos = getPointerPos(e);
      mouseX = pos.x;
      mouseY = pos.y;

      const isTouch = e.touches !== undefined;

      if (!ballsMoving && cueBall && !cueBall.pocketed) {
        if (isTouch) {
          // For touch: always update aimAngle until dragging starts
          // Once isDragging, aim is locked and we compute power from pullback
          if (!isDragging) {
            // Aim phase: finger moves around — update aim direction from cue ball to finger
            const dx = mouseX - cueBall.x;
            const dy = mouseY - cueBall.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 5) {
              aimAngle = Math.atan2(dy, dx);
            }
          } else {
            // Drag/power phase: finger moved far enough from initial touch — compute pullback
            const dx = mouseX - cueBall.x;
            const dy = mouseY - cueBall.y;
            // Dot product with OPPOSITE of aimAngle → how far behind the ball the finger is
            const pullBack = -(dx * Math.cos(aimAngle) + dy * Math.sin(aimAngle));
            power = Math.min(100, Math.max(0, pullBack / 1.5));
            setCurrentPower(power);
          }
        } else {
          // Mouse: freely update aim angle on hover
          if (!isDragging) {
            const dx = mouseX - cueBall.x;
            const dy = mouseY - cueBall.y;
            aimAngle = Math.atan2(dy, dx);
          } else {
            // Mouse drag: compute power from pullback
            const dx = mouseX - cueBall.x;
            const dy = mouseY - cueBall.y;
            const pullBack = -(dx * Math.cos(aimAngle) + dy * Math.sin(aimAngle));
            power = Math.min(100, Math.max(0, pullBack / 1.5));
            setCurrentPower(power);
          }
        }
      }
    };

    const handleDown = (e) => {
      if (gameMode === 'pvc' && currentPlayerState === 2) return;

      const pos = getPointerPos(e);
      mouseX = pos.x;
      mouseY = pos.y;

      if (!ballsMoving && cueBall && !cueBall.pocketed) {
        const isTouch = e.touches !== undefined;
        if (isTouch) {
          // Touch: set aim angle from initial touch position (finger points at cue ball from opposite side)
          const dx = mouseX - cueBall.x;
          const dy = mouseY - cueBall.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            aimAngle = Math.atan2(dy, dx);
          }
          touchAimX = mouseX;
          touchAimY = mouseY;
          touchStarted = true;
          // Don't start isDragging yet — let touchmove handle aim first
          // isDragging will be set after a small drag movement in touchmove
          isDragging = false;
          power = 0;
          setCurrentPower(0);
        } else {
          // Mouse: immediately update aim angle on click (desktop behaviour)
          const dx = mouseX - cueBall.x;
          const dy = mouseY - cueBall.y;
          aimAngle = Math.atan2(dy, dx);
          isDragging = true;
        }
      }
    };

    const handleTouchMove = (e) => {
      if (gameMode === 'pvc' && currentPlayerState === 2) return;
      e.preventDefault();

      if (!touchStarted || !cueBall || cueBall.pocketed || ballsMoving) return;

      const pos = getPointerPos(e);
      mouseX = pos.x;
      mouseY = pos.y;

      if (!isDragging) {
        // Check how far finger moved from initial touch
        const moveDx = mouseX - touchAimX;
        const moveDy = mouseY - touchAimY;
        const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);

        if (moveDist < 20) {
          // Small movement: still in aim phase — update aim angle from current finger to cue ball direction
          const dx = mouseX - cueBall.x;
          const dy = mouseY - cueBall.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            aimAngle = Math.atan2(dy, dx);
          }
        } else {
          // Finger moved far enough: switch to drag/power phase, lock aimAngle
          isDragging = true;
          // Update aim angle one last time based on current position
          const dx = mouseX - cueBall.x;
          const dy = mouseY - cueBall.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            aimAngle = Math.atan2(dy, dx);
          }
        }
      } else {
        // Power/pullback phase: compute how far behind the ball the finger is
        const dx = mouseX - cueBall.x;
        const dy = mouseY - cueBall.y;
        const pullBack = -(dx * Math.cos(aimAngle) + dy * Math.sin(aimAngle));
        power = Math.min(100, Math.max(0, pullBack / 1.5));
        setCurrentPower(power);
      }
    };

    const handleUp = () => {
      if (gameMode === 'pvc' && currentPlayerState === 2) return;

      if (power > 5 && !ballsMoving && cueBall && !cueBall.pocketed) {
        const speed = power / 4;
        cueBall.vx = Math.cos(aimAngle) * speed;
        cueBall.vy = Math.sin(aimAngle) * speed;
        ballsMoving = true;
        shotTaken = true;
        setTimerActive(false);
      }
      isDragging = false;
      touchStarted = false;
      power = 0;
      setCurrentPower(0);
    };

    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mousedown', handleDown);
    canvas.addEventListener('mouseup', handleUp);
    canvas.addEventListener('touchstart', handleDown, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleUp, { passive: false });

    initPockets();
    initBalls();

    // Explicitly sync React state so Player 1 always starts first
    currentPlayerState = 1;
    aiThinking = false;
    aiThinkTimer = 0;
    aiPhase = 'aim';
    aiPullback = 0;
    shotTaken = false;
    winnerState = null;
    setTimerActive(true);
    setTurnTimeLeft(30);
    setGameState({
      currentPlayer: 1,
      player1Balls: [],
      player2Balls: [],
      pocketedBalls: [],
      player1Type: null,
      player2Type: null,
      winner: null,
      message: 'Player 1: Break the rack!'
    });

    gameLoop();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mousedown', handleDown);
      canvas.removeEventListener('mouseup', handleUp);
      canvas.removeEventListener('touchstart', handleDown);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleUp);
    };
  }, [gameMode]);
  if (!gameMode) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden font-sans select-none" role="main">

        {/* Premium Performance Background: Radial Gradient replaces heavy image for 100% score */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 bg-[#070b14]"
          style={{
            background: 'radial-gradient(circle at 50% -20%, #1e293b 0%, #070b14 80%)',
            opacity: 1
          }}
        >
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        </div>
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[#0a0f1a]/80 via-transparent to-[#0a0f1a]/90 z-0"></div>


        <div className="relative z-10 w-full max-w-4xl text-center space-y-12">

          <div className="space-y-4 animate-in slide-in-from-top duration-700">
            <div aria-hidden="true" className="flex items-center justify-center gap-4 mb-2">
              <div className="w-16 h-1 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
              <span className="text-yellow-500 text-3xl" role="img" aria-label="billiards ball">🎱</span>
              <div className="w-16 h-1 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
            </div>
            <h1 className="text-7xl font-black text-white tracking-tighter uppercase italic leading-none drop-shadow-2xl">
              POOL <span className="text-yellow-500">PRO</span>
            </h1>
            <p className="text-gray-400 text-lg font-bold tracking-[0.3em] uppercase opacity-70">Championship Series</p>
          </div>

          {/* MODE CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl mx-auto" role="group" aria-label="Select game mode">

            <button
              onClick={() => setGameMode('pvp')}
              aria-label="Player vs Player mode - Challenge a friend on the same device"
              className="group relative bg-white/5 hover:bg-white/10 border border-white/10 rounded-[30px] p-10 transition-all duration-500 hover:scale-105 active:scale-95 shadow-2xl backdrop-blur-md overflow-hidden"
            >
              <div aria-hidden="true" className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="text-8xl">👥</span>
              </div>
              <div className="relative z-10 text-left">
                <div aria-hidden="true" className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl mb-6 group-hover:bg-yellow-500 transition-colors duration-300">👥</div>
                <h2 className="text-white text-3xl font-black mb-2">PVP MODE</h2>
                <p className="text-gray-400 font-medium">Challenge a friend on the same device.</p>
                <div aria-hidden="true" className="mt-8 flex items-center gap-2 text-yellow-500 font-bold text-sm tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                  START GAME <span className="group-hover:translate-x-2 transition-transform">→</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => setGameMode('pvc')}
              aria-label="Player vs Computer mode - Test your skills against the AI agent"
              className="group relative bg-white/5 hover:bg-white/10 border border-white/10 rounded-[30px] p-10 transition-all duration-500 hover:scale-105 active:scale-95 shadow-2xl backdrop-blur-md overflow-hidden"
            >
              <div aria-hidden="true" className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="text-8xl">🤖</span>
              </div>
              <div className="relative z-10 text-left">
                <div aria-hidden="true" className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl mb-6 group-hover:bg-yellow-500 transition-colors duration-300">🤖</div>
                <h2 className="text-white text-3xl font-black mb-2">PVC MODE</h2>
                <p className="text-gray-400 font-medium">Test your skills against the AI agent.</p>
                <div aria-hidden="true" className="mt-8 flex items-center gap-2 text-yellow-500 font-bold text-sm tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                  START GAME <span className="group-hover:translate-x-2 transition-transform">→</span>
                </div>
              </div>
            </button>

          </div>

          {/* HELP CARD */}
          <div className="max-w-md mx-auto bg-black/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm animate-in fade-in duration-1000 slide-in-from-bottom-5" role="region" aria-label="How to play">
            <h2 className="text-gray-400 font-black text-xs uppercase tracking-widest mb-4 flex items-center justify-center gap-2">
              <span aria-hidden="true" className="w-2 h-2 rounded-full bg-green-500"></span> How to Play
            </h2>
            <ul className="grid grid-cols-2 gap-4 text-xs font-bold uppercase tracking-tight text-white/60 list-none p-0 m-0">
              <li className="bg-white/5 p-2 rounded"><span aria-hidden="true">🖱️</span> Move Mouse to Aim</li>
              <li className="bg-white/5 p-2 rounded"><span aria-hidden="true">🖱️</span> Drag &amp; Pull to Power</li>
              <li className="bg-white/5 p-2 rounded"><span aria-hidden="true">✨</span> Release to Shoot</li>
              <li className="bg-white/5 p-2 rounded"><span aria-hidden="true">🏆</span> Pocket all vs 8-Ball</li>
            </ul>
          </div>

        </div>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-[#070b14] p-0 font-sans select-none overflow-x-hidden text-white relative" role="main">

      {/* Decorative background - hidden from assistive technologies */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-cover bg-center opacity-60"
        style={{
          backgroundImage: "url('/background.png')",
          filter: 'brightness(0.5)'
        }}
      ></div>
      <div aria-hidden="true" className="absolute inset-0 bg-[#070b14]/40 z-0 pointer-events-none"></div>

      {/* PROFESSIONAL TOP BAR (Menu & Status) */}
      <nav className="w-full bg-[#1e293b] border-b border-white/10 py-1.5 xs:py-2 md:py-3 px-4 sm:px-8 hidden md:flex items-center justify-between shadow-lg z-30 shrink-0" aria-label="Game controls">
        <button
          onClick={() => setGameMode(null)}
          aria-label="Return to main menu"
          className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 font-bold px-2 sm:px-6 py-1 rounded-lg transition-all text-xs sm:text-base flex items-center justify-center"
        >
          <svg aria-hidden="true" className="block md:hidden w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
          <span className="hidden md:inline">MENU</span>
        </button>

        <div className="bg-black/40 px-3 sm:px-8 py-1 rounded-full border border-yellow-500/30 mx-2" role="status" aria-live="polite" aria-atomic="true">
          <p className="text-yellow-400 font-black text-[10px] sm:text-sm uppercase tracking-[0.1em] sm:tracking-[0.2em] animate-pulse truncate max-w-[120px] sm:max-w-none">
            {gameState.message}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-bold text-gray-400" aria-label={`Shot power: ${Math.floor(currentPower)} percent`}>
          <span className="hidden xs:inline" aria-hidden="true">POWER: {Math.floor(currentPower)}%</span>
          <div
            className="w-16 sm:w-24 h-1.5 sm:h-2 bg-gray-700 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.floor(currentPower)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Shot power meter"
          >
            <div className="h-full bg-yellow-500 transition-all duration-100" style={{ width: `${currentPower}%` }}></div>
          </div>
        </div>
      </nav>

      {/* MINIMAL TOP BAR - Just Player names + score + VS - Hidden on Mobile */}
      <section className="w-full px-2 sm:px-6 lg:px-16 py-1 md:py-2 z-20 relative hidden md:block" aria-label="Score board">
        <div className="flex items-center justify-between max-w-[1200px] mx-auto gap-2">

          {/* P1 Name + Score */}
          <div className="flex items-center gap-1.5" role="status" aria-label={`Player 1: ${gameState.player1Balls.length} of 7 pocketed`}>
            <span className={`text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-wider ${gameState.currentPlayer === 1 ? 'text-[#56e33e]' : 'text-gray-500'}`}>P1</span>
            {gameState.currentPlayer === 1 && <span className="w-1.5 h-1.5 rounded-full bg-[#56e33e] animate-pulse"></span>}
            <div className="bg-[#56e33e]/10 border border-[#56e33e]/30 rounded px-1.5 py-0.5">
              <span className="text-[#56e33e] text-[10px] sm:text-xs font-black">{gameState.player1Balls.length}/7</span>
            </div>
            {gameState.player1Type && <span className="text-[8px] text-gray-500 font-bold uppercase hidden sm:inline">{gameState.player1Type === 'solid' ? 'SOLID' : 'STRIPE'}</span>}
          </div>

          {/* VS Center */}
          <div aria-hidden="true" className="flex flex-col items-center shrink-0">
            <span className="text-yellow-500 text-[10px] xs:text-xs md:text-sm font-black tracking-widest" style={{ textShadow: '0 0 10px rgba(234,179,8,0.5)' }}>VS</span>
            <div className="w-8 h-0.5 bg-gradient-to-r from-[#56e33e] via-yellow-500 to-[#3b82f6] rounded-full mt-0.5"></div>
          </div>

          {/* P2 Name + Score */}
          <div className="flex items-center gap-1.5 flex-row-reverse" role="status" aria-label={`${gameMode === 'pvc' ? 'AI' : 'Player 2'}: ${gameState.player2Balls.length} of 7 pocketed`}>
            <span className={`text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-wider ${gameState.currentPlayer === 2 ? 'text-[#3b82f6]' : 'text-gray-500'}`}>{gameMode === 'pvc' ? 'AI' : 'P2'}</span>
            {gameState.currentPlayer === 2 && <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse"></span>}
            <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded px-1.5 py-0.5">
              <span className="text-[#3b82f6] text-[10px] sm:text-xs font-black">{gameState.player2Balls.length}/7</span>
            </div>
            {gameState.player2Type && <span className="text-[8px] text-gray-500 font-bold uppercase hidden sm:inline">{gameState.player2Type === 'solid' ? 'SOLID' : 'STRIPE'}</span>}
          </div>

        </div>
      </section>

      <div className="flex flex-1 flex-row w-full items-center justify-between px-1 sm:px-4 lg:px-6 py-1 lg:py-0 gap-1 sm:gap-3 lg:gap-8 relative z-20">

        {/* PLAYER 1 SIDE PANEL - Left of table, visible all screens */}
        <div className="flex flex-col items-center shrink-0 w-[32px] xs:w-[38px] sm:w-[48px] lg:w-[80px] gap-1 lg:gap-2" role="group" aria-label={`Player 1 balls: ${gameState.player1Balls.length} of 7 pocketed`}>
          {/* P1 Avatar */}
          <div className={`p-0.5 lg:p-1 rounded-lg lg:rounded-2xl transition-all duration-300 shrink-0 ${gameState.currentPlayer === 1 ? 'bg-[#56e33e] shadow-[0_0_12px_rgba(86,227,62,0.5)]' : 'bg-gray-700/30 opacity-50'}`}>
            <div className="w-5 h-5 xs:w-6 xs:h-6 sm:w-8 sm:h-8 lg:w-14 lg:h-14 bg-[#1e293b] rounded-md lg:rounded-xl flex items-center justify-center text-xs sm:text-sm lg:text-3xl border border-black/20 font-black">
              👤
            </div>
          </div>
          {/* P1 Ball Slots — vertical */}
          <div className="flex flex-col gap-[3px] sm:gap-1 lg:gap-1.5">
            {(() => {
              const p1Balls = gameState.player1Type === 'stripe' ? [9, 10, 11, 12, 13, 14, 15] : [1, 2, 3, 4, 5, 6, 7];
              return p1Balls.map((ballNum) => {
                const isPocketed = gameState.pocketedBalls.includes(ballNum);
                const isStripe = ballNum > 8;
                return (
                  <div
                    key={ballNum}
                    className={`w-[22px] h-[22px] xs:w-[26px] xs:h-[26px] sm:w-[32px] sm:h-[32px] lg:w-[44px] lg:h-[44px] rounded-full flex items-center justify-center text-[6px] xs:text-[7px] sm:text-[9px] lg:text-sm font-black shrink-0 transition-all duration-500 ${isPocketed ? 'shadow-lg scale-105 ring-1 ring-white/40' : 'opacity-20 scale-90 grayscale'}`}
                    style={{
                      background: `radial-gradient(circle at 35% 35%, ${BALL_COLORS[ballNum].base}, ${BALL_COLORS[ballNum].shade})`,
                      boxShadow: isPocketed ? `0 0 8px ${BALL_COLORS[ballNum].base}90, inset 0 -2px 4px rgba(0,0,0,0.3)` : 'none',
                      animation: isPocketed ? 'ballPocketGlow 1.5s ease-in-out infinite alternate' : 'none'
                    }}
                    aria-label={`Ball ${ballNum}${isPocketed ? ' pocketed' : ''}`}
                  >
                    {isStripe ? (
                      <div className="bg-white/90 w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 lg:w-6 lg:h-6 rounded-full flex items-center justify-center text-black text-[5px] xs:text-[6px] sm:text-[8px] lg:text-xs border border-black/10">{ballNum}</div>
                    ) : (
                      <span className="text-white drop-shadow-md">{ballNum}</span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* CENTER TABLE AREA */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center py-1 xs:py-2 sm:py-3 md:pt-10 md:pb-4 lg:py-4 relative">

          {/* NANO TIMER BOX - Fully Responsive */}
          {timerActive && (
            <div className={`absolute hidden md:flex md:-top-9 lg:-top-12 left- -translate-x-1/2 z-[40] min-w-[70px] md:min-w-[80px] lg:min-w-[120px] px-2 md:px-2.5 lg:px-4 py-1 md:py-1 lg:py-1.5 rounded-lg border shadow-2xl backdrop-blur-xl items-center justify-center gap-2 animate-in fade-in zoom-in duration-300 ${gameState.currentPlayer === 1
              ? 'bg-green-500/20 border-green-500/50 text-green-400 shadow-green-500/20'
              : 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-blue-500/20'
              }`}>
              <div className="flex flex-col items-center leading-none">
                <span className="text-[7px] xs:text-[8px] md:text-[9px] lg:text-[10px] font-black uppercase tracking-wider opacity-60">Timer</span>
                <span className="text-[12px] xs:text-[14px] md:text-base lg:text-2xl font-black tabular-nums">
                  {turnTimeLeft}<span className="text-[9px] xs:text-[10px] md:text-xs lg:text-lg ml-0.5 opacity-70">s</span>
                </span>
              </div>
            </div>
          )}

          <div className="relative w-full p-0.5 sm:p-1 bg-amber-950/20 rounded-[16px] sm:rounded-[30px] lg:rounded-[50px] shadow-2xl border border-white/5 backdrop-blur-sm">
            <canvas
              ref={canvasRef}
              width={1000}
              height={500}
              role="img"
              aria-label={`Pool game table. ${gameState.message}. Player ${gameState.currentPlayer}'s turn.`}
              className="w-full h-auto rounded-[10px] xs:rounded-[14px] md:rounded-[48px] shadow-[0_20px_40px_-10px_rgba(0,0,0,1)] cursor-crosshair border-[3px] xs:border-[4px] md:border-[12px] border-[#3E1F11] touch-none"
              style={{ touchAction: 'none' }}
            />
            <div aria-hidden="true" className="absolute -bottom-6 lg:-bottom-16 left-6 lg:left-20 right-6 lg:right-20 h-8 lg:h-20 bg-black/50 blur-[30px] lg:blur-[80px] rounded-full z-[-1]"></div>
          </div>
        </div>

        {/* PLAYER 2 SIDE PANEL - Right of table, visible all screens */}
        <div className="flex flex-col items-center shrink-0 w-[32px] xs:w-[38px] sm:w-[48px] lg:w-[80px] gap-1 lg:gap-2" role="group" aria-label={`${gameMode === 'pvc' ? 'AI' : 'Player 2'} balls: ${gameState.player2Balls.length} of 7 pocketed`}>
          {/* P2 Avatar */}
          <div className={`p-0.5 lg:p-1 rounded-lg lg:rounded-2xl transition-all duration-300 shrink-0 ${gameState.currentPlayer === 2 ? 'bg-[#3b82f6] shadow-[0_0_12px_rgba(59,130,246,0.5)]' : 'bg-gray-700/30 opacity-50'}`}>
            <div className="w-5 h-5 xs:w-6 xs:h-6 sm:w-8 sm:h-8 lg:w-14 lg:h-14 bg-[#1e293b] rounded-md lg:rounded-xl flex items-center justify-center text-xs sm:text-sm lg:text-3xl border border-black/20 font-black">
              {gameMode === 'pvc' ? '🤖' : '👤'}
            </div>
          </div>
          {/* P2 Ball Slots — vertical */}
          <div className="flex flex-col gap-[3px] sm:gap-1 lg:gap-1.5">
            {(() => {
              const p2Balls = gameState.player2Type === 'stripe' ? [9, 10, 11, 12, 13, 14, 15] : [1, 2, 3, 4, 5, 6, 7];
              return p2Balls.map((ballNum) => {
                const isPocketed = gameState.pocketedBalls.includes(ballNum);
                const isStripe = ballNum > 8;
                return (
                  <div
                    key={ballNum}
                    className={`w-[22px] h-[22px] xs:w-[26px] xs:h-[26px] sm:w-[32px] sm:h-[32px] lg:w-[44px] lg:h-[44px] rounded-full flex items-center justify-center text-[6px] xs:text-[7px] sm:text-[9px] lg:text-sm font-black shrink-0 transition-all duration-500 ${isPocketed ? 'shadow-lg scale-105 ring-1 ring-white/40' : 'opacity-20 scale-90 grayscale'}`}
                    style={{
                      background: `radial-gradient(circle at 35% 35%, ${BALL_COLORS[ballNum].base}, ${BALL_COLORS[ballNum].shade})`,
                      boxShadow: isPocketed ? `0 0 8px ${BALL_COLORS[ballNum].base}90, inset 0 -2px 4px rgba(0,0,0,0.3)` : 'none',
                      animation: isPocketed ? 'ballPocketGlow 1.5s ease-in-out infinite alternate' : 'none'
                    }}
                    aria-label={`Ball ${ballNum}${isPocketed ? ' pocketed' : ''}`}
                  >
                    {isStripe ? (
                      <div className="bg-white/90 w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 lg:w-6 lg:h-6 rounded-full flex items-center justify-center text-black text-[5px] xs:text-[6px] sm:text-[8px] lg:text-xs border border-black/10">{ballNum}</div>
                    ) : (
                      <span className="text-white drop-shadow-md">{ballNum}</span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* PREMIUM GAME OVER POPUP */}
      {gameState.winner && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[200] animate-in fade-in duration-700 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-over-title"
          aria-describedby="game-over-message"
        >
          <div
            className={`w-full max-w-[90%] sm:max-w-sm md:max-w-md bg-slate-900 border-2 sm:border-[3px] ${gameMode === 'pvc' && gameState.winner === 1
              ? 'border-green-500 shadow-[0_0_100px_rgba(34,197,94,0.3)]'
              : 'border-yellow-500 shadow-[0_0_100px_rgba(234,179,8,0.3)]'
              } rounded-xl sm:rounded-[30px] md:rounded-[50px] text-center transform animate-in zoom-in duration-500 overflow-y-auto`}
            style={{
              maxHeight: '92dvh',
              padding: isMobileLandscape ? '10px 14px' : '24px 20px',
            }}
          >
            {/* Trophy emoji */}
            <div
              aria-hidden="true"
              className="drop-shadow-2xl"
              style={{
                fontSize: isMobileLandscape ? '1.5rem' : '3rem',
                marginBottom: isMobileLandscape ? '2px' : '12px',
              }}
            >
              {gameMode === 'pvc' && gameState.winner === 1 ? '' : '🏆'}
            </div>

            <h2
              id="game-over-title"
              className="text-white font-black tracking-tighter italic uppercase leading-none"
              style={{
                fontSize: isMobileLandscape ? '1.2rem' : '1.5rem',
                marginBottom: isMobileLandscape ? '4px' : '6px',
              }}
            >
              {gameMode === 'pvc' && gameState.winner === 1 ? 'YOU WIN!' : 'GAME OVER'}
            </h2>

            <div
              aria-hidden="true"
              className={`${gameMode === 'pvc' && gameState.winner === 1
                ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)]'
                : 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.8)]'
                } mx-auto rounded-full`}
              style={{
                height: isMobileLandscape ? '2px' : '3px',
                width: isMobileLandscape ? '40px' : '60px',
                margin: isMobileLandscape ? '4px auto' : '10px auto 12px',
              }}
            />

            <p
              className="text-white font-black tracking-tight uppercase"
              style={{
                fontSize: isMobileLandscape ? '0.7rem' : '1rem',
                marginBottom: isMobileLandscape ? '6px' : '14px',
              }}
            >
              {gameMode === 'pvc'
                ? (gameState.winner === 1 ? 'CONGRATULATIONS!' : 'AI PLAYER WINS!')
                : `PLAYER ${gameState.winner} WINS!`
              }
            </p>

            <div
              className="bg-white/5 rounded-xl border border-white/10 shadow-inner"
              style={{
                padding: isMobileLandscape ? '5px 10px' : '10px 14px',
                marginBottom: isMobileLandscape ? '8px' : '16px',
              }}
            >
              <p
                id="game-over-message"
                className={`${gameMode === 'pvc' && gameState.winner === 1 ? 'text-green-400' : 'text-yellow-400'
                  } font-bold italic uppercase tracking-wider leading-relaxed`}
                style={{ fontSize: isMobileLandscape ? '8px' : '11px' }}
              >
                &ldquo; {gameState.message} &rdquo;
              </p>
            </div>

            <div className="flex flex-col" style={{ gap: isMobileLandscape ? '5px' : '8px' }}>
              <button
                aria-label="Play again — start a new game"
                onClick={() => {
                  const current = gameMode;
                  setGameMode(null);
                  setGameState({
                    currentPlayer: 1,
                    player1Balls: [],
                    player2Balls: [],
                    pocketedBalls: [],
                    player1Type: null,
                    player2Type: null,
                    winner: null,
                    message: 'Player 1: Break the rack!'
                  });
                  setTimeout(() => setGameMode(current), 50);
                }}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-full shadow-[0_4px_0_rgb(161,98,7)] transition-all hover:-translate-y-1 active:translate-y-1 active:shadow-none w-full"
                style={{
                  fontSize: isMobileLandscape ? '0.8rem' : '1rem',
                  padding: isMobileLandscape ? '6px 0' : '12px 0',
                }}
              >
                PLAY AGAIN
              </button>
              <button
                aria-label="Exit to main menu"
                onClick={() => setGameMode(null)}
                className="text-white/30 hover:text-white font-bold transition-all uppercase tracking-[0.2em] w-full"
                style={{
                  fontSize: '10px',
                  paddingTop: isMobileLandscape ? '2px' : '6px',
                }}
              >
                Exit to Menu
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ROTATE DEVICE OVERLAY */}
      {isPortrait && (
        <div
          className="fixed inset-0 bg-[#070b14] z-[500] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_70%)]"></div>
          <div aria-hidden="true" className="w-32 h-32 mb-10 relative z-10">
            <div className="absolute inset-0 border-[3px] border-yellow-500/20 rounded-[2.5rem] animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center text-7xl animate-[bounce_2s_infinite]">
              📱
            </div>
            <div className="absolute -top-2 -right-2 w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.5)] animate-[spin_3s_linear_infinite]">
              <span className="text-black font-black text-xl">↻</span>
            </div>
          </div>

          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 mb-4 tracking-tighter uppercase italic z-10 drop-shadow-sm">
            Flip to Play
          </h2>

          <div aria-hidden="true" className="h-1 w-16 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mb-6 rounded-full opacity-50 z-10"></div>

          <p className="text-blue-100/60 font-bold max-w-[240px] leading-relaxed z-10 uppercase tracking-widest text-[10px] sm:text-xs">
            Game optimized for <span className="text-yellow-500">Landscape Mode</span>. Please rotate your device.
          </p>

          <div aria-hidden="true" className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-20 z-10">
            <div className="w-1 h-12 bg-gradient-to-b from-yellow-500 to-transparent rounded-full"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoolGame;
