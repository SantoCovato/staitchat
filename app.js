let mioID = localStorage.getItem('mio-peer-id');
let contatti = JSON.parse(localStorage.getItem('contatti') || '[]');
let messaggi = JSON.parse(localStorage.getItem('storico-messaggi') || '{}');
let connessioni = {}; 
let chatAttiva = null;

const peer = new Peer(mioID, { host: '0.peerjs.com', port: 443, secure: true, key: 'peerjs' });

peer.on('open', (id) => {
    if (!mioID) { localStorage.setItem('mio-peer-id', id); mioID = id; }
    document.getElementById('my-id').innerText = id;
    renderListaContatti();
});

peer.on('connection', (conn) => {
    salvaContatto(conn.peer);
    setupConnessione(conn);
});

function salvaContatto(id) {
    if (!contatti.includes(id)) {
        contatti.push(id);
        localStorage.setItem('contatti', JSON.stringify(contatti));
        renderListaContatti();
    }
}

function setupConnessione(conn) {
    connessioni[conn.peer] = conn;
    conn.on('data', (data) => {
        salvaEVisualizza(conn.peer, data, 'lui');
    });
}

function aggiungiContatto() {
    const id = document.getElementById('target-id').value;
    if (!id) return;
    salvaContatto(id);
    apriChat(id);
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
    
    // Attiva la visualizzazione chat su mobile
    document.getElementById('chat-area').classList.add('active');
    
    if (!connessioni[id]) {
        let conn = peer.connect(id, { reliable: true });
        setupConnessione(conn);
    }
    
    const msgs = messaggi[id] || [];
    const container = document.getElementById('messages');
    container.innerHTML = msgs.map(m => `<div class="msg ${m.tipo}">${m.testo}</div>`).join('');
    container.scrollTop = container.scrollHeight;
}

function chiudiChat() {
    document.getElementById('chat-area').classList.remove('active');
    chatAttiva = null;
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
    
    if (connessioni[chatAttiva] && connessioni[chatAttiva].open) {
        connessioni[chatAttiva].send(testo);
        salvaEVisualizza(chatAttiva, testo, 'io');
        input.value = "";
    } else {
        alert("Destinatario non raggiungibile, attendi...");
    }
}

document.getElementById("msg-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") invia();
});
