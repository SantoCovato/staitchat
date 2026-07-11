let peer = new Peer(); // Genera ID casuale in automatico
let conn = null;

// Quando il nodo è pronto
peer.on('open', (id) => {
    document.getElementById('my-id-text').innerText = "IL TUO ID: " + id;
});

// Quando qualcuno si connette a noi
peer.on('connection', (c) => {
    conn = c;
    gestisciConnessione();
});

// Funzione di connessione manuale
function connetti() {
    const target = document.getElementById('target-id').value;
    conn = peer.connect(target);
    gestisciConnessione();
}

// Configura i listener una volta stabilita la connessione
function gestisciConnessione() {
    conn.on('open', () => {
        document.getElementById('status').innerText = "Stato: Connesso!";
    });

    conn.on('data', (data) => {
        mostraMessaggio("Lui: " + data);
    });
}

function invia() {
    const input = document.getElementById('msg-input');
    if (conn && conn.open) {
        conn.send(input.value);
        mostraMessaggio("Io: " + input.value);
        input.value = "";
    }
}

function mostraMessaggio(testo) {
    const div = document.createElement('div');
    div.innerText = testo;
    document.getElementById('messages').appendChild(div);
}
