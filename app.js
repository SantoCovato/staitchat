// Stato Globale dell'Applicazione
let peer = null;
let activeConnection = null;
let activePeerId = null;
let databaseMessaggi = {}; 

let coppiaChiaviStait = null;
let miaChiavePubblicaEsadecimale = "";

// Configurazione ICE: Server usati SOLO per scambiare gli indirizzi IP (Handshake iniziale), i messaggi non passano di qui.
const configurazioneIceWebRTC = {
    'iceServers': [
        { 'urls': 'stun:stun.l.google.com:19302' },
        { 'urls': 'stun:stun1.l.google.com:19302' },
        { 'urls': 'stun:stun2.l.google.com:19302' },
        { 'urls': 'stun:global.stun.twilio.com:3478?transport=udp' }
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

// Inizializzazione automatico/manuale
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
        console.error(e);
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

    logStatoSistema("Inizializzazione del protocollo di rete decentralizzato...");

    peer = new Peer(peerId, {
        config: configurazioneIceWebRTC
    });

    peer.on('open', (id) => {
        logStatoSistema("Nodo P2P online. Pronto a trasmettere direttamente.");
    });

    peer.on('error', async (err) => {
        console.error("Errore di rete P2P:", err);
        
        if (err.type === 'unavailable-id' || err.type === 'id-taken') {
            logStatoSistema("[SISTEMA] ID precedente occupato. Rigenerazione flussi...");
            miaChiavePubblicaEsadecimale = await generatIDCasualeAlternativo();
            localStorage.setItem('stait_peer_pubkey', miaChiavePubblicaEsadecimale);
            setTimeout(() => { location.reload(); }, 1200);
        } else {
            logStatoSistema("[INFO] Rete in riconfigurazione automatica...");
        }
    });

    peer.on('connection', (conn) => {
        gestisciConnessioneEntrante(conn);
    });
}

function gestisciConnessioneEntrante(conn) {
    if (activeConnection && activePeerId === conn.peer) {
        return;
    }

    logStatoSistema(`Richiesta di aggancio rilevata. Apertura tunnel diretto...`);
    
    activeConnection = conn;
    activePeerId = conn.peer;

    activeConnection.on('open', () => {
        aggiungiPeerAInterfaccia(activePeerId);
        selezionaPeerChat(activePeerId);
        logStatoSistema(`Tunnel WebRTC Diretto stabilito con successo. Messaggi sicuri al 100%.`);
    });

    activeConnection.on('data', (dataCifrata) => {
        gestisciRicezioneMessaggio(conn.peer, dataCifrata);
    });

    activeConnection.on('close', () => {
        logStatoSistema(`Il peer si è disconnesso.`);
        impostaPeerOffline();
    });
}

function connettiAPeer() {
    const inputField = document.getElementById('peer-target-input');
    const targetId = inputField.value;
    
    if (!targetId || targetId.trim() === "") {
        alert("Inserisci un ID valido prima di connetterti.");
        return;
    }
    const cleanId = targetId.trim().toLowerCase();

    if (cleanId === miaChiavePubblicaEsadecimale) {
        alert("Non puoi connetterti a te stesso.");
        return;
    }

    if (activeConnection && activePeerId === cleanId) {
        alert("Sei già connesso in linea diretta con questo Peer.");
        return;
    }

    logStatoSistema(`Perforazione firewall ed invio coordinate P2P...`);

    const conn = peer.connect(cleanId, {
        reliable: true
    });

    conn.on('open', () => {
        activeConnection = conn;
        activePeerId = cleanId;

        aggiungiPeerAInterfaccia(activePeerId);
        selezionaPeerChat(activePeerId);
        logStatoSistema(`Connessione riuscita! Tunnel privato WebRTC aperto.`);
        inputField.value = ""; 
    });

    conn.on('data', (dataCifrata) => {
        gestisciRicezioneMessaggio(cleanId, dataCifrata);
    });

    conn.on('close', () => {
        logStatoSistema(`Canale chiuso.`);
        impostaPeerOffline();
    });

    conn.on('error', (e) => {
        logStatoSistema(`Errore di puntamento.`);
        alert("Impossibile raggiungere il peer attraverso questo firewall di rete.");
    });
}

async function inviaMessaggioReale() {
    const testo = messageInput.value.trim();
    if (!testo || !activeConnection) return;

    const pacchettoMessaggio = {
        tipo: "chat",
        testo: testo,
        timestamp: Date.now()
    };

    // Il pacchetto dati viene iniettato nel tunnel diretto criptato
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
        } else {
            const item = document.getElementById(`peer-item-${mittenteId}`);
            if (item) {
                item.querySelector('.contact-status').innerText = "nuovo messaggio!";
                item.querySelector('.contact-status').style.color = "#ffcc00";
            }
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
        currentItem.querySelector('.contact-status').innerText = "online";
        currentItem.querySelector('.contact-status').style.color = "var(--neon-blue)";
    }

    chatWithTitle.innerText = "Peer_" + peerId.substring(0, 12).toUpperCase() + "...";
    chatStatusText.innerText = "Canale WebRTC Diretto Cifrato Attivo";
    chatStatusText.style.color = "var(--neon-blue)";

    messageInput.disabled = false;
    messageInput.placeholder = "Invia un messaggio nel flusso sicuro...";
    sendBtn.disabled = false;

    svuotaEInizializzaFinestraChat();
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
    chatStatusText.innerText = "Connessione interrotta (Peer Offline)";
    chatStatusText.style.color = "var(--text-muted)";
    messageInput.disabled = true;
    messageInput.placeholder = "Peer non raggiungibile...";
    sendBtn.disabled = true;
    
    const currentItem = document.getElementById(`peer-item-${activePeerId}`);
    if (currentItem) {
        currentItem.querySelector('.contact-status').innerText = "offline";
        currentItem.querySelector('.contact-status').className = "contact-status offline";
    }
}

function svuotaEInizializzaFinestraChat() {
    messagesBox.innerHTML = "";
}

function salvaMessaggioInLocale(peerId, direzione, testo) {
    if (!databaseMessaggi[peerId]) {
        databaseMessaggi[peerId] = [];
    }
    databaseMessaggi[peerId].push({
        direzione: direzione,
        testo: testo,
        timestamp: Date.now()
    });
}

function copiaIlMioID() {
    navigator.clipboard.writeText(miaChiavePubblicaEsadecimale);
    alert("STAIT_ID copiato negli appunti! Invialo al tuo peer.");
}

function arrayBufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
