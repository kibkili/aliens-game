import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

/* ---------- Constantes ---------- */
const W = 480
const H = 640
const P = 3 // tamaño de cada "pixel" de los sprites
const COLS = 8
const ROWS = 5
const CELL_W = 46
const CELL_H = 38
const GROUND = H - 34
const MIN_Y = 300 // límite superior de la nave
const MAX_Y = H - 64 // límite inferior de la nave

const C = {
  skyTop: '#0d0a26',
  skyBottom: '#34124a',
  glow: 'rgba(255, 94, 126, 0.38)',
  ship: '#5ef2d6',
  shot: '#eafffa',
  bomb: '#ff9f5a',
}

const SPRITES = {
  squid: [
    ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '..X..X..', '.X.XX.X.', 'X.X..X.X'],
    ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X.XX.X.', 'X......X', '.X....X.'],
  ],
  crab: [
    ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'],
    ['..X.....X..', 'X..X...X..X', 'X.XXXXXXX.X', 'XXX.XXX.XXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..X.....X..', '.X.......X.'],
  ],
  octo: [
    ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '...XX..XX...', '..XX.XX.XX..', 'XX........XX'],
    ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '..XXX..XXX..', '.XX..XX..XX.', '..XX....XX..'],
  ],
}

const SHIP = [
  '......X......',
  '.....XXX.....',
  '....XXXXX....',
  '.XX.XXXXX.XX.',
  'XXXXXXXXXXXXX',
  'XXXXXXXXXXXXX',
  'XX.XXXXXXX.XX',
  'X....XXX....X',
]

const TYPES = [
  { sprite: 'squid', color: '#ff6b9d', points: 30 },
  { sprite: 'crab', color: '#b79cff', points: 20 },
  { sprite: 'crab', color: '#b79cff', points: 20 },
  { sprite: 'octo', color: '#ffc857', points: 10 },
  { sprite: 'octo', color: '#ffc857', points: 10 },
]

/* ---------- Utilidades ---------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const rand = (a, b) => a + Math.random() * (b - a)
const pad = (n) => String(n).padStart(5, '0')

function drawSprite(ctx, rows, x, y, color) {
  ctx.fillStyle = color
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] === 'X') ctx.fillRect(x + c * P, y + r * P, P, P)
    }
  }
}

function newWave(level) {
  const aliens = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) aliens.push({ r, c, alive: true })
  }
  return {
    aliens,
    fx: (W - COLS * CELL_W) / 2,
    fy: 70 + Math.min(level - 1, 5) * 12,
    dir: 1,
    stepTimer: 0,
    frame: 0,
  }
}

function initGame() {
  return {
    score: 0,
    lives: 3,
    level: 1,
    player: { x: W / 2, y: H - 64, cool: 0, inv: 0 },
    bullets: [],
    bombs: [],
    particles: [],
    shootTimer: 1.2,
    shake: 0,
    ...newWave(1),
  }
}

function burst(s, x, y, color, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = rand(40, 180)
    s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.4, 0.8), color })
  }
}

function ShipIcon() {
  return (
    <svg viewBox="0 0 13 8" width="22" height="14" aria-hidden="true">
      <polygon points="6.5,0 9,3 11,3 13,5 13,8 0,8 0,5 2,3 4,3" />
    </svg>
  )
}

/* ---------- Componente ---------- */
export default function App() {
  const canvasRef = useRef(null)
  const g = useRef(initGame())
  const keys = useRef({ left: false, right: false, up: false, down: false, fire: false })
  const statusRef = useRef('idle')
  const stars = useRef(
    Array.from({ length: 70 }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      r: Math.random() < 0.2 ? 2 : 1,
      sp: rand(6, 30),
      ph: rand(0, 6),
    })),
  )

  const [status, setStatusState] = useState('idle') // idle | playing | paused | over
  const [hud, setHud] = useState({ score: 0, lives: 3, level: 1 })
  const [best, setBest] = useState(() => {
    try {
      return Number(localStorage.getItem('invasion-best')) || 0
    } catch {
      return 0
    }
  })

  const setStatus = useCallback((v) => {
    statusRef.current = v
    setStatusState(v)
  }, [])

  const start = useCallback(() => {
    g.current = initGame()
    keys.current = { left: false, right: false, up: false, down: false, fire: false }
    setHud({ score: 0, lives: 3, level: 1 })
    setStatus('playing')
  }, [setStatus])

  const togglePause = useCallback(() => {
    if (statusRef.current === 'playing') setStatus('paused')
    else if (statusRef.current === 'paused') setStatus('playing')
  }, [setStatus])

  /* Teclado */
  useEffect(() => {
    const down = (e) => {
      const k = e.key
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault()
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.current.left = true
      if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.current.right = true
      if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.current.up = true
      if (k === 'ArrowDown' || k === 's' || k === 'S') keys.current.down = true
      if (k === ' ') {
        keys.current.fire = true
        if (statusRef.current === 'idle' || statusRef.current === 'over') start()
      }
      if (k === 'Enter' && (statusRef.current === 'idle' || statusRef.current === 'over')) start()
      if ((k === 'p' || k === 'P' || k === 'Escape') && !e.repeat) togglePause()
    }
    const up = (e) => {
      const k = e.key
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.current.left = false
      if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.current.right = false
      if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.current.up = false
      if (k === 'ArrowDown' || k === 's' || k === 'S') keys.current.down = false
      if (k === ' ') keys.current.fire = false
    }
    const blur = () => {
      if (statusRef.current === 'playing') setStatus('paused')
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [start, togglePause, setStatus])

  /* Motor del juego */
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.imageSmoothingEnabled = false
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const gameOver = () => {
      const score = g.current.score
      setBest((prev) => {
        const nb = Math.max(prev, score)
        try {
          localStorage.setItem('invasion-best', String(nb))
        } catch {
          /* sin almacenamiento */
        }
        return nb
      })
      setStatus('over')
    }

    const update = (dt) => {
      const s = g.current
      const k = keys.current
      const p = s.player
      const alienX = (a) => s.fx + a.c * CELL_W + CELL_W / 2
      const alienY = (a) => s.fy + a.r * CELL_H

      const hitPlayer = () => {
        s.lives -= 1
        burst(s, p.x, p.y, C.ship, 26)
        s.shake = 0.4
        p.inv = 2
        s.bombs = []
        setHud({ score: s.score, lives: s.lives, level: s.level })
        if (s.lives <= 0) {
          gameOver()
          return true
        }
        return false
      }

      // Nave del jugador
      const dir = (k.left ? -1 : 0) + (k.right ? 1 : 0)
      p.x = clamp(p.x + dir * 290 * dt, 30, W - 30)
      const vdir = (k.down ? 1 : 0) + (k.up ? -1 : 0)
      p.y = clamp(p.y + vdir * 240 * dt, MIN_Y, MAX_Y)
      p.cool -= dt
      p.inv = Math.max(0, p.inv - dt)
      if (k.fire && p.cool <= 0 && s.bullets.length < 2) {
        s.bullets.push({ x: p.x, y: p.y - 18 })
        p.cool = 0.32
      }

      // Disparos del jugador
      s.bullets.forEach((b) => (b.y -= 560 * dt))
      s.bullets = s.bullets.filter((b) => b.y > -12)

      // Movimiento del grupo de aliens
      const alive = s.aliens.filter((a) => a.alive)
      s.stepTimer += dt
      const interval = Math.max(
        0.05,
        (0.08 + 0.75 * (alive.length / (COLS * ROWS))) * (1 - Math.min(s.level - 1, 6) * 0.07),
      )
      if (s.stepTimer >= interval && alive.length) {
        s.stepTimer = 0
        s.frame ^= 1
        const minC = Math.min(...alive.map((a) => a.c))
        const maxC = Math.max(...alive.map((a) => a.c))
        const left = s.fx + minC * CELL_W + 5
        const right = s.fx + maxC * CELL_W + CELL_W - 5
        const step = 10
        if ((s.dir > 0 && right + step > W - 10) || (s.dir < 0 && left - step < 10)) {
          s.dir *= -1
          s.fy += 18
        } else {
          s.fx += step * s.dir
        }
      }

      // Colisión: disparo contra alien
      for (const b of s.bullets) {
        for (const a of alive) {
          if (!a.alive) continue
          if (Math.abs(b.x - alienX(a)) < 18 && Math.abs(b.y - alienY(a)) < 12) {
            a.alive = false
            b.y = -100
            const t = TYPES[a.r]
            s.score += t.points
            burst(s, alienX(a), alienY(a), t.color)
            setHud({ score: s.score, lives: s.lives, level: s.level })
            break
          }
        }
      }

      // Los aliens disparan
      s.shootTimer -= dt
      const stillAlive = s.aliens.filter((a) => a.alive)
      if (s.shootTimer <= 0 && stillAlive.length && s.bombs.length < 3 + s.level) {
        const pick = stillAlive[Math.floor(Math.random() * stillAlive.length)]
        const shooter = stillAlive
          .filter((a) => a.c === pick.c)
          .reduce((m, a) => (a.r > m.r ? a : m), pick)
        s.bombs.push({ x: alienX(shooter), y: alienY(shooter) + 14, t: 0 })
        s.shootTimer = rand(0.5, 1.1) * Math.max(0.45, 1 - (s.level - 1) * 0.08)
      }

      // Bombas enemigas
      const bombSpeed = 190 + s.level * 14
      for (const b of s.bombs) {
        b.y += bombSpeed * dt
        b.t += dt
        if (p.inv <= 0 && Math.abs(b.x - p.x) < 20 && Math.abs(b.y - p.y) < 14) {
          b.y = H + 100
          if (hitPlayer()) return
          break
        }
      }
      s.bombs = s.bombs.filter((b) => b.y < H + 20)

      // Chocar contra un alien también cuesta una vida
      if (
        p.inv <= 0 &&
        stillAlive.some((a) => Math.abs(alienX(a) - p.x) < 28 && Math.abs(alienY(a) - p.y) < 22)
      ) {
        if (hitPlayer()) return
      }

      // Los aliens llegan al suelo
      if (stillAlive.some((a) => alienY(a) + 12 >= GROUND - 40)) {
        s.lives = 0
        burst(s, p.x, p.y, C.ship, 30)
        setHud({ score: s.score, lives: 0, level: s.level })
        gameOver()
        return
      }

      // Oleada completada
      if (stillAlive.length === 0) {
        s.level += 1
        s.score += 100
        s.bullets = []
        s.bombs = []
        Object.assign(s, newWave(s.level))
        setHud({ score: s.score, lives: s.lives, level: s.level })
      }

      // Partículas
      s.particles.forEach((q) => {
        q.x += q.vx * dt
        q.y += q.vy * dt
        q.life -= dt
      })
      s.particles = s.particles.filter((q) => q.life > 0)
      s.shake = Math.max(0, s.shake - dt)
    }

    const moveStars = (dt) => {
      stars.current.forEach((st) => {
        st.y += st.sp * dt
        if (st.y > H) {
          st.y = 0
          st.x = rand(0, W)
        }
      })
    }

    const draw = (t) => {
      const s = g.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // Cielo
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, C.skyTop)
      sky.addColorStop(1, C.skyBottom)
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      // Resplandor del horizonte
      const glow = ctx.createRadialGradient(W / 2, H + 60, 20, W / 2, H + 60, 400)
      glow.addColorStop(0, C.glow)
      glow.addColorStop(1, 'rgba(255, 94, 126, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, W, H)

      // Estrellas
      stars.current.forEach((st) => {
        ctx.globalAlpha = 0.45 + 0.4 * Math.sin(t * 2 + st.ph)
        ctx.fillStyle = '#f4ecff'
        ctx.fillRect(st.x, st.y, st.r, st.r)
      })
      ctx.globalAlpha = 1

      ctx.save()
      if (s.shake > 0 && !reduceMotion) ctx.translate(rand(-4, 4), rand(-4, 4))

      // Suelo
      ctx.fillStyle = 'rgba(94, 242, 214, 0.55)'
      ctx.fillRect(0, GROUND, W, 2)

      // Aliens
      for (const a of s.aliens) {
        if (!a.alive) continue
        const type = TYPES[a.r]
        const rows = SPRITES[type.sprite][s.frame]
        const w = rows[0].length * P
        const x = s.fx + a.c * CELL_W + CELL_W / 2 - w / 2
        const y = s.fy + a.r * CELL_H - 12
        ctx.shadowColor = type.color
        ctx.shadowBlur = 10
        drawSprite(ctx, rows, x, y, type.color)
      }
      ctx.shadowBlur = 0

      // Nave del jugador
      const p = s.player
      const showShip = !(p.inv > 0 && Math.floor(t * 12) % 2 === 0) && !(s.lives <= 0)
      if (showShip) {
        ctx.shadowColor = C.ship
        ctx.shadowBlur = 14
        drawSprite(ctx, SHIP, p.x - (SHIP[0].length * P) / 2, p.y - 12, C.ship)
        ctx.shadowBlur = 0
        ctx.fillStyle = '#ffc857'
        ctx.fillRect(p.x - 3, p.y + 13, 6, 3 + Math.floor(Math.random() * 4))
      }

      // Disparos
      ctx.shadowColor = C.shot
      ctx.shadowBlur = 10
      ctx.fillStyle = C.shot
      s.bullets.forEach((b) => ctx.fillRect(b.x - 1.5, b.y - 8, 3, 14))
      ctx.shadowColor = C.bomb
      ctx.fillStyle = C.bomb
      s.bombs.forEach((b) => {
        for (let i = 0; i < 4; i++) {
          const off = Math.sin(b.t * 18 + i * 1.4) * 3
          ctx.fillRect(b.x - 1.5 + off, b.y - 8 + i * 4, 3, 4)
        }
      })
      ctx.shadowBlur = 0

      // Partículas
      s.particles.forEach((q) => {
        ctx.globalAlpha = clamp(q.life / 0.8, 0, 1)
        ctx.fillStyle = q.color
        ctx.fillRect(q.x, q.y, 3, 3)
      })
      ctx.globalAlpha = 1

      ctx.restore()
    }

    let last = performance.now()
    let raf
    const loop = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      if (statusRef.current === 'playing') update(dt)
      if (statusRef.current !== 'paused') moveStars(dt)
      draw(now / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [setStatus])

  /* Controles táctiles */
  const hold = (name) => ({
    onPointerDown: (e) => {
      e.preventDefault()
      keys.current[name] = true
    },
    onPointerUp: () => (keys.current[name] = false),
    onPointerLeave: () => (keys.current[name] = false),
    onPointerCancel: () => (keys.current[name] = false),
    onContextMenu: (e) => e.preventDefault(),
  })

  return (
    <main className="shell">
      <header className="hud">
        <div className="stat">
          <span className="stat-label">Puntos</span>
          <b className="stat-value">{pad(hud.score)}</b>
        </div>
        <div className="stat">
          <span className="stat-label">Récord</span>
          <b className="stat-value">{pad(Math.max(best, hud.score))}</b>
        </div>
        <div className="stat">
          <span className="stat-label">Oleada</span>
          <b className="stat-value">{hud.level}</b>
        </div>
        <div className="lives" aria-label={`Vidas: ${hud.lives}`}>
          {Array.from({ length: Math.max(hud.lives, 0) }, (_, i) => (
            <ShipIcon key={i} />
          ))}
        </div>
      </header>

      <div className="stage">
        <canvas ref={canvasRef} className="canvas" aria-label="Pantalla del juego" />

        {status !== 'playing' && (
          <div className="overlay">
            {status === 'idle' && (
              <>
                <h1 className="title">Invasión alien</h1>
                <p className="lead">Destruye la flota antes de que toque el suelo.</p>
                <button className="btn" onClick={start}>Empezar partida</button>
              </>
            )}
            {status === 'paused' && (
              <>
                <h2 className="title small">En pausa</h2>
                <button className="btn" onClick={togglePause}>Continuar</button>
              </>
            )}
            {status === 'over' && (
              <>
                <h2 className="title small">Fin de la partida</h2>
                <p className="lead">
                  Hiciste <b>{hud.score}</b> puntos y llegaste a la oleada {hud.level}.
                </p>
                <button className="btn" onClick={start}>Jugar otra vez</button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="touch">
        <button className="pad" {...hold('left')} aria-label="Mover a la izquierda">◀</button>
        <button className="pad" {...hold('up')} aria-label="Mover hacia arriba">▲</button>
        <button className="pad" {...hold('down')} aria-label="Mover hacia abajo">▼</button>
        <button className="pad" {...hold('right')} aria-label="Mover a la derecha">▶</button>
        <button className="pad fire" {...hold('fire')} aria-label="Disparar">Disparar</button>
      </div>

      <p className="hint">
        <span><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> mover</span>
        <span><kbd>Espacio</kbd> disparar</span>
        <span><kbd>P</kbd> pausar</span>
      </p>
    </main>
  )
}