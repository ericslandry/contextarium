// Adaptive grid, parallax dust and camera arc adapted from the legacy Spatial Explainer viewer.
export function planFlight(from, to) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const scaleJump = Math.abs(Math.log(to.zoom / from.zoom));
  return {
    duration: 1000 * Math.min(2.6, Math.max(1.25, 1.1 + scaleJump * 0.75 + distance / 8500)),
    arc: distance > 1800 || scaleJump > 0.3,
  };
}

export function interpolateCamera(from, to, progress, arc, minZoom) {
  const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
  const logZoom = Math.log(from.zoom) + Math.log(to.zoom / from.zoom) * eased;
  const dip = arc ? 0.55 * Math.sin(eased * Math.PI) : 0;
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    zoom: Math.max(minZoom, Math.exp(logZoom - dip)),
  };
}

const wrap = (value, period) => ((value % period) + period) % period;

export function createBackdrop(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  let seed = 2463534242;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const dust = Array.from({ length: 120 }, () => ({
    x: random(), y: random(), depth: 0.2 + random() * 0.65,
    opacity: 0.14 + random() * 0.27, radius: 0.65 + random() * 1.15,
  }));
  let previous;

  function grid(width, height, originX, originY, spacing, opacity, ratio) {
    if (opacity <= 0) return;
    const align = coordinate => (Math.floor(coordinate * ratio) + 0.5) / ratio;
    context.strokeStyle = `rgba(40, 51, 70, ${opacity})`;
    context.lineWidth = 1 / ratio;
    context.beginPath();
    for (let x = wrap(originX, spacing); x < width; x += spacing) {
      const pixel = align(x);
      context.moveTo(pixel, 0);
      context.lineTo(pixel, height);
    }
    for (let y = wrap(originY, spacing); y < height; y += spacing) {
      const pixel = align(y);
      context.moveTo(0, pixel);
      context.lineTo(width, pixel);
    }
    context.stroke();
  }

  return (camera, width, height, translateX, translateY, flying, reducedMotion) => {
    if (!width || !height) return;
    const ratio = Math.min(2, devicePixelRatio || 1);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    // Fade between powers of two while keeping the grid anchored in world space.
    const level = Math.log2(90 / camera.zoom);
    const fine = 2 ** Math.floor(level) * camera.zoom;
    const blend = level - Math.floor(level);
    grid(width, height, translateX, translateY, fine, 0.61 * (1 - blend), ratio);
    grid(width, height, translateX, translateY, fine * 2, 0.61 * blend, ratio);

    const vx = previous ? (camera.x - previous.x) * camera.zoom : 0;
    const vy = previous ? (camera.y - previous.y) * camera.zoom : 0;
    const speed = Math.hypot(vx, vy);
    const streak = flying && !reducedMotion && speed > 3;
    const length = streak ? Math.min(0.32, 18 / speed) : 0;
    const count = Math.min(dust.length, Math.round(28 + width * height / 14500));
    for (let i = 0; i < count; i++) {
      const { x, y, depth, radius, opacity } = dust[i];
      const parallax = reducedMotion ? 0 : camera.zoom * 0.08 * depth;
      const px = wrap(x * width - camera.x * parallax, width);
      const py = wrap(y * height - camera.y * parallax, height);
      context.beginPath();
      if (streak) {
        context.strokeStyle = `rgba(240, 180, 76, ${opacity * 0.78})`;
        context.lineWidth = radius;
        context.moveTo(px, py);
        context.lineTo(px + vx * length * depth, py + vy * length * depth);
        context.stroke();
      } else {
        context.fillStyle = `rgba(236, 229, 214, ${opacity})`;
        context.arc(px, py, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
    previous = { x: camera.x, y: camera.y };
  };
}
