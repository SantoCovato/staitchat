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

function toggleMenu() { document.getElementById('fab-menu').classList.toggle('hidden'); }

function mostraQR() {
    toggleMenu();
    document.getElementById('qr-modal').classList.remove('hidden');
    if(document.getElementById('qrcode').innerHTML === "") {
        new QRCode(document.getElementById("qrcode"), { text: mioID, width: 150, height: 150 });
    }
}

function promptAggiungi() {
    toggleMenu();
    const id = prompt("Inserisci l'ID dell'amico:");
    if (id) { salvaContatto(id); apriChat(id); }
}

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
    conn.on('data', (data) => { salvaEVisualizza(conn.peer, data, 'lui'); });
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
    document.getElementById('chat-title').innerText = id;
    document.getElementById('chat-area').classList.add('active');
    if (!connessioni[id]) { setupConnessione(peer.connect(id, { reliable: true })); }
    const container = document.getElementById('messages');
    container.innerHTML = (messaggi[id] || []).map(m => `<div class="msg ${m.tipo}">${m.testo}</div>`).join('');
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
    const input = document.getElementById('msg-input');
    if (!chatAttiva || !input.value) return;
    connessioni[chatAttiva].send(input.value);
    salvaEVisualizza(chatAttiva, input.value, 'io');
    input.value = "";
}

document.getElementById("msg-input").addEventListener("keypress", (e) => { if (e.key === "Enter") invia(); });
