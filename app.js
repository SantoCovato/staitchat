// Usiamo una configurazione che forza la chiave di accesso ufficiale
const peer = new Peer(undefined, {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    key: 'peerjs', // Questa chiave è fondamentale per autorizzare la connessione
    debug: 3
});

let conn = null;

peer.on('open', (id) => {
    document.getElementById('my-id').innerText = "IL TUO ID: " + id;
    console.log("Connesso al server ufficiale. ID: " + id);
});

peer.on('error', (err) => {
    console.error("Errore PeerJS:", err);
    document.getElementById('my-id').innerText = "Errore: " + err.type;
    // Se dà ancora server-error, significa che il server è down in questo momento
});

peer.on('connection', (c) => {
    conn = c;
    setupConnessione();
});

function connetti() {
    const target = document.getElementById('target-id').value;
    if(!target) return alert("Inserisci un ID");
    conn = peer.connect(target, { reliable: true });
    setupConnessione();
}

function setupConnessione() {
    conn.on('open', () => {
        document.getElementById('status').innerText = "Stato: Connesso!";
    });
    conn.on('data', (data) => {
        aggiungiMessaggio("Lui: " + data);
    });
}

function invia() {
    if (conn && conn.open) {
        const msg = document.getElementById('msg-input').value;
        conn.send(msg);
        aggiungiMessaggio("Io: " + msg);
        document.getElementById('msg-input').value = "";
    }
}

function aggiungiMessaggio(testo) {
    const box = document.getElementById('messages');
    box.innerHTML += `<div>${testo}</div>`;
}
