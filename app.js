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

function formattaData(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function formattaGiorno(ts) { return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' }); }

function toggleMenu() { document.getElementById('fab-menu').classList.toggle('hidden'); }

function mostraQR() {
    toggleMenu();
    document.getElementById('qr-modal').classList.remove('hidden');
    const qrDiv = document.getElementById("qrcode");
    if(qrDiv.innerHTML === "") { new QRCode(qrDiv, { text: mioID, width: 150, height: 150 }); }
}

function promptAggiungi() {
    toggleMenu();
    document.getElementById('add-modal').classList.remove('hidden');
}

function confermaAggiungi() {
    const id = document.getElementById('target-id-input').value;
    if (id) {
        salvaContatto(id);
        apriChat(id);
        document.getElementById('add-modal').classList.add('hidden');
        document.getElementById('target-id-input').value = "";
    }
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
    
    // Connessione robusta: se non esiste o non è aperta, riprova
    if (!connessioni[id] || !connessioni[id].open) {
        setupConnessione(peer.connect(id, { reliable: true }));
    }
    
    const container = document.getElementById('messages');
    let html = '';
    let lastDate = '';
    
    (messaggi[id] || []).forEach(m => {
        const d = formattaGiorno(m.timestamp);
        if (d !== lastDate) { html += `<div class="date-divider">${d}</div>`; lastDate = d; }
        html += `<div class="msg ${m.tipo}">${m.testo}<span class="msg-time">${formattaData(m.timestamp)}</span></div>`;
    });
    
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function chiudiChat() {
    document.getElementById('chat-area').classList.remove('active');
    chatAttiva = null;
}

function salvaEVisualizza(id, testo, tipo) {
    if (!messaggi[id]) messaggi[id] = [];
    messaggi[id].push({ testo, tipo, timestamp: Date.now() });
    localStorage.setItem('storico-messaggi', JSON.stringify(messaggi));
    if (chatAttiva === id) apriChat(id);
}

function invia() {
    const input = document.getElementById('msg-input');
    if (!chatAttiva || !input.value) return;
    
    // Verifica che la connessione sia pronta
    if (connessioni[chatAttiva] && connessioni[chatAttiva].open) {
        connessioni[chatAttiva].send(input.value);
        salvaEVisualizza(chatAttiva, input.value, 'io');
        input.value = "";
    } else {
        alert("Connessione non ancora pronta, riprova tra un secondo.");
    }
}

document.getElementById("msg-input").addEventListener("keypress", (e) => { if (e.key === "Enter") invia(); });
