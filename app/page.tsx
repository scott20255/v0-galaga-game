"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"

export default function GalagaGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameStateRef = useRef<any>(null)
  const [showNameInput, setShowNameInput] = useState(false)
  const [playerName, setPlayerName] = useState("")
  const [highScore, setHighScore] = useState(0)
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [gameStatus, setGameStatus] = useState({
    score: 0,
    lives: 5,
    stage: 1,
    currentHigh: 0,
  })

  useEffect(() => {
    const savedHighScore = localStorage.getItem("galaga-high-score")
    if (savedHighScore) {
      setHighScore(Number.parseInt(savedHighScore))
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const sounds = {
      shoot: () => {
        const oscillator = audioCtx.createOscillator()
        const gainNode = audioCtx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(audioCtx.destination)
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1)
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1)
        oscillator.start(audioCtx.currentTime)
        oscillator.stop(audioCtx.currentTime + 0.1)
      },
      explosion: () => {
        const oscillator = audioCtx.createOscillator()
        const gainNode = audioCtx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(audioCtx.destination)
        oscillator.type = "sawtooth"
        oscillator.frequency.setValueAtTime(200, audioCtx.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3)
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3)
        oscillator.start(audioCtx.currentTime)
        oscillator.stop(audioCtx.currentTime + 0.3)
      },
      hit: () => {
        const oscillator = audioCtx.createOscillator()
        const gainNode = audioCtx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(audioCtx.destination)
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.15)
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15)
        oscillator.start(audioCtx.currentTime)
        oscillator.stop(audioCtx.currentTime + 0.15)
      },
      capture: () => {
        const oscillator = audioCtx.createOscillator()
        const gainNode = audioCtx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(audioCtx.destination)
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime)
        oscillator.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 0.5)
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5)
        oscillator.start(audioCtx.currentTime)
        oscillator.stop(audioCtx.currentTime + 0.5)
      },
      rescue: () => {
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.connect(gain)
        gain.connect(audioCtx.destination)

        osc.frequency.setValueAtTime(440, audioCtx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3)
        osc.frequency.exponentialRampToValueAtTime(660, audioCtx.currentTime + 0.6)

        gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6)

        osc.start()
        osc.stop(audioCtx.currentTime + 0.6)
      },
    }

    // Game initialization
    const ui = { score: 0, lives: 5, stage: 1, paused: false }
    const keys = { Left: false, Right: false, Fire: false }
    const screen = { W: 800, H: 1000, scale: 1 }

    // Resize canvas to fit screen
    function fit() {
      const maxW = Math.min(window.innerWidth - 20, 820)
      const scale = maxW / canvas.width
      screen.scale = scale
      canvas.style.width = canvas.width * scale + "px"
      canvas.style.height = canvas.height * scale + "px"
    }

    window.addEventListener("resize", fit)
    fit()

    // Utilities
    const rnd = (a = 1, b = 0) => Math.random() * (a - b) + b
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

    // Stars background
    const stars = [...Array(160)].map(() => ({ x: rnd(screen.W), y: rnd(screen.H), z: rnd(1, 0.2) }))

    function drawStars(dt: number) {
      for (const s of stars) {
        s.y += 12 * s.z * dt
        if (s.y > screen.H) {
          s.y = 0
          s.x = rnd(screen.W)
        }
      }
      ctx.save()
      ctx.fillStyle = "#89a"
      for (const s of stars) {
        ctx.globalAlpha = s.z
        ctx.fillRect(s.x, s.y, 2, 2)
      }
      ctx.restore()
    }

    // Game entities
    const bullets: any[] = []
    const ebullets: any[] = []
    const enemies: any[] = []
    const particles: any[] = []
    const drops: any[] = []
    const captureBeams: any[] = []
    let capturedShip: any = null

    const player = {
      x: screen.W / 2,
      y: screen.H - 80,
      vx: 0,
      speed: 420,
      w: 36,
      h: 30,
      cd: 0,
      power: 1,
      twin: false,
      inv: 0,
      shield: 0,
      multiShot: 1,
      allies: [],
      captured: false,
    }

    function playerDraw() {
      ctx.save()
      ctx.translate(player.x, player.y)
      if (player.inv > 0) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.cos(t * 20)
      }

      // Main body
      ctx.fillStyle = "#e8f4f8"
      ctx.beginPath()
      ctx.moveTo(0, -25)
      ctx.lineTo(18, 18)
      ctx.lineTo(8, 22)
      ctx.lineTo(0, 16)
      ctx.lineTo(-8, 22)
      ctx.lineTo(-18, 18)
      ctx.closePath()
      ctx.fill()

      // Cockpit
      ctx.fillStyle = "#4a9eff"
      ctx.beginPath()
      ctx.ellipse(0, -8, 6, 12, 0, 0, Math.PI * 2)
      ctx.fill()

      // Engine glow
      ctx.fillStyle = "#ff6b6b"
      ctx.beginPath()
      ctx.ellipse(-12, 8, 3, 6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(12, 8, 3, 6, 0, 0, Math.PI * 2)
      ctx.fill()

      // Wing details
      ctx.strokeStyle = "#a0c4ff"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-15, 5)
      ctx.lineTo(-8, 15)
      ctx.moveTo(15, 5)
      ctx.lineTo(8, 15)
      ctx.stroke()

      if (player.twin) {
        ctx.fillStyle = "#9cf"
        ctx.fillRect(-28, 3, 56, 4)
      }

      if (player.shield > 0) {
        ctx.strokeStyle = `rgba(100, 200, 255, ${Math.min(1, player.shield)})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(0, 0, 35, 0, Math.PI * 2)
        ctx.stroke()
      }

      for (const ally of player.allies) {
        ctx.save()
        ctx.translate(ally.x, ally.y)
        ctx.scale(0.7, 0.7)

        // Simplified ally ship design
        ctx.fillStyle = "#a0c4ff"
        ctx.beginPath()
        ctx.moveTo(0, -15)
        ctx.lineTo(12, 12)
        ctx.lineTo(-12, 12)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = "#70a1ff"
        ctx.fillRect(-3, -5, 6, 8)
        ctx.restore()
      }

      ctx.restore()
    }

    function playerUpdate(dt: number) {
      player.vx = (keys.Left ? -1 : 0) + (keys.Right ? 1 : 0)
      player.x = clamp(player.x + player.vx * player.speed * dt, 28, screen.W - 28)
      player.cd = Math.max(0, player.cd - dt)
      player.inv = Math.max(0, player.inv - dt)
      player.shield = Math.max(0, player.shield - dt)

      if (keys.Fire && player.cd === 0) {
        const shotSpread = player.multiShot > 1 ? 15 : 0
        for (let i = 0; i < player.multiShot; i++) {
          const angle = (i - (player.multiShot - 1) / 2) * shotSpread
          const vx = Math.sin((angle * Math.PI) / 180) * 100
          fire(player.x + vx * 0.1, player.y - 22, -700 + Math.abs(vx))
        }
        sounds.shoot()

        if (player.twin) {
          fire(player.x - 16, player.y - 22)
          fire(player.x + 16, player.y - 22)
        }
        if (player.power > 1) {
          fire(player.x, player.y - 28, -850)
        }

        for (const ally of player.allies) {
          fire(ally.x, ally.y - 22)
        }

        player.cd = player.twin ? 0.11 : 0.18
      }

      for (let i = 0; i < player.allies.length; i++) {
        const ally = player.allies[i]
        const targetX = player.x + (i % 2 === 0 ? -40 : 40) * (Math.floor(i / 2) + 1)
        const targetY = player.y + 20 + Math.floor(i / 2) * 25
        ally.x += (targetX - ally.x) * dt * 8
        ally.y += (targetY - ally.y) * dt * 8
      }
    }

    function fire(x: number, y: number, vy = -700) {
      bullets.push({ x, y, vy, w: 4, h: 10 })
    }

    // Enemy formation
    function spawnWave(stage = 1) {
      enemies.length = 0
      ebullets.length = 0
      drops.length = 0
      captureBeams.length = 0
      const rows = 5 + Math.min(2, stage)
      const cols = 10
      const ox = 140,
        oy = 120
      const gapX = 48,
        gapY = 46
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          enemies.push({
            x: ox + c * gapX,
            y: oy + r * gapY,
            baseX: ox + c * gapX,
            baseY: oy + r * gapY,
            t: rnd(Math.PI * 2),
            hp: r < 1 ? 3 : r < 2 ? 2 : 1, // Boss: 3 hits, elite: 2 hits, grunt: 1 hit
            kind: r < 1 ? "boss" : r < 2 ? "elite" : "grunt",
            canCapture: r < 1,
            captureTimer: 0,
            hasCapture: false,
          })
        }
      }
    }

    function enemyUpdate(e: any, dt: number) {
      e.t += dt
      e.x = e.baseX + Math.sin(e.t * 2 + e.baseX * 0.02) * 10
      e.y = e.baseY + Math.cos(e.t * 2 + e.baseX * 0.015) * 6

      const baseSpeed = Math.max(30, 90 - ui.stage * 10) // Easier stage 1, gradual increase
      e.baseY += baseSpeed * dt

      if (e.hasCapture && capturedShip && capturedShip.owner === e) {
        // Move to top of screen after capture
        if (e.baseY > -50) {
          e.baseY -= 150 * dt // Move up faster
        } else {
          // Once at top, slowly descend again
          e.baseY += 30 * dt
        }
      }

      if (e.baseY > screen.H + 50) {
        e.baseX = rnd(screen.W - 60) + 30
        e.baseY = -50
      }

      if (e.canCapture && e.kind === "boss" && e.y > screen.H * 0.6 && !player.captured && capturedShip === null) {
        e.captureTimer += dt
        if (e.captureTimer > 5 && Math.random() < 0.002) {
          captureBeams.push({
            x: e.x,
            y: e.y + 20,
            targetX: player.x,
            targetY: player.y,
            width: 60,
            height: 0,
            growing: true,
            owner: e,
          })
          e.captureTimer = 0
        }
      }
    }

    function enemyShoot(e: any) {
      ebullets.push({ x: e.x, y: e.y + 12, vy: 280 + ui.stage * 10, w: 4, h: 12 })
    }

    function drawEnemy(e: any) {
      ctx.save()
      ctx.translate(e.x, e.y)
      if (e.kind === "boss") {
        ctx.fillStyle = "#8ef"
        ctx.beginPath()
        ctx.moveTo(0, -20)
        ctx.lineTo(18, -5)
        ctx.lineTo(18, 8)
        ctx.lineTo(8, 18)
        ctx.lineTo(-8, 18)
        ctx.lineTo(-18, 8)
        ctx.lineTo(-20, -5)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = "#2cf"
        ctx.beginPath()
        ctx.ellipse(0, -5, 8, 10, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = "#ff4757"
        ctx.fillRect(-15, 0, 4, 8)
        ctx.fillRect(11, 0, 4, 8)
      } else if (e.kind === "elite") {
        ctx.fillStyle = "#ffd166"
        ctx.beginPath()
        ctx.moveTo(0, -12)
        ctx.lineTo(15, 0)
        ctx.lineTo(12, 12)
        ctx.lineTo(-12, 12)
        ctx.lineTo(-15, 0)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = "#ff9f1c"
        ctx.beginPath()
        ctx.ellipse(0, 0, 6, 8, 0, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = "#ff6b6b"
        ctx.fillRect(-3, 8, 2, 6)
        ctx.fillRect(1, 8, 2, 6)
      } else {
        ctx.fillStyle = "#70a1ff"
        ctx.beginPath()
        ctx.moveTo(0, -10)
        ctx.lineTo(12, 8)
        ctx.lineTo(-12, 8)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = "#5352ed"
        ctx.fillRect(-4, -2, 8, 6)
      }
      ctx.restore()
    }

    function boom(x: number, y: number, color = "#fff", n = 14) {
      for (let i = 0; i < n; i++) {
        particles.push({
          x,
          y,
          vx: rnd(180, -180),
          vy: rnd(-220, 220),
          life: rnd(0.6, 0.3),
          color,
          size: rnd(4, 2),
        })
      }
    }

    function drawParticles(dt: number) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life -= dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 280 * dt
        ctx.globalAlpha = Math.max(0, p.life * 1.2)
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, p.size || 3, p.size || 3)
        if (p.life <= 0) particles.splice(i, 1)
      }
      ctx.globalAlpha = 1
    }

    function spawnDrop(x: number, y: number) {
      const rand = Math.random()
      let type = "power"

      if (rand < 0.15) type = "twin"
      else if (rand < 0.25) type = "shield"
      else if (rand < 0.35) type = "life"
      else if (rand < 0.45) type = "multishot"
      else if (rand < 0.55) type = "ally"
      else type = "power"

      drops.push({ x, y, vy: 120, w: 16, h: 16, type, t: 0 })
    }

    function drawDrop(d: any) {
      ctx.save()
      ctx.translate(d.x, d.y)
      d.t += 0.2
      ctx.rotate(Math.sin(d.t) * 0.3)

      switch (d.type) {
        case "twin":
          ctx.strokeStyle = "#9cf"
          ctx.strokeRect(-8, -8, 16, 16)
          ctx.beginPath()
          ctx.moveTo(-6, 0)
          ctx.lineTo(0, -6)
          ctx.lineTo(6, 0)
          ctx.stroke()
          break
        case "shield":
          ctx.strokeStyle = "#64c8ff"
          ctx.strokeRect(-8, -8, 16, 16)
          ctx.beginPath()
          ctx.arc(0, 0, 5, 0, Math.PI * 2)
          ctx.stroke()
          break
        case "life":
          ctx.strokeStyle = "#ff6b9d"
          ctx.strokeRect(-8, -8, 16, 16)
          ctx.fillStyle = "#ff6b9d"
          ctx.beginPath()
          ctx.moveTo(0, 2)
          ctx.lineTo(-3, -2)
          ctx.lineTo(-1, -4)
          ctx.lineTo(0, -3)
          ctx.lineTo(1, -4)
          ctx.lineTo(3, -2)
          ctx.closePath()
          ctx.fill()
          break
        case "multishot":
          ctx.strokeStyle = "#ffd93d"
          ctx.strokeRect(-8, -8, 16, 16)
          ctx.beginPath()
          ctx.moveTo(-4, 4)
          ctx.lineTo(0, -4)
          ctx.moveTo(0, 4)
          ctx.lineTo(0, -4)
          ctx.moveTo(4, 4)
          ctx.lineTo(0, -4)
          ctx.stroke()
          break
        case "ally":
          ctx.strokeStyle = "#a0c4ff"
          ctx.strokeRect(-8, -8, 16, 16)
          ctx.beginPath()
          ctx.moveTo(-4, 2)
          ctx.lineTo(0, -4)
          ctx.lineTo(4, 2)
          ctx.moveTo(-2, 2)
          ctx.lineTo(0, -2)
          ctx.lineTo(2, 2)
          ctx.stroke()
          break
        default: // power
          ctx.strokeStyle = "#94f7a6"
          ctx.strokeRect(-8, -8, 16, 16)
          ctx.beginPath()
          ctx.moveTo(-6, 4)
          ctx.lineTo(0, -6)
          ctx.lineTo(6, 4)
          ctx.stroke()
      }
      ctx.restore()
    }

    function hit(a: any, b: any) {
      return Math.abs(a.x - b.x) < ((a.w || 0) + (b.w || 0)) / 2 && Math.abs(a.y - b.y) < ((a.h || 0) + (b.h || 0)) / 2
    }

    function handleKeyDown(e: KeyboardEvent) {
      e.preventDefault()
      console.log("[v0] Key down:", e.key) // Debug log
      if (["ArrowLeft", "a", "A"].includes(e.key)) keys.Left = true
      if (["ArrowRight", "d", "D"].includes(e.key)) keys.Right = true
      if ([" ", "ArrowUp"].includes(e.key)) keys.Fire = true
      if (e.key === "p" || e.key === "P") ui.paused = !ui.paused
    }

    function handleKeyUp(e: KeyboardEvent) {
      e.preventDefault()
      console.log("[v0] Key up:", e.key) // Debug log
      if (["ArrowLeft", "a", "A"].includes(e.key)) keys.Left = false
      if (["ArrowRight", "d", "D"].includes(e.key)) keys.Right = false
      if ([" ", "ArrowUp"].includes(e.key)) keys.Fire = false
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    canvas.addEventListener("keydown", handleKeyDown)
    canvas.addEventListener("keyup", handleKeyUp)

    // Game loop
    let t = 0,
      lt = 0

    function reset() {
      ui.score = 0
      ui.lives = 5
      ui.stage = 1
      ui.paused = false
      player.x = screen.W / 2
      player.twin = false
      player.power = 1
      player.inv = 0
      player.shield = 0
      player.multiShot = 1
      player.allies = []
      player.captured = false
      capturedShip = null
      bullets.length = ebullets.length = enemies.length = particles.length = drops.length = 0
      captureBeams.length = 0
      spawnWave(1)
    }

    function nextStage() {
      ui.stage++
      spawnWave(ui.stage)
      player.inv = 0.8 // Brief invincibility when stage starts
    }

    function damagePlayer() {
      if (player.shield > 0) {
        player.shield = 0
        boom(player.x, player.y, "#64c8ff", 12)
        sounds.hit()
        return
      }

      ui.lives--
      boom(player.x, player.y, "#ff5577", 22)
      sounds.explosion()
      player.inv = 1.5
      if (ui.lives <= 0) {
        gameOver()
      } else {
        player.x = screen.W / 2
      }
    }

    function gameOver() {
      ui.lives = -1
      ui.paused = true
      const currentHighScore = Number.parseInt(localStorage.getItem("galaga-high-score") || "0")
      if (ui.score > currentHighScore) {
        setIsNewHighScore(true)
        setShowNameInput(true)
      }
    }

    function drawGameOver() {
      ctx.save()
      ctx.fillStyle = "rgba(0,0,0,.8)"
      ctx.fillRect(0, 0, screen.W, screen.H)
      ctx.fillStyle = "#ff5577"
      ctx.textAlign = "center"
      ctx.font = "bold 48px system-ui"
      ctx.fillText("GAME OVER", screen.W / 2, screen.H / 2 - 60)

      ctx.fillStyle = "#eaf2ff"
      ctx.font = "bold 24px system-ui"
      ctx.fillText(`Final Score: ${gameStatus.score}`, screen.W / 2, screen.H / 2 - 10)

      const currentHighScore = Number.parseInt(localStorage.getItem("galaga-high-score") || "0")
      const highScoreName = localStorage.getItem("galaga-high-score-name") || "Anonymous"
      ctx.font = "18px system-ui"
      ctx.fillText(`High Score: ${currentHighScore} by ${highScoreName}`, screen.W / 2, screen.H / 2 + 20)

      if (!showNameInput) {
        ctx.font = "bold 20px system-ui"
        ctx.fillText("Click RESTART to play again", screen.W / 2, screen.H / 2 + 60)

        ctx.fillStyle = "rgba(100, 150, 255, 0.2)"
        ctx.fillRect(screen.W / 2 - 80, screen.H / 2 + 80, 160, 40)
        ctx.strokeStyle = "#64c8ff"
        ctx.strokeRect(screen.W / 2 - 80, screen.H / 2 + 80, 160, 40)
        ctx.fillStyle = "#64c8ff"
        ctx.font = "bold 18px system-ui"
        ctx.fillText("RESTART", screen.W / 2, screen.H / 2 + 105)
      }
      ctx.restore()
    }

    function drawPaused() {
      if (ui.lives < 0) {
        drawGameOver()
        return
      }
      ctx.save()
      ctx.fillStyle = "rgba(0,0,0,.5)"
      ctx.fillRect(0, 0, screen.W, screen.H)
      ctx.fillStyle = "#eaf2ff"
      ctx.textAlign = "center"
      ctx.font = "bold 40px system-ui"
      ctx.fillText("PAUSED", screen.W / 2, screen.H / 2)
      ctx.restore()
    }

    function loop(ts: number) {
      requestAnimationFrame(loop)
      if (ui.paused) {
        drawPaused()
        return
      }

      if (!lt) lt = ts
      const dt = Math.min(0.033, (ts - lt) / 1000)
      lt = ts
      t += dt

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, screen.W, screen.H)

      drawStars(dt)

      if (!player.captured) {
        playerUpdate(dt)
        playerDraw()
      }

      if (capturedShip) {
        ctx.save()
        ctx.translate(capturedShip.x, capturedShip.y)
        ctx.scale(0.8, 0.8)
        ctx.fillStyle = "#ff9999"
        ctx.beginPath()
        ctx.moveTo(0, -25)
        ctx.lineTo(18, 18)
        ctx.lineTo(8, 22)
        ctx.lineTo(0, 16)
        ctx.lineTo(-8, 22)
        ctx.lineTo(-18, 18)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      for (let i = captureBeams.length - 1; i >= 0; i--) {
        const beam = captureBeams[i]
        if (beam.growing) {
          beam.height += 400 * dt
          if (beam.height >= Math.abs(beam.targetY - beam.y)) {
            beam.growing = false
            if (Math.abs(player.x - beam.x) < beam.width / 2 && !player.captured) {
              player.captured = true
              capturedShip = {
                x: player.x,
                y: player.y,
                owner: beam.owner,
              }
              beam.owner.hasCapture = true

              player.x = screen.W / 2
              player.y = screen.H - 80
              player.captured = false
              player.inv = 2
              sounds.capture()
            }
          }
        } else {
          beam.height -= 200 * dt
          if (beam.height <= 0) {
            captureBeams.splice(i, 1)
            continue
          }
        }

        ctx.save()
        ctx.fillStyle = "rgba(100, 200, 255, 0.6)"
        ctx.fillRect(beam.x - beam.width / 2, beam.y, beam.width, beam.height)
        ctx.strokeStyle = "#64c8ff"
        ctx.lineWidth = 2
        ctx.strokeRect(beam.x - beam.width / 2, beam.y, beam.width, beam.height)
        ctx.restore()

        if (capturedShip && capturedShip.owner === beam.owner) {
          // Create rescued ship that descends to join player
          const rescuedShip = {
            x: capturedShip.x,
            y: capturedShip.y,
            targetX: player.x - 40, // Position to left of player
            targetY: player.y,
            descending: true,
            joinTimer: 0,
          }

          // Add to allies with descent animation
          player.allies.push(rescuedShip)
          capturedShip = null

          // Remove associated capture beams
          for (let k = captureBeams.length - 1; k >= 0; k--) {
            if (captureBeams[k].owner === beam.owner) {
              captureBeams.splice(k, 1)
            }
          }
          sounds.rescue()
        }
      }

      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]
        b.y += b.vy * dt
        ctx.fillStyle = "#fff"
        ctx.fillRect(b.x - 1, b.y - 8, 2, 12)
        if (b.y < -20) bullets.splice(i, 1)
      }

      for (let i = ebullets.length - 1; i >= 0; i--) {
        const b = ebullets[i]
        b.y += b.vy * dt
        ctx.fillStyle = "#ff7b7b"
        ctx.fillRect(b.x - 1, b.y - 6, 2, 10)
        if (b.y > screen.H + 20) {
          ebullets.splice(i, 1)
          continue
        }
        if (player.inv <= 0 && hit(b, player)) {
          ebullets.splice(i, 1)
          damagePlayer()
        }
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i]
        enemyUpdate(e, dt)
        drawEnemy(e)

        if (Math.random() < 0.001) enemyShoot(e)

        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j]
          if (hit(e, b)) {
            bullets.splice(j, 1)
            e.hp--
            boom(e.x, e.y, e.kind === "boss" ? "#8ef" : e.kind === "elite" ? "#ffd166" : "#70a1ff", 12)
            sounds.hit()

            if (e.hp <= 0) {
              enemies.splice(i, 1)
              const scoreGain = e.kind === "boss" ? 150 : e.kind === "elite" ? 80 : 40
              ui.score += scoreGain

              if (capturedShip && capturedShip.owner === e) {
                player.allies.push({
                  x: capturedShip.x,
                  y: capturedShip.y,
                })
                capturedShip = null
                for (let k = captureBeams.length - 1; k >= 0; k--) {
                  if (captureBeams[k].owner === e) {
                    captureBeams.splice(k, 1)
                  }
                }
              }

              if (Math.random() < 0.12) spawnDrop(e.x, e.y)
              boom(e.x, e.y, "#fff", 18)
              sounds.explosion()
            }
            break
          }
        }
      }

      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]
        d.y += d.vy * dt
        drawDrop(d)
        if (d.y > screen.H + 20) {
          drops.splice(i, 1)
          continue
        }
        if (hit(d, player)) {
          drops.splice(i, 1)
          switch (d.type) {
            case "twin":
              player.twin = true
              break
            case "shield":
              player.shield = 8
              break
            case "life":
              ui.lives++
              break
            case "multishot":
              player.multiShot = Math.min(5, player.multiShot + 1)
              break
            case "ally":
              if (player.allies.length < 4) {
                player.allies.push({
                  x: player.x + (player.allies.length % 2 === 0 ? -30 : 30),
                  y: player.y + 20,
                })
              }
              break
            default:
              player.power = Math.min(3, player.power + 1)
          }
        }
      }

      drawParticles(dt)

      const currentHighScore = Number.parseInt(localStorage.getItem("galaga-high-score") || "0")
      const displayHigh = Math.max(currentHighScore, ui.score)

      setGameStatus({
        score: ui.score,
        lives: ui.lives,
        stage: ui.stage,
        currentHigh: displayHigh,
      })

      // Check for stage completion
      if (enemies.length === 0 && ui.lives > 0) {
        nextStage()
      }
    }

    gameStateRef.current = { reset, loop, handleKeyDown, handleKeyUp, ui }

    reset()
    requestAnimationFrame(loop)

    return () => {
      window.removeEventListener("resize", fit)
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      canvas.removeEventListener("keydown", handleKeyDown)
      canvas.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  const handleRestart = () => {
    console.log("[v0] Restart button clicked") // Debug log
    if (gameStateRef.current?.reset) {
      gameStateRef.current.reset()
      setShowNameInput(false)
      setIsNewHighScore(false)
      setPlayerName("")
      setGameStatus({
        score: 0,
        lives: 5,
        stage: 1,
        currentHigh: highScore,
      })
    }
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    // Check if game is over and click is on restart button area
    if (gameStateRef.current?.ui?.lives === -1) {
      const buttonX = 800 / 2 - 80
      const buttonY = 1000 / 2 + 80
      const buttonW = 160
      const buttonH = 40

      if (x >= buttonX && x <= buttonX + buttonW && y >= buttonY && y <= buttonY + buttonH) {
        handleRestart()
      }
    }
  }

  const handleNameSubmit = () => {
    if (playerName.trim()) {
      const currentScore = gameStateRef.current?.ui?.score || 0
      localStorage.setItem("galaga-high-score", currentScore.toString())
      localStorage.setItem("galaga-high-score-name", playerName.trim())
      setHighScore(currentScore)
      setShowNameInput(false)
      setIsNewHighScore(false)
      setPlayerName("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNameSubmit()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-black text-white flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-xl font-bold tracking-wider text-slate-100 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700">
          SPACE SHOOTER · GALAGA VIBE
        </h1>

        <canvas
          ref={canvasRef}
          width={800}
          height={1000}
          className="border border-slate-700 rounded-2xl shadow-2xl bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ maxWidth: "100%", height: "auto" }}
          tabIndex={0}
          onClick={handleCanvasClick}
        />

        <div className="flex flex-wrap gap-3 items-center justify-center text-sm">
          <div className="px-3 py-1 border border-slate-600 rounded-full bg-slate-800/30">SCORE {gameStatus.score}</div>
          <div className="px-3 py-1 border border-slate-600 rounded-full bg-slate-800/30">LIVES {gameStatus.lives}</div>
          <div className="px-3 py-1 border border-slate-600 rounded-full bg-slate-800/30">STAGE {gameStatus.stage}</div>
          <div className="px-3 py-1 border border-slate-600 rounded-full bg-slate-800/30">
            HIGH {gameStatus.currentHigh}
          </div>
          <div className="px-3 py-1 border border-slate-600 rounded-full bg-slate-800/30 opacity-70">
            ◀ ▶ Move · SPACE/▲ Fire · P Pause
          </div>
          <button
            onClick={handleRestart}
            className="px-3 py-1 border border-slate-600 rounded-full bg-slate-800/30 hover:bg-slate-700/50 cursor-pointer"
          >
            RESTART
          </button>
        </div>

        {showNameInput && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-sm w-full mx-4">
              <h2 className="text-xl font-bold text-center mb-4 text-yellow-400">🎉 NEW HIGH SCORE! 🎉</h2>
              <p className="text-center mb-4">You scored {gameStatus.score} points!</p>
              <p className="text-center mb-4 text-sm text-slate-300">Enter your name for the leaderboard:</p>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Your name"
                maxLength={20}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleNameSubmit}
                  disabled={!playerName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-medium"
                >
                  Save Score
                </button>
                <button
                  onClick={() => {
                    setShowNameInput(false)
                    setIsNewHighScore(false)
                    setPlayerName("")
                  }}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-slate-400 text-center max-w-md">
          Single-file canvas build • no assets • optimized for v0.app
        </div>
      </div>
    </div>
  )
}
