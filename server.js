const WebSocket = require('ws');
const PORT = process.env.PORT || 9001;

function randPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const clients = new Map();
const rooms   = new Map();
const nicks   = new Map();

const wss = new WebSocket.Server({ port: PORT });
console.log('CAC Chatt Server lyssnar på port ' + PORT);

wss.on('connection', (ws) => {
  const pin = randPin();
  clients.set(ws, pin);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      const type = msg.type;

      if (type === 'auth') {
        nicks.set(ws, msg.nickname || 'Anonym');
        ws.send(JSON.stringify({ type: 'auth_ok', pin, nickname: msg.nickname }));
      }
      else if (type === 'create_room') {
        const code = randPin();
        rooms.set(ws, code);
        ws.send(JSON.stringify({ type: 'room_created', room_id: code, room_name: msg.room_name, access_code: code }));
      }
      else if (type === 'join_room') {
        const code = msg.access_code;
        rooms.set(ws, code);
        ws.send(JSON.stringify({ type: 'room_joined', room_id: code, room_name: code, members: '2' }));
        broadcast(code, { type: 'user_joined', nickname: nicks.get(ws) || 'Anonym', pin }, ws);
      }
      else if (type === 'message') {
        const room = rooms.get(ws);
        if (room) {
          broadcast(room, {
            type: 'message',
            from_pin: pin,
            from_nick: nicks.get(ws) || 'Anonym',
            content: msg.content,
            iv: msg.iv,
            timestamp: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
          });
        }
      }
      else if (type === 'file_init') {
        const room = rooms.get(ws);
        if (room) {
          broadcast(room, {
            type: 'file_incoming',
            transfer_id: msg.transfer_id || randPin(),
            filename: msg.filename,
            mime_type: msg.mime_type,
            size: msg.size,
            from_pin: pin,
            from_nick: nicks.get(ws) || 'Anonym',
            timestamp: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
          }, ws);
        }
      }
      else if (type === 'file_chunk') {
        const room = rooms.get(ws);
        if (room) broadcast(room, msg, ws);
      }
      else if (type === 'file_complete') {
        const room = rooms.get(ws);
        if (room) broadcast(room, msg, ws);
      }
      // Video samtal
      else if (type === 'video_offer') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'video_offer', offer: msg.offer, from_pin: pin }, ws);
      }
      else if (type === 'video_answer') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'video_answer', answer: msg.answer, from_pin: pin }, ws);
      }
      else if (type === 'video_end') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'video_end', from_pin: pin }, ws);
      }
      else if (type === 'ice_candidate') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'ice_candidate', candidate: msg.candidate, from_pin: pin }, ws);
      }
      // Fjärrstyrning signaling
      else if (type === 'remote_request') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_request', code: msg.code, from_pin: pin }, ws);
      }
      else if (type === 'remote_approved') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_approved', from_pin: pin }, ws);
      }
      else if (type === 'remote_denied') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_denied', from_pin: pin }, ws);
      }
      else if (type === 'remote_offer') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_offer', offer: msg.offer, from_pin: pin }, ws);
      }
      else if (type === 'remote_answer') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_answer', answer: msg.answer, from_pin: pin }, ws);
      }
      else if (type === 'remote_ice') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_ice', candidate: msg.candidate, from_pin: pin }, ws);
      }
      else if (type === 'remote_end') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_end', from_pin: pin }, ws);
      }
      // Fjärrstyrning mus/tangentbord
      else if (type === 'remote_mouse_move') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_mouse_move', x: msg.x, y: msg.y }, ws);
      }
      else if (type === 'remote_mouse_click') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_mouse_click', x: msg.x, y: msg.y, button: msg.button }, ws);
      }
      else if (type === 'remote_mouse_dblclick') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_mouse_dblclick', x: msg.x, y: msg.y }, ws);
      }
      else if (type === 'remote_mouse_scroll') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_mouse_scroll', x: msg.x, y: msg.y }, ws);
      }
      else if (type === 'remote_key_press') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_key_press', key: msg.key, modifier: msg.modifier }, ws);
      }
      else if (type === 'remote_type_text') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_type_text', text: msg.text }, ws);
      }
      else if (type === 'remote_screen_size') {
        const room = rooms.get(ws);
        if (room) broadcast(room, { type: 'remote_screen_size', width: msg.width, height: msg.height }, ws);
      }
      else if (type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }

    } catch (e) {}
  });

  ws.on('close', () => {
    const room = rooms.get(ws);
    if (room) {
      broadcast(room, { type: 'user_left', pin, nickname: nicks.get(ws) || 'Anonym' }, ws);
    }
    clients.delete(ws);
    rooms.delete(ws);
    nicks.delete(ws);
  });
});

function broadcast(room, msg, skip = null) {
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && rooms.get(client) === room && client !== skip) {
      client.send(data);
    }
  });
}
