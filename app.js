// Stato Globale dell'Applicazione
let peer = null;
let activeConnection = null;
let activePeerId = null;
let databaseMessaggi = {}; 
let tentativoConnessioneInterval = null; 

let coppiaChiaviStait = null;
let miaChiavePubblicaEsadecimale = "";

// SOLO STUN di Google. Nessun server TURN esterno che tocca i tuoi dati.
const configurazioneIceWebRTC = {
    'iceServers': [
        { 'urls': 'stun:stun.l.google.com:19302' },
        { 'urls': 'stun:stun1.l.google.com:19302' },
        { 'urls': 'stun:stun2.l.google.com:19302' }
    ]
};

// Elementi Dom
const setupScreen = document.getElementById('setup-screen');
const appScreen = document.getElementById('app-screen');
const myIdText = document.getElementById('my-id-text');
const qrcodeContainer = document.getElementById('qrcode');
const contactsContainer = document.getElementById('contacts-container');
const messagesBox = document.getElementById('messages-box');
const chatWithTitle = document.getElementById('chat-with-title');
const chatStatusText = document.getElementById('chat-status-text');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

window.addEventListener('DOMContentLoaded', async () => {
    const pubKeySalvata = localStorage.getItem('stait_peer_pubkey');
    if (pubKeySalvata) {
        miaChiavePubblicaEsadecimale = pubKeySalvata;
        inizializzaReteP2P(miaChiavePubblicaEsadecimale);
    } else {
        appScreen.style.display = 'none';
        setupScreen.style.display = 'flex';
    }
});

function hardResetID() {
    localStorage.removeItem('stait_peer_pubkey');
    location.reload();
}

async function generatIDCasualeAlternativo() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return arrayBufferToHex(array);
}

async function inizializzaGenerazione() {
    try {
        const btn = setupScreen.querySelector('button');
        btn.innerText = "CRITTOGRAFIA IN CORSO...";
        btn.disabled = true;

        coppiaChiaviStait = await window.crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey", "deriveBits"]
        );

        const pubRaw = await window.crypto.subtle.exportKey("raw", coppiaChiaviStait.publicKey);
        miaChiavePubblicaEsadecimale = arrayBufferToHex(pubRaw);
        
        localStorage.setItem('stait_peer_pubkey', miaChiavePubblicaEsadecimale);
        inizializzaReteP2P(miaChiavePubblicaEsadecimale);
    } catch (e) {
        miaChiavePubblicaEsadecimale = await generatIDCasualeAlternativo();
        localStorage.setItem('stait_peer_pubkey', miaChiavePubblicaEsadecimale);
        inizializzaReteP2P(miaChiavePubblicaEsadecimale);
    }
}

function inizializzaReteP2P(peerId) {
    setupScreen.style.display = 'none';
    appScreen.style.display = 'flex';

    myIdText.innerText = "STAIT_ID: " + peerId.substring(0, 16).toUpperCase() + "...";
    myIdText.title = peerId;
    
    qrcodeContainer.innerHTML = "";
    new QRCode(qrcodeContainer, {
        text: peerId,
        width: 120,
        height: 120,
        colorDark : "#050505",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
    });

    logStatoSistema("Protocollo P2P Puro online. Tentativo di registrazione nodo...");

    try {
        peer = new Peer(peerId, {
            config: configurazioneIceWebRTC,
            debug: 3 // Massimo livello di debug in console
        });

        peer.on('open', (id) => {
            logStatoSistema("Dispositivo registrato sulla rete mesh.");
        });

        peer.on('error', async (err) => {
            console.error("PeerJS Error Critico:", err);
            logStatoSistema(`[ERRORE DI RETE] Tipo: ${err.type}. Dettaglio: ${err.message}`);
            
            if (err.type === 'unavailable-id' || err.type === 'id-taken') {
                miaChiavePubblicaEsadecimale = await generatIDCasualeAlternativo();
                localStorage.setItem('stait_peer_pubkey', miaChiavePubblicaEsadecimale);
                setTimeout(() => { location.reload(); }, 1000);
            }
        });

        peer.on('connection', (conn) => {
            gestisciConnessioneEntrante(conn);
        });

    } catch (error) {
        logStatoSistema(`[ERRORE FATALE] Impossibile istanziare WebRTC: ${error.message}`);
    }
}

function gestisciConnessioneEntrante(conn) {
    if (activeConnection && activeConnection.open) return;

    logStatoSistema(`Aggancio ricevuto da ${conn.peer.substring(0,8).toUpperCase()}. Apertura canale...`);
    
    activeConnection = conn;
    activePeerId = conn.peer;

    activeConnection.on('open', () => {
        clearInterval(tentativoConnessioneInterval);
        aggiungiPeerAInterfaccia(activePeerId);
        selezionaPeerChat(activePeerId);
        logStatoSistema(`[OK] Connessione P2P stabilita con successo.`);
    });

    activeConnection.on('data', (data) => {
        gestisciRicezioneMessaggio(conn.peer, data);
    });

    activeConnection.on('close', () => {
        logStatoSistema(`Il peer ha chiuso il canale.`);
        impostaPeerOffline();
    });
}

function connettiAPeer() {
    const inputField = document.getElementById('peer-target-input');
    const targetId = inputField.value.trim().toLowerCase();
    
    if (!targetId) return;
    if (targetId === miaChiavePubblicaEsadecimale) return alert("Non puoi connetterti a te stesso.");

    clearInterval(tentativoConnessioneInterval);
    logStatoSistema(`Apertura socket verso il peer target...`);

    const tentaAggancioP2P = () => {
        if (activeConnection && activeConnection.open) {
            clearInterval(tentativoConnessioneInterval);
            return;
        }

        const conn = peer.connect(targetId, { reliable: true });

        conn.on('open', () => {
            clearInterval(tentativoConnessioneInterval);
            activeConnection = conn;
            activePeerId = targetId;

            aggiungiPeerAInterfaccia(activePeerId);
            selezionaPeerChat(activePeerId);
            logStatoSistema(`[OK] Tunnel diretto aperto.`);
            inputField.value = ""; 
        });

        conn.on('data', (data) => {
            gestisciRicezioneMessaggio(targetId, data);
        });

        conn.on('close', () => {
            impostaPeerOffline();
        });
    };

    tentaAggancioP2P();
    // Intervallo più lungo (6 secondi) per dare tempo alle sessioni ICE di stabilizzarsi senza intasare la rete
    tentativoConnessioneInterval = setInterval(tentaAggancioP2P, 6000);
}

async function inviaMessaggioReale() {
    const testo = messageInput.value.trim();
    if (!testo || !activeConnection) return;

    const pacchettoMessaggio = {
        tipo: "chat",
        testo: testo,
        timestamp: Date.now()
    };

    activeConnection.send(pacchettoMessaggio);
    salvaMessaggioInLocale(activePeerId, "sent", testo);
    renderizzaNuovoMessaggio("sent", testo);

    messageInput.value = "";
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

function gestisciRicezioneMessaggio(mittenteId, pacchetto) {
    if (pacchetto && pacchetto.tipo === "chat") {
        salvaMessaggioInLocale(mittenteId, "received", pacchetto.testo);
        if (activePeerId === mittenteId) {
            renderizzaNuovoMessaggio("received", pacchetto.testo);
            messagesBox.scrollTop = messagesBox.scrollHeight;
        }
    }
}

function aggiungiPeerAInterfaccia(peerId) {
    if (document.getElementById(`peer-item-${peerId}`)) return;

    const ShortName = "Peer_" + peerId.substring(0, 8).toUpperCase();
    const item = document.createElement('div');
    item.className = 'contact-item';
    item.id = `peer-item-${peerId}`;
    item.onclick = () => selezionaPeerChat(peerId);

    item.innerHTML = `
        <div class="avatar-shadow">P2P</div>
        <div class="contact-info">
            <div class="contact-name">${ShortName}</div>
            <div class="contact-status">online</div>
        </div>
    `;
    contactsContainer.appendChild(item);
}

function selezionaPeerChat(peerId) {
    activePeerId = peerId;
    document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
    const currentItem = document.getElementById(`peer-item-${peerId}`);
    if (currentItem) {
        currentItem.classList.add('active');
    }

    chatWithTitle.innerText = "Peer_" + peerId.substring(0, 12).toUpperCase() + "...";
    chatStatusText.innerText = "Canale P2P Puro";
    chatStatusText.style.color = "var(--neon-blue)";

    messageInput.disabled = false;
    messageInput.placeholder = "Invia un messaggio diretto...";
    sendBtn.disabled = false;

    messagesBox.innerHTML = "";
    if (databaseMessaggi[peerId]) {
        databaseMessaggi[peerId].forEach(msg => {
            renderizzaNuovoMessaggio(msg.direzione, msg.testo);
        });
    }
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

function renderizzaNuovoMessaggio(direzione, testo) {
    const row = document.createElement('div');
    row.className = `message-row ${direzione}`;
    row.innerHTML = `<div class="bubble">${testo}</div>`;
    messagesBox.appendChild(row);
}

function logStatoSistema(messaggio) {
    const row = document.createElement('div');
    row.className = 'message-row system';
    row.innerHTML = `<div class="bubble">[SISTEMA] ${messaggio}</div>`;
    messagesBox.appendChild(row);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

function impostaPeerOffline() {
    chatStatusText.innerText = "Disconnesso";
    chatStatusText.style.color = "var(--text-muted)";
    messageInput.disabled = true;
}

function salvaMessaggioInLocale(peerId, direzione, testo) {
    if (!databaseMessaggi[peerId]) databaseMessaggi[peerId] = [];
    databaseMessaggi[peerId].push({ direzione, testo, timestamp: Date.now() });
}

function copiaIlMioID() {
    navigator.clipboard.writeText(miaChiavePubblicaEsadecimale);
    alert("ID copiato!");
}

function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
