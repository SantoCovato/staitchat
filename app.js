let mioID = localStorage.getItem('mio-peer-id');
let contatti = JSON.parse(localStorage.getItem('contatti') || '[]');
let messaggi = JSON.parse(localStorage.getItem('storico-messaggi') || '{}');
let connessioni = {};
let chatAttiva = null;
let mioProfilo = JSON.parse(localStorage.getItem('profilo-mio') || '{"nome":"Utente", "foto":""}');

let currentCall = null;
let pendingCaller = null;
let isVideoCall = false;

const peer = new Peer(mioID, { host: '0.peerjs.com', port: 443, secure: true, key: 'peerjs' });

function ottieniStream(video) {
    return navigator.mediaDevices.getUserMedia({ video: video, audio: true });
}

window.addEventListener('load', () => {
    const pPic = document.getElementById('my-profile-pic');
    if (pPic && mioProfilo.foto) pPic.src = mioProfilo.foto;
});

peer.on('open', (id) => {
    if (!mioID) { localStorage.setItem('mio-peer-id', id); mioID = id; }
    document.getElementById('my-id').innerText = id;
    renderListaContatti();
});

function formattaData(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function formattaGiorno(ts) { return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' }); }
function toggleMenu() { document.getElementById('fab-menu').classList.toggle('hidden'); }

function apriProfilo() {
    document.getElementById('edit-name').value = mioProfilo.nome;
    document.getElementById('edit-pic').src = mioProfilo.foto || document.getElementById('my-profile-pic').src;
    document.getElementById('profile-modal').classList.remove('hidden');
}

function previewFile() {
    const file = document.getElementById('file-input').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('edit-pic').src = e.target.result;
        mioProfilo.foto = e.target.result;
    };
    reader.readAsDataURL(file);
}

function salvaProfilo() {
    mioProfilo.nome = document.getElementById('edit-name').value;
    localStorage.setItem('profilo-mio', JSON.stringify(mioProfilo));
    document.getElementById('my-profile-pic').src = mioProfilo.foto;
    document.getElementById('profile-modal').classList.add('hidden');
    Object.values(connessioni).forEach(conn => inviaProfilo(conn));
}

function inviaProfilo(conn) {
    if (conn.open) conn.send({ tipo: 'info-profilo', profilo: mioProfilo });
}

function mostraQR() {
    toggleMenu();
    document.getElementById('qr-modal').classList.remove('hidden');
    const qrDiv = document.getElementById("qrcode");
    if (qrDiv.innerHTML === "") { new QRCode(qrDiv, { text: mioID, width: 150, height: 150 }); }
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
    conn.on('open', () => inviaProfilo(conn));
    conn.on('data', (data) => {
        if (data.tipo === 'invito-chiamata') {
            pendingCaller = conn.peer; 
            isVideoCall = data.video;
            document.getElementById('incoming-modal').classList.remove('hidden');
        } else if (data.tipo === 'risposta-accetta') {
            ottieniStream(isVideoCall).then(stream => {
                document.getElementById('my-video').srcObject = stream;
                const call = peer.call(conn.peer, stream);
                gestisciCall(call);
            });
        } else if (data.tipo === 'chiudi-chiamata') {
            chiudiChiamataUI();
        } else if (data.tipo === 'info-profilo') {
            localStorage.setItem(`profilo-${conn.peer}`, JSON.stringify(data.profilo));
            renderListaContatti();
        } else {
            salvaEVisualizza(conn.peer, data, 'lui');
        }
    });
    conn.on('close', () => delete connessioni[conn.peer]);
}

function renderListaContatti() {
    const list = document.getElementById('lista-contatti');
    list.innerHTML = '';
    const svgDefault = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%238696a0'%3E%3Ccircle cx='12' cy='12' r='12'/%3E%3C/svg%3E";
    contatti.forEach(id => {
        const dati = JSON.parse(localStorage.getItem(`profilo-${id}`) || '{"nome":"'+id+'", "foto":""}');
        list.innerHTML += `
            <div class="contatto" onclick="apriChat('${id}')">
                <img src="${dati.foto || svgDefault}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                <span>${dati.nome}</span>
            </div>`;
    });
}

function apriChat(id) {
    chatAttiva = id;
    const dati = JSON.parse(localStorage.getItem(`profilo-${id}`) || '{"nome":"'+id+'", "foto":""}');
    const chatTitleElement = document.getElementById('chat-title');
    chatTitleElement.innerHTML = `
        <img src="${dati.foto || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%238696a0'%3E%3Ccircle cx='12' cy='12' r='12'/%3E%3C/svg%3E"}" 
             style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
        <div style="display:flex; flex-direction:column; line-height: 1.2; padding-left:10px;">
            <span>${dati.nome}</span>
            <span style="font-size: 0.7rem; color: #8696a0; font-weight: normal;">ID: ${id}</span>
        </div>`;
    document.getElementById('chat-area').classList.add('active');
    if (!connessioni[id] || !connessioni[id].open) { setupConnessione(peer.connect(id, { reliable: true })); }
    const container = document.getElementById('messages');
    let html = '';
    let lastDate = '';
    (messaggi[id] || []).forEach(m => {
        const d = formattaGiorno(m.timestamp);
        if (d !== lastDate) { html += `<div class="date-divider">${d}</div>`; lastDate = d; }
        html += `<div class="msg ${m.tipo}"><span>${m.testo}</span><span class="msg-time">${formattaData(m.timestamp)}</span></div>`;
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
    if (!connessioni[chatAttiva] || !connessioni[chatAttiva].open) { setupConnessione(peer.connect(chatAttiva, { reliable: true })); }
    setTimeout(() => {
        if (connessioni[chatAttiva] && connessioni[chatAttiva].open) {
            connessioni[chatAttiva].send(input.value);
            salvaEVisualizza(chatAttiva, input.value, 'io');
            input.value = "";
        }
    }, 500);
}

// Funzioni Chiamate
function inviaInvitoChiamata(conVideo) {
    if (connessioni[chatAttiva]) {
        isVideoCall = conVideo;
        connessioni[chatAttiva].send({ tipo: 'invito-chiamata', video: conVideo });
        const btn = document.getElementById('chat-title');
        const vecchioTesto = btn.innerHTML;
        btn.innerText = "Chiamata in corso...";
        setTimeout(() => btn.innerHTML = vecchioTesto, 3000);
    }
}

function accettaChiamata() {
    document.getElementById('incoming-modal').classList.add('hidden');
    ottieniStream(isVideoCall).then(stream => {
        document.getElementById('my-video').srcObject = stream;
        connessioni[pendingCaller].send({ tipo: 'risposta-accetta' });
    });
}

function rifiutaChiamata() {
    document.getElementById('incoming-modal').classList.add('hidden');
    connessioni[pendingCaller].send({ tipo: 'risposta-rifiuta' });
}

function chiudiChiamata() {
    if (connessioni[chatAttiva]) connessioni[chatAttiva].send({ tipo: 'chiudi-chiamata' });
    chiudiChiamataUI();
}

function chiudiChiamataUI() {
    if (currentCall) { currentCall.close(); currentCall = null; }
    document.getElementById('call-modal').classList.add('hidden');
    document.getElementById('incoming-modal').classList.add('hidden');
    const myVideo = document.getElementById('my-video');
    if (myVideo.srcObject) {
        myVideo.srcObject.getTracks().forEach(track => track.stop());
        myVideo.srcObject = null;
    }
}

peer.on('call', (call) => {
    currentCall = call;
    ottieniStream(isVideoCall).then(stream => {
        document.getElementById('my-video').srcObject = stream;
        call.answer(stream);
    });
    call.on('stream', (remoteStream) => {
        document.getElementById('remote-video').srcObject = remoteStream;
        document.getElementById('call-modal').classList.remove('hidden');
    });
    call.on('close', () => chiudiChiamataUI());
});

function gestisciCall(call) {
    currentCall = call;
    call.on('stream', (remoteStream) => {
        document.getElementById('remote-video').srcObject = remoteStream;
        document.getElementById('call-modal').classList.remove('hidden');
    });
    call.on('close', () => chiudiChiamataUI());
}

document.getElementById("msg-input").addEventListener("keypress", (e) => { if (e.key === "Enter") invia(); });
