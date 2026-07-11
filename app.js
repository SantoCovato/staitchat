let mioID = localStorage.getItem('mio-peer-id');
let contatti = JSON.parse(localStorage.getItem('contatti') || '[]');
let messaggi = JSON.parse(localStorage.getItem('storico-messaggi') || '{}');
let chatAttiva = null;

const peer = new Peer(mioID, { host: '0.peerjs.com', port: 443, secure: true, key: 'peerjs' });

peer.on('open', (id) => {
    if (!mioID) { localStorage.setItem('mio-peer-id', id); mioID = id; }
    document.getElementById('my-id').innerText = id;
    renderListaContatti();
});

// Ricezione messaggi da altri
peer.on('connection', (conn) => {
    setupConnessione(conn);
});

function setupConnessione(conn) {
    conn.on('data', (data) => {
        salvaEVisualizza(conn.peer, "Lui: " + data, 'lui');
    });
}

function aggiungiContatto() {
    const id = document.getElementById('target-id').value;
    if (id && !contatti.includes(id)) {
        contatti.push(id);
        localStorage.setItem('contatti', JSON.stringify(contatti));
        renderListaContatti();
    }
}

function renderListaContatti() {
    const list = document.getElementById('lista-contatti');
    list.innerHTML = '';
    contatti.forEach(id => {
        list.innerHTML += `<div class="contatto" onclick="apriChat('${id}')">${id}</div>`;
    });
}

function apriChat(id) {
    chatAttiva = id;
    document.getElementById('chat-title').innerText = "Chat con: " + id;
    const msgs = messaggi[id] || [];
    const container = document.getElementById('messages');
    container.innerHTML = msgs.map(m => `<div class="msg ${m.tipo}">${m.testo}</div>`).join('');
    container.scrollTop = container.scrollHeight;
}

function salvaEVisualizza(id, testo, tipo) {
    if (!messaggi[id]) messaggi[id] = [];
    messaggi[id].push({testo, tipo});
    localStorage.setItem('storico-messaggi', JSON.stringify(messaggi));
    if (chatAttiva === id) apriChat(id);
}

function invia() {
    if (!chatAttiva) return alert("Seleziona una chat!");
    const input = document.getElementById('msg-input');
    const testo = input.value;
    
    // Tentiamo la connessione
    const conn = peer.connect(chatAttiva, { reliable: true });
    conn.on('open', () => {
        conn.send(testo);
        salvaEVisualizza(chatAttiva, "Io: " + testo, 'io');
        input.value = "";
    });
    conn.on('error', (err) => alert("Impossibile connettersi: l'utente è offline"));
}

// Invio con tasto Invio
document.getElementById("msg-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") invia();
});
