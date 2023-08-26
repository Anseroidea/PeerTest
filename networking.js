var connections = new Map()
var peer = new Peer({debug:3});
const params = new URLSearchParams(window.location.search)
const q = params.get("host")
var isHost = null
var conn = null
peer.on('open', function(id) {
    console.log('My peer ID is: ' + id);
    if (q == null) {
        peer.on('connection', onUserJoin);
        isHost = true
    } else {
        conn = peer.connect(q);
        conn.on('open', function() {

        })
        conn.on('data', function(data) {
            console.log('Received', data);
            console.log("hi")
            if (data.type == "message")
                document.getElementById("messageText").textContent = data.value
        });
        isHost = false
    
    }
});
var onUserJoin = (c) => { // runs only for host
    conn = c
    alert("someone joined!")
    connections.set(conn.peer, conn)
    conn.on('open', () => { // init the new player
        conn.send({
            type: "data",
            users: null
        })
    })
    conn.on('data', function(data) {
        console.log('Received', data);
        if (data.type == "message") {
            document.getElementById("messageText").textContent = data.value
            propagate(data)
        }
    }); 
}


let propagate = (data) => {  // only host runs
    console.log(connections);
    [...connections].filter(([k, ]) => k != data.source).forEach(([, v]) => {
        console.log(v)
        v.send(data)
    })
}

export let broadcast = (message) => {
    if (conn == null) {
        return;
    } 
    let data = {
        source: peer.id,
        type: "message",
        value: message
    }
    if (!isHost) { // client
        conn.send(data)
        return
    }
    propagate(data)
    
}