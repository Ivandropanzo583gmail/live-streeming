import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { nanoid } from 'nanoid';
import { pool } from './database/db';
import { createTables } from './database/table';


const app = Fastify({ logger: true });

await app.register(cors, { origin: '*' });
await app.register(websocket);

interface Room {
  broadcaster?: any;
  viewers: Map<string, any>;
}
const rooms = new Map<string, Room>();

// 1. Criar uma nova live e gerar o link
app.post('/api/streams', async (request, reply) => {
  try {
    const slug = nanoid(10);
    const { rows } = await pool.query(
      'INSERT INTO streams (slug) VALUES ($1) RETURNING id, slug, created_at',
      [slug]
    );

    return reply.code(201).send({
      ...rows[0],
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/watch/${slug}`,
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({
      error: 'Erro ao criar transmissão no banco de dados',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// 2. Verificar status da live
app.get('/api/streams/:slug', async (request, reply) => {
  const { slug } = request.params as { slug: string };
  const { rows } = await pool.query('SELECT * FROM streams WHERE slug = $1', [slug]);

  if (!rows[0]) return reply.code(404).send({ error: 'Live não encontrada' });
  return rows[0];
});

// 3. WebSocket para sinalização WebRTC
app.get('/ws/:slug', { websocket: true }, (socket, req) => {
  const { slug } = req.params as { slug: string };
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role');
  const peerId = nanoid(8);

  if (!rooms.has(slug)) {
    rooms.set(slug, { viewers: new Map() });
  }
  const room = rooms.get(slug)!;

  if (role === 'broadcaster') {
    room.broadcaster = socket;
  } else {
    room.viewers.set(peerId, socket);
    room.broadcaster?.send(JSON.stringify({ type: 'viewer-joined', peerId }));
  }

  socket.on('message', (raw: Buffer) => {
    const data = JSON.parse(raw.toString());

    if (role === 'broadcaster' && data.targetPeerId) {
      const viewer = room.viewers.get(data.targetPeerId);
      viewer?.send(JSON.stringify({ ...data, peerId: 'broadcaster' }));
    } else if (role === 'viewer') {
      room.broadcaster?.send(JSON.stringify({ ...data, peerId }));
    }
  });

  socket.on('close', async () => {
    if (role === 'broadcaster') {
      room.viewers.forEach((v) => v.send(JSON.stringify({ type: 'stream-ended' })));
      rooms.delete(slug);
      await pool.query(
        'UPDATE streams SET is_live = false, ended_at = NOW() WHERE slug = $1',
        [slug]
      );
    } else {
      room.viewers.delete(peerId);
      room.broadcaster?.send(JSON.stringify({ type: 'viewer-left', peerId }));
    }
  });
});

await createTables();
await app.listen({ port: 3333, host: '0.0.0.0' });