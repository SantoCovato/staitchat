// 1. Recupero o generazione ID persistente
let mioID = localStorage.getItem('mio-peer-id');

const peer = new Peer(mioID, {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    key: 'peerjs',
    debug: 1
});

peer.on('open', (id) => {
    // Se non esisteva un ID nel localStorage, lo salviamo ora
    if (!mioID) {
        localStorage.setItem('mio-peer-id', id);
        mioID = id;
    }
    document.getElementById('my-id').innerText = "IL TUO ID: " + id;
});

peer.on('error', (err) => {
    console.error(err);
    document.getElementById('my-id').innerText = "ERRORE: " + err.type;
});

// Gestione connessione
let conn = null;
peer.on('connection', (c) => {
    conn = c;
    setupConnessione();
});

function connetti() {
    const target = document.getElementById('target-id').value;
    if(!target) return alert("Inserisci l'ID!");
    conn = peer.connect(target, { reliable: true });
    setupConnessione();
}

function setupConnessione() {
    conn.on('open', () => {
        document.getElementById('status').innerText = "Stato: Connesso!";
    });
    conn.on('data', (data) => {
        aggiungiMessaggio("Lui: " + data, 'lui');
    });
}

function invia() {
    if (conn && conn.open) {
        const input = document.getElementById('msg-input');
        conn.send(input.value);
        aggiungiMessaggio("Io: " + input.value, 'io');
        input.value = "";
    } else {
        alert("Prima connettiti!");
    }
}

function aggiungiMessaggio(testo, chi) {
    const box = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = (chi === 'io') ? 'msg-io' : 'msg-lui';
    div.innerText = testo;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// Bonus: Invio con tasto Invio
document.getElementById("msg-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") invia();
});
