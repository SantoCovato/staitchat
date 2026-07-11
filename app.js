// Stato Globale dell'Applicazione
let peer = null;
let activeConnection = null;
let activePeerId = null;
let databaseMessaggi = {}; // Mappa: peerId -> array di oggetti messaggio

// Chiavi asimmetriche in memoria volatile (RAM) per sessione
let coppiaChiaviStait = null;
let miaChiavePubblicaEsadecimale = "";

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

// Inizializzazione al caricamento della pagina
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

// Generazione vera delle chiavi Crittografiche
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
        alert("Errore nell'inizializzazione dell'hardware crittografico.");
    }
}

// Inizializza il nodo di rete P2P reale tramite protocollo WebRTC
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

    peer = new Peer(peerId);

    peer.on('open', (id) => {
        logStatoSistema("Nodo P2P online. Pronto a trasmettere direttamente.");
    });

    peer.on('error', (err) => {
        console.error("Errore di rete P2P:", err);
        logStatoSistema("[ERRORE RETE] Impossibile trovare o registrare il peer.");
    });

    peer.on('connection', (conn) => {
        gestisciConnessioneEntrante(conn);
    });
}

// Gestione del canale quando un Peer esterno avvia il collegamento con noi
function gestisciConnessioneEntrante(conn) {
    logStatoSistema(`Tentativo di aggancio P2P in entrata da: ${conn.peer.substring(0,8)}...`);
    
    conn.on('open', () => {
        activeConnection = conn;
        activePeerId = conn.peer;
        
        aggiungiPeerAInterfaccia(activePeerId);
        selezionaPeerChat(activePeerId);
        logStatoSistema(`Canale diretto E2EE stabilito con successo.`);
    });

    conn.on('data', (dataCifrata) => {
        gestisciRicezioneMessaggio(conn.peer, dataCifrata);
    });

    conn.on('close', () => {
        logStatoSistema(`Il peer ${conn.peer.substring(0,8)} si è disconnesso.`);
        impostaPeerOffline();
    });
}

// Avvia attivamente una connessione P2P verso un altro ID inserito nel campo di testo
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

    logStatoSistema(`Ricerca del peer ${cleanId.substring(0,8)} nella tabella DHT...`);

    const conn = peer.connect(cleanId, {
        reliable: true
    });

    conn.on('open', () => {
        activeConnection = conn;
        activePeerId = cleanId;

        aggiungiPeerAInterfaccia(activePeerId);
        selezionaPeerChat(activePeerId);
        logStatoSistema(`Canale diretto WebRTC aperto con successo.`);
        inputField.value = ""; 
    });

    conn.on('data', (dataCifrata) => {
        gestisciRicezioneMessaggio(cleanId, dataCifrata);
    });

    conn.on('close', () => {
        logStatoSistema(`Canale con ${cleanId.substring(0,8)} chiuso.`);
        impostaPeerOffline();
    });

    conn.on('error', (e) => {
        logStatoSistema(`Errore critico durante la connessione al peer.`);
        alert("Impossibile raggiungere il peer. Assicurati che sia online e che l'ID sia corretto.");
    });
}

// Esegue l'invio reale del testo inserito dall'utente sul canale P2P crittografato
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

// Gestisce la ricezione dei pacchetti dati
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

// Funzioni Interfaccia Grafica
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
