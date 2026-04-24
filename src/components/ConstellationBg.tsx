import { useEffect, useRef } from 'react';

const JBS_NODES = [
  {x:1481.79,y:6.73,size:2.5,r:41,g:203,b:63},{x:1361.23,y:28.37,size:1.8,r:254,g:95,b:85},
  {x:75.54,y:34.53,size:1.7,r:255,g:95,b:86},{x:1145.31,y:50.40,size:1.8,r:254,g:188,b:46},
  {x:1079.34,y:54.80,size:1.7,r:255,g:191,b:48},{x:1157.80,y:62.34,size:1.8,r:8,g:240,b:248},
  {x:596.91,y:66.12,size:2.2,r:0,g:242,b:255},{x:664.49,y:66.56,size:1.7,r:40,g:202,b:63},
  {x:1449.47,y:81.49,size:2.5,r:41,g:200,b:62},{x:501.31,y:81.54,size:1.9,r:255,g:95,b:85},
  {x:1044.54,y:90.52,size:2.0,r:40,g:201,b:63},{x:1316.74,y:107.89,size:2.3,r:40,g:199,b:63},
  {x:82.12,y:112.81,size:2.2,r:3,g:241,b:254},{x:1211.21,y:128.13,size:2.2,r:253,g:96,b:86},
  {x:295.91,y:132.67,size:1.5,r:1,g:242,b:255},{x:1258.27,y:138.32,size:1.9,r:40,g:201,b:64},
  {x:528.99,y:146.04,size:1.5,r:0,g:241,b:255},{x:1246.62,y:149.44,size:1.9,r:254,g:96,b:86},
  {x:998.50,y:154.94,size:2.0,r:254,g:189,b:46},{x:820.35,y:159.07,size:1.6,r:255,g:95,b:86},
  {x:398.82,y:163.83,size:1.8,r:40,g:202,b:64},{x:1395.97,y:165.38,size:2.0,r:254,g:95,b:86},
  {x:828.79,y:182.91,size:1.9,r:40,g:200,b:62},{x:762.85,y:192.82,size:2.1,r:254,g:96,b:86},
  {x:1498.91,y:200.37,size:2.1,r:255,g:95,b:86},{x:851.00,y:207.91,size:2.2,r:0,g:242,b:255},
  {x:1004.91,y:219.31,size:2.1,r:255,g:97,b:88},{x:691.09,y:230.53,size:2.0,r:255,g:190,b:46},
  {x:163.40,y:234.88,size:1.9,r:255,g:95,b:85},{x:243.34,y:233.09,size:1.5,r:0,g:242,b:255},
  {x:1668.38,y:231.73,size:2.2,r:254,g:95,b:86},{x:530.37,y:188.07,size:2.0,r:254,g:96,b:86},
  {x:1662.28,y:282.63,size:2.2,r:254,g:95,b:86},{x:580.26,y:252.75,size:2.1,r:0,g:242,b:255},
  {x:1143.15,y:294.66,size:2.2,r:254,g:94,b:85},{x:1143.08,y:315.11,size:2.1,r:255,g:189,b:46},
  {x:1364.05,y:310.42,size:2.0,r:254,g:189,b:47},{x:1094.13,y:331.68,size:1.9,r:255,g:190,b:45},
  {x:1198.09,y:351.48,size:1.9,r:255,g:189,b:46},{x:1588.62,y:360.15,size:1.9,r:255,g:190,b:48},
  {x:1442.97,y:361.13,size:1.7,r:40,g:200,b:63},{x:1724.89,y:363.38,size:2.4,r:255,g:94,b:85},
  {x:1356.96,y:365.52,size:1.4,r:2,g:241,b:254},{x:280.02,y:381.29,size:1.3,r:255,g:190,b:45},
  {x:1234.11,y:394.41,size:2.5,r:251,g:189,b:46},{x:967.99,y:395.02,size:2.2,r:255,g:95,b:87},
  {x:1115.94,y:435.80,size:2.4,r:0,g:239,b:252},{x:884.98,y:435.00,size:1.5,r:254,g:97,b:88},
  {x:1240.47,y:438.05,size:2.5,r:39,g:201,b:63},{x:825.47,y:456.38,size:1.8,r:0,g:242,b:255},
  {x:1570.07,y:457.39,size:2.0,r:40,g:201,b:63},{x:553.34,y:459.69,size:1.7,r:39,g:203,b:65},
  {x:1158.43,y:614.23,size:1.9,r:254,g:94,b:85},{x:1635.73,y:629.15,size:2.1,r:255,g:190,b:47},
  {x:579.68,y:636.16,size:2.0,r:0,g:242,b:254},{x:756.24,y:657.81,size:2.1,r:255,g:95,b:87},
  {x:1043.74,y:660.61,size:2.1,r:42,g:201,b:64},{x:1547.91,y:667.32,size:2.1,r:254,g:189,b:45},
  {x:939.68,y:671.14,size:1.9,r:41,g:202,b:65},{x:1038.38,y:672.04,size:1.9,r:253,g:190,b:46},
  {x:162.39,y:678.04,size:1.6,r:254,g:95,b:85},{x:1452.17,y:688.40,size:1.8,r:0,g:242,b:254},
  {x:434.08,y:689.07,size:1.7,r:0,g:243,b:255},{x:1215.04,y:708.39,size:1.9,r:255,g:95,b:86},
  {x:1520.57,y:714.71,size:2.1,r:4,g:241,b:253},{x:144.31,y:716.45,size:1.6,r:39,g:200,b:63},
  {x:656.18,y:718.33,size:1.8,r:255,g:188,b:45},{x:572.48,y:723.27,size:1.8,r:39,g:202,b:64},
  {x:1179.50,y:728.13,size:2.0,r:255,g:189,b:46},{x:743.30,y:732.24,size:1.9,r:255,g:188,b:46},
  {x:1609.34,y:737.23,size:1.8,r:40,g:201,b:65},{x:105.53,y:747.48,size:1.9,r:255,g:95,b:86},
  {x:1516.13,y:750.41,size:2.0,r:8,g:237,b:247},{x:284.24,y:756.06,size:1.8,r:255,g:189,b:45},
  {x:331.93,y:756.13,size:2.0,r:255,g:189,b:46},{x:1463.18,y:757.22,size:1.7,r:255,g:97,b:88},
  {x:743.09,y:769.18,size:1.9,r:40,g:202,b:63},{x:118.07,y:777.30,size:1.5,r:1,g:241,b:254},
];

const EXTRA_COLORS: [number, number, number][] = [
  [0,242,255],[40,202,63],[255,95,85],[255,189,46],
  [8,237,247],[39,200,62],[254,94,84],[254,188,45],
];

const SRC_W = 1759;
const SRC_H = 800;

interface NodeDef {
  x: number; y: number; size: number; r: number; g: number; b: number;
}

interface AnimNode extends NodeDef {
  hx: number; hy: number;
  orbitR: number;
  sX: number; sY: number;
  pX: number; pY: number;
  pulse: number;
}

export function ConstellationBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;

    // Add 70 random fill nodes to boost density
    const extra: NodeDef[] = Array.from({ length: 70 }, () => {
      const c = EXTRA_COLORS[Math.floor(Math.random() * EXTRA_COLORS.length)];
      return {
        x: Math.random() * SRC_W,
        y: Math.random() * SRC_H,
        size: Math.random() * 1.0 + 0.7,
        r: c[0], g: c[1], b: c[2],
      };
    });

    const allNodes: NodeDef[] = [...JBS_NODES, ...extra];

    function resize() {
      if (!canvas) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Build animated node objects
    const nodes: AnimNode[] = allNodes.map(n => {
      const sx = (canvas?.width ?? window.innerWidth) / SRC_W;
      const sy = (canvas?.height ?? window.innerHeight) / SRC_H;
      return {
        ...n,
        hx: n.x * sx, hy: n.y * sy,
        x:  n.x * sx, y:  n.y * sy,
        orbitR: 8 + Math.random() * 22,
        sX: (0.15 + Math.random() * 0.25) * (Math.random() < 0.5 ? 1 : -1),
        sY: (0.15 + Math.random() * 0.25) * (Math.random() < 0.5 ? 1 : -1),
        pX: Math.random() * Math.PI * 2,
        pY: Math.random() * Math.PI * 2,
        pulse: Math.random() * Math.PI * 2,
      };
    });

    let t = 0;

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const scaleX = w / SRC_W;

      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);

      t += 0.012;

      // Sinusoidal orbit
      nodes.forEach(n => {
        n.x = n.hx + Math.sin(t * n.sX + n.pX) * n.orbitR;
        n.y = n.hy + Math.cos(t * n.sY + n.pY) * n.orbitR;
        n.pulse += 0.04;
      });

      // Connection lines
      const connDist  = 145 * scaleX;
      const connDist2 = connDist * connDist;
      ctx.lineWidth = 0.55;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < connDist2) {
            const d  = Math.sqrt(d2);
            const a  = (1 - d / connDist) * 0.65;
            const mr = (nodes[i].r + nodes[j].r) >> 1;
            const mg = (nodes[i].g + nodes[j].g) >> 1;
            const mb = (nodes[i].b + nodes[j].b) >> 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(${mr},${mg},${mb},${a})`;
            ctx.stroke();
          }
        }
      }

      // Nodes with radial glow
      nodes.forEach(n => {
        const p   = Math.sin(n.pulse) * 0.3 + 0.7;
        const dot = n.size * p;
        const al  = 0.7 + p * 0.3;

        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, dot * 6);
        grd.addColorStop(0,   `rgba(${n.r},${n.g},${n.b},${al * 0.7})`);
        grd.addColorStop(0.3, `rgba(${n.r},${n.g},${n.b},${al * 0.15})`);
        grd.addColorStop(1,   `rgba(${n.r},${n.g},${n.b},0)`);

        ctx.beginPath();
        ctx.arc(n.x, n.y, dot * 6, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, dot, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${n.r},${n.g},${n.b},${al})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} id="constellation-canvas" />;
}
